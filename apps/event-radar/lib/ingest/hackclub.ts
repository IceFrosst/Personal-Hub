import type { IngestRow } from './devpost'

// Hack Club's hackathon directory API — a plain JSON array, long-stable, used
// by their own site. NOTE: the bare /api/events path serves the SPA shell;
// only /api/events/upcoming returns JSON. Mostly student hackathons (many
// travel-grant-friendly), worldwide coverage.

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const API = 'https://hackathons.hackclub.com/api/events/upcoming'

type HackClubEvent = {
  id?: string
  name?: string
  website?: string
  start?: string
  end?: string
  city?: string | null
  state?: string | null
  country?: string | null
  virtual?: boolean
  hybrid?: boolean
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function fetchHackClub(): Promise<IngestRow[]> {
  const res = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`hackclub -> ${res.status}`)

  const body: unknown = await res.json()
  if (!Array.isArray(body)) {
    // The SPA shell parses as JSON never — but guard against an object payload
    // appearing here; describe what arrived so the cron report is actionable.
    throw new Error(
      `hackclub: expected array, got ${typeof body}${
        body && typeof body === 'object' ? ` keys: ${Object.keys(body).slice(0, 10).join(',')}` : ''
      }`
    )
  }

  const rows: IngestRow[] = []
  for (const e of body as HackClubEvent[]) {
    const title = str(e.name)
    const url = str(e.website)
    if (!title || !url) continue
    const place = [str(e.city), str(e.state), str(e.country)].filter(Boolean).join(', ')
    rows.push({
      source: 'hackclub',
      source_id: str(e.id),
      title,
      url,
      starts_at: toISO(e.start),
      ends_at: toISO(e.end),
      location_raw: place || null,
      format: e.virtual === true ? 'online' : e.hybrid === true ? 'hybrid' : place ? 'in_person' : null,
      prize_pool: null,
      themes: [],
    })
  }

  if (rows.length === 0) {
    throw new Error(`hackclub: 0 events mapped from ${body.length} items — field names drifted?`)
  }
  return rows
}
