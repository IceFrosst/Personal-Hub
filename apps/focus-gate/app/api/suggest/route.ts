import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PRIORITY_RANK, type Priority, type Suggestion, type Task } from '@/lib/types'

// How many tasks the gate lists at once.
const MAX_SUGGESTIONS = 2

// Min gap between Gemini calls per user — see the throttle in POST.
const THROTTLE_MS = 20_000

// Bound the model call — the gate's loader shouldn't wait on a slow Gemini.
const GEMINI_TIMEOUT_MS = 5000

// Time-of-day buckets. Late night is deliberately gentle: the user may be in bed,
// so we prefer small/quick tasks and never push a big, heavy one.
type Bucket = 'morning' | 'afternoon' | 'evening' | 'late night'

function bucketFor(hour: number): Bucket {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late night'
}

function priorityRank(p: Priority | null | undefined): number {
  return p ? PRIORITY_RANK[p] : PRIORITY_RANK.medium
}

// The user's local "today" at midnight, from the client's calendar date (server runs
// UTC on Vercel, so its own midnight can be a day off). Falls back to server date.
function todayFrom(clientDate: string | null): Date {
  if (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    const d = new Date(clientDate + 'T00:00:00')
    if (!Number.isNaN(d.getTime())) return d
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

// Days until due relative to the given "today" (negative = overdue). null when no due date.
function daysUntilDue(due: string | null | undefined, today: Date): number | null {
  if (!due) return null
  const d = new Date(due + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

// Deterministic scorer used for the fallback and to keep the heuristic honest.
// Weighs priority + due-date urgency, then bends for the time of day — gently at night.
function scoreTask(task: Task, bucket: Bucket, today: Date): number {
  let score = priorityRank(task.priority) // 1–3
  if (task.is_quick) score += 1.5

  const due = daysUntilDue(task.due_date, today)
  if (due !== null) {
    if (due <= 0) score += 2.5 // due today or overdue
    else if (due === 1) score += 1.5
    else if (due <= 3) score += 0.75
  }

  if (bucket === 'late night') {
    // Be kind: lift quick wins, push heavy tasks down so they don't get suggested in bed.
    score += task.is_quick ? 2 : -2.5
  } else if (bucket === 'evening') {
    if (!task.is_quick) score -= 0.5 // wind down — lean lighter
  } else if (bucket === 'morning') {
    if (!task.is_quick) score += 0.5 // fresh energy — fine to tackle a bigger one
  }

  return score
}

// The gate lists just title + priority + date, so priority/dueDate come straight
// from the task row (never trusted from the model).
function toSuggestion(task: Task): Suggestion {
  return {
    taskId: task.id,
    taskTitle: task.title,
    priority: task.priority ?? null,
    dueDate: task.due_date ?? null,
  }
}

// Top tasks by score, best first. Tie-break oldest-first so nothing lingers forever.
function rankTasks(active: Task[], bucket: Bucket, today: Date): Task[] {
  return [...active].sort((a, b) => {
    const diff = scoreTask(b, bucket, today) - scoreTask(a, bucket, today)
    if (diff !== 0) return diff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let clientHour: number | null = null
  let clientDate: string | null = null
  try {
    const body = await request.json()
    // The user's local hour (server runs UTC on Vercel) — drives time-of-day gentleness.
    if (typeof body.clientHour === 'number' && body.clientHour >= 0 && body.clientHour <= 23) {
      clientHour = Math.floor(body.clientHour)
    }
    // The user's local calendar date ('YYYY-MM-DD') — drives due-date urgency.
    if (typeof body.clientDate === 'string') {
      clientDate = body.clientDate
    }
  } catch {
    // Malformed/missing body — fine, server time covers both below.
  }

  // The tasks come from the database, never the request body — the client can't feed
  // invented titles to Gemini, echo fake priority/due_date, or inflate suggestion_count.
  const { data: tasks } = await supabase
    .schema('focus_gate')
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_completed', false)

  const active: Task[] = tasks ?? []
  if (!active.length) return NextResponse.json({ suggestions: [] }, { status: 200 })

  const hour = clientHour ?? new Date().getHours()
  const bucket = bucketFor(hour)
  const today = todayFrom(clientDate)
  const apiKey = process.env.GEMINI_API_KEY

  const heuristicPicks = () => rankTasks(active, bucket, today).slice(0, MAX_SUGGESTIONS)

  // Record that we surfaced these so repeats can be de-prioritised later.
  // suggestion_count is computed from the rows we just read, never from the request.
  async function markSuggested(picks: Task[]) {
    const now = new Date().toISOString()
    await Promise.all(
      picks.map((t) =>
        supabase
          .schema('focus_gate')
          .from('tasks')
          .update({
            last_suggested_at: now,
            suggestion_count: (t.suggestion_count ?? 0) + 1,
          })
          .eq('id', t.id)
      )
    )
  }

  // Single exit for every suggestion response — Gemini pick, heuristic fallback,
  // no-API-key — so the bookkeeping is uniform. Throttled hits skip the marking.
  async function respond(picks: Task[], mark = true) {
    if (mark) await markSuggested(picks)
    return NextResponse.json({ suggestions: picks.map(toSuggestion) })
  }

  // Cheap per-user throttle: Google sign-up is open and Gemini's free tier is
  // 1,500 req/day, so rapid re-opens (or someone hammering the endpoint) get the
  // deterministic heuristic instead of another model call. Skipping markSuggested
  // here also stops repeat hits from pumping suggestion_count.
  const lastSuggestedAt = Math.max(
    0,
    ...active.map((t) => (t.last_suggested_at ? new Date(t.last_suggested_at).getTime() : 0))
  )
  if (Date.now() - lastSuggestedAt < THROTTLE_MS) {
    return respond(heuristicPicks(), false)
  }

  if (!apiKey) {
    return respond(heuristicPicks())
  }

  try {
    const clock = `${String(hour).padStart(2, '0')}:00`

    const taskList = active
      .map(
        (t) =>
          `- ID: ${t.id} | "${t.title}" | priority: ${t.priority ?? 'medium'} | quick: ${t.is_quick} | due: ${t.due_date ?? 'none'}`
      )
      .join('\n')

    const prompt = `The user is about to open Instagram instead of doing something useful. Pick up to ${MAX_SUGGESTIONS} tasks from their list for them to do instead, ordered best first.

How to choose:
- Weigh priority (high > medium > low) and due dates (sooner/overdue = more urgent).
- Match the energy of the time of day. It is ${bucket} (${clock}). Morning/afternoon: a bigger or high-priority task is fine. Evening: lean lighter.
- LATE AT NIGHT, be gentle — the user may be in bed. Prefer quick or small tasks, and NEVER push a big or heavy one. If everything left is big and it's late, it's fine to suggest fewer (or just one) easy task.
- Return fewer than ${MAX_SUGGESTIONS} if only one task fits the moment.

Their pending tasks:
${taskList}

Reply as JSON only (no markdown), task IDs only, best first:
{"taskIds":["<id>", "<id>"]}`

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        // Key travels in a header, not the URL, so it can't end up in request logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    )

    if (!res.ok) throw new Error('Gemini error')

    const geminiData = await res.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = JSON.parse(text) as { taskIds?: unknown }

    // Map model IDs back to real rows (deduped, capped) — ignore anything it invented.
    const ids = Array.isArray(parsed.taskIds) ? parsed.taskIds : []
    const seen = new Set<string>()
    const picks: Task[] = []
    for (const id of ids) {
      if (typeof id !== 'string' || seen.has(id)) continue
      const match = active.find((t) => t.id === id)
      if (match) {
        seen.add(id)
        picks.push(match)
      }
      if (picks.length >= MAX_SUGGESTIONS) break
    }

    // Model returned nothing usable — fall back to the deterministic ranking.
    if (!picks.length) return respond(heuristicPicks())

    return respond(picks)
  } catch {
    // Timeout, network or parse failure — the deterministic ranking still answers.
    return respond(heuristicPicks())
  }
}
