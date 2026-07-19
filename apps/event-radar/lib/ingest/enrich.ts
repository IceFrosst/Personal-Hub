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
- travel_covered: true if organizers offer ANY participant travel support — reimbursement, travel stipend/scholarship/grant/bursary, covered or subsidised flights/train/airfare, "travel covered up to X", or travel support for accepted/selected hackers. false if the page explicitly says travel is NOT covered / at your own cost. null if travel is not mentioned at all. Partial or capped or selective support still counts as true.
- accommodation_covered: true if sleeping arrangements are provided or subsidised — hotel, hostel, housing, lodging, "accommodation provided/covered". false if explicitly not provided. null if not mentioned.
- open_to_business_students: true if non-engineering/business students may participate (open eligibility counts as true), false if it is explicitly restricted to developers/CS students, null if unclear
- format: "online", "in_person", or "hybrid", or null if unclear
- city: city name or null
- country: country name or null
- registration_deadline: "YYYY-MM-DD" or null if not stated
- themes: array of short topic strings (max 6, [] if none)

Never invent a fact that is not in the text — but travel/accommodation perks are the priority signal, so read the whole text (including any FAQ/Travel/Logistics section) before deciding they are absent. When the text truly does not state a fact, use null.`

// Travel/accommodation coverage — the highest-value ranking signal — usually lives
// in a FAQ / "Travel" / "Logistics" block far down a long page, past a naive head
// truncation. Hoist the passages around these money-keywords to the front so they
// always reach the model, then backfill with the page head for context. Pure and
// deterministic so it can be unit-tested.
const SIGNAL_RE =
  /travel|reimburs|stipend|scholarship|bursary|\bgrant\b|flight|airfare|\bfares?\b|\btrain\b|\bvisa\b|accommodation|accomodation|lodging|hotel|hostel|housing|covered up to|we (?:cover|will cover|reimburse|provide)/gi

export function focusText(fullText: string, budget = 9000): string {
  const head = fullText.slice(0, 2500)
  const windows: Array<[number, number]> = []
  let match: RegExpExecArray | null
  SIGNAL_RE.lastIndex = 0
  while ((match = SIGNAL_RE.exec(fullText)) !== null && windows.length < 24) {
    const start = Math.max(0, match.index - 350)
    const end = Math.min(fullText.length, match.index + 450)
    const last = windows[windows.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else windows.push([start, end])
  }

  let out = head
  for (const [start, end] of windows) {
    if (end <= 2500) continue // already inside the head slice
    if (out.length >= budget) break
    out += ` … ${fullText.slice(start, end)}`
  }
  return out.slice(0, budget)
}

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
  // Prioritise travel/accommodation passages over a blind head-truncation so the
  // priority signal survives on long pages (see focusText).
  const text = focusText(pageText)
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
    return (
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        // Keep the whole readable page: focusText hoists the travel/accommodation
        // section (often deep in a long FAQ) into the model's window, so cutting
        // early here would drop the exact signal we care about most.
        .slice(0, 40000)
    )
  } catch {
    return null
  }
}
