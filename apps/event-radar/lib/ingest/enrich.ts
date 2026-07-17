// LLM enrichment of a hackathon's detail page: extract the ranking-critical
// booleans the list APIs never provide. Per root CLAUDE.md model guidance:
// Groq (fast, generous free tier) is the primary for this high-volume
// structured extraction; Gemini Flash is the fallback; total failure leaves
// every field null ("unknown") — the feed still works, ranked conservatively.

export type Enrichment = {
  travel_covered: boolean | null
  accommodation_covered: boolean | null
  open_to_business_students: boolean | null
  format: 'online' | 'in_person' | 'hybrid' | null
  city: string | null
  country: string | null
  registration_deadline: string | null
  themes: string[]
}

const EMPTY: Enrichment = {
  travel_covered: null,
  accommodation_covered: null,
  open_to_business_students: null,
  format: null,
  city: null,
  country: null,
  registration_deadline: null,
  themes: [],
}

const PROMPT = `You extract facts about a hackathon from its webpage text. Reply with ONLY a JSON object with exactly these keys:
- travel_covered: true if the organizers reimburse or cover participant travel, false if the page says they do not, null if not mentioned
- accommodation_covered: true if sleeping arrangements/hotel are provided, false if explicitly not, null if not mentioned
- open_to_business_students: true if non-engineering/business students may participate (open eligibility counts as true), false if it is explicitly restricted to developers/CS students, null if unclear
- format: "online", "in_person", or "hybrid", or null if unclear
- city: city name or null
- country: country name or null
- registration_deadline: "YYYY-MM-DD" or null if not stated
- themes: array of short topic strings (max 6, [] if none)

Never guess: when the text does not state a fact, use null.`

function coerce(parsed: Record<string, unknown>): Enrichment {
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : null)
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const fmt = str(parsed.format)
  const deadline = str(parsed.registration_deadline)
  return {
    travel_covered: bool(parsed.travel_covered),
    accommodation_covered: bool(parsed.accommodation_covered),
    open_to_business_students: bool(parsed.open_to_business_students),
    format: fmt === 'online' || fmt === 'in_person' || fmt === 'hybrid' ? fmt : null,
    city: str(parsed.city),
    country: str(parsed.country),
    registration_deadline: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
    themes: Array.isArray(parsed.themes)
      ? parsed.themes.filter((t): t is string => typeof t === 'string').slice(0, 6)
      : [],
  }
}

async function enrichWithGroq(text: string): Promise<Enrichment | null> {
  const key = process.env.GROQ_API_KEY
  if (!key) return null
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`groq -> ${res.status}`)
  const body = await res.json()
  const content = body.choices?.[0]?.message?.content
  if (!content) return null
  return coerce(JSON.parse(content))
}

async function enrichWithGemini(text: string): Promise<Enrichment | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${PROMPT}\n\n---\n\n${text}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
      signal: AbortSignal.timeout(15000),
    }
  )
  if (!res.ok) throw new Error(`gemini -> ${res.status}`)
  const body = await res.json()
  const content = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) return null
  return coerce(JSON.parse(content))
}

export async function enrich(pageText: string): Promise<Enrichment> {
  const text = pageText.slice(0, 9000)
  try {
    const viaGroq = await enrichWithGroq(text)
    if (viaGroq) return viaGroq
  } catch {
    // fall through to Gemini
  }
  try {
    const viaGemini = await enrichWithGemini(text)
    if (viaGemini) return viaGemini
  } catch {
    // fall through to unknowns
  }
  return { ...EMPTY }
}

// Fetch a hackathon's page and reduce it to text the models can read.
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000)
  } catch {
    return null
  }
}
