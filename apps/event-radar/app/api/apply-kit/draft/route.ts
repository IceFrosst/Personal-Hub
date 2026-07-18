import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { coerceProfile, profileIsEmpty, type DraftAnswer } from '@/lib/apply-kit'
import type { Hackathon } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Drafts first-person answers to a hackathon application form from the user's
// stored Apply Kit profile. Groq primary / Gemini fallback, same as ingest
// enrichment (root CLAUDE.md model guidance). Runs as the signed-in user via
// the cookie client — RLS scopes every read and write, no service role here.

const MAX_QUESTIONS = 15
const MAX_QUESTION_CHARS = 600

const SYSTEM = `You draft hackathon application answers on behalf of an applicant. You are given their profile (JSON), the hackathon's details, and the application questions.

Rules:
- Write in first person, as the applicant.
- Be specific and concise: 2-6 sentences per answer unless the question clearly wants more or less (e.g. "one word" or a link).
- Use ONLY facts from the profile. Never invent schools, projects, jobs, or numbers.
- If the profile lacks what a question needs, answer what you can and mark the gap inline as [TODO: what's missing].
- For link/contact questions, answer with the bare value from the profile.
- Match the hackathon's spirit (its themes/description) where it helps, without flattery padding.

Reply with ONLY a JSON object: {"answers": [{"question": "...", "answer": "..."}]} — one entry per question, in the given order.`

function coerceAnswers(parsed: unknown, questions: string[]): DraftAnswer[] | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  const arr = (parsed as { answers?: unknown }).answers
  if (!Array.isArray(arr)) return null
  const answers = arr
    .map((a) => {
      if (typeof a !== 'object' || a === null) return null
      const r = a as Record<string, unknown>
      const answer = typeof r.answer === 'string' ? r.answer.trim() : ''
      const question = typeof r.question === 'string' ? r.question.trim() : ''
      return answer ? { question, answer } : null
    })
    .filter((a): a is DraftAnswer => a !== null)
  if (answers.length === 0) return null
  // Realign to the asked questions when counts match — the model sometimes
  // paraphrases the question text.
  if (answers.length === questions.length) {
    return answers.map((a, i) => ({ question: questions[i], answer: a.answer }))
  }
  return answers
}

async function draftWithGroq(userPrompt: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`groq -> ${res.status}`)
  const body = await res.json()
  return body.choices?.[0]?.message?.content ?? null
}

async function draftWithGemini(userPrompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM}\n\n---\n\n${userPrompt}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  )
  if (!res.ok) throw new Error(`gemini -> ${res.status}`)
  const body = await res.json()
  return body.candidates?.[0]?.content?.parts?.[0]?.text ?? null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let payload: { hackathon_id?: unknown; questions?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const hackathonId = typeof payload.hackathon_id === 'string' ? payload.hackathon_id : null
  const questions = Array.isArray(payload.questions)
    ? payload.questions
        .filter((q): q is string => typeof q === 'string')
        .map((q) => q.trim().slice(0, MAX_QUESTION_CHARS))
        .filter((q) => q !== '')
        .slice(0, MAX_QUESTIONS)
    : []
  if (!hackathonId || questions.length === 0) {
    return NextResponse.json({ error: 'hackathon_id and questions required' }, { status: 400 })
  }

  const db = supabase.schema('hackathon')
  const [{ data: hackathon }, { data: profileRow, error: profileErr }] = await Promise.all([
    db.from('hackathons').select('*').eq('id', hackathonId).maybeSingle(),
    db.from('application_profiles').select('profile').eq('user_id', user.id).maybeSingle(),
  ])
  if (!hackathon) return NextResponse.json({ error: 'hackathon_not_found' }, { status: 404 })
  if (profileErr) {
    // Most likely migration 0002 isn't applied yet — don't misreport this as
    // an empty profile and send the user to a form that can't save.
    return NextResponse.json(
      { error: 'apply_kit_not_provisioned', detail: profileErr.message },
      { status: 503 }
    )
  }

  const profile = coerceProfile(profileRow?.profile)
  if (profileIsEmpty(profile)) {
    return NextResponse.json({ error: 'profile_empty' }, { status: 422 })
  }

  const h = hackathon as Hackathon
  const userPrompt = [
    `APPLICANT PROFILE:\n${JSON.stringify(profile, null, 1)}`,
    `HACKATHON:\n${JSON.stringify(
      {
        title: h.title,
        url: h.url,
        format: h.format,
        location: [h.city, h.country].filter(Boolean).join(', ') || h.location_raw,
        starts_at: h.starts_at,
        themes: h.themes,
        description: (h.raw_description ?? '').slice(0, 3000),
      },
      null,
      1
    )}`,
    `APPLICATION QUESTIONS:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
  ].join('\n\n')

  let content: string | null = null
  let model: string | null = null
  const failures: string[] = []
  try {
    content = await draftWithGroq(userPrompt)
    if (content) model = 'groq/llama-3.3-70b-versatile'
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err))
  }
  if (!content) {
    try {
      content = await draftWithGemini(userPrompt)
      if (content) model = 'gemini-flash-latest'
    } catch (err) {
      failures.push(err instanceof Error ? err.message : String(err))
    }
  }
  if (!content) {
    return NextResponse.json(
      { error: 'drafting_unavailable', detail: failures.join('; ') || 'no LLM keys configured' },
      { status: 503 }
    )
  }

  let answers: DraftAnswer[] | null = null
  try {
    answers = coerceAnswers(JSON.parse(content), questions)
  } catch {
    answers = null
  }
  if (!answers) {
    return NextResponse.json({ error: 'bad_model_output', model }, { status: 502 })
  }

  // Persist so reopening the sheet shows the last draft. RLS pins the row to
  // this user; failure to save still returns the draft (it's on screen).
  const { error: saveError } = await db.from('application_drafts').upsert(
    {
      user_id: user.id,
      hackathon_id: hackathonId,
      questions,
      answers,
      model,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,hackathon_id' }
  )

  return NextResponse.json({ answers, model, saved: !saveError })
}
