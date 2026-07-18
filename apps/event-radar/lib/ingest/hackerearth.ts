import type { IngestRow } from './devpost'

// HackerEarth's Chrome-extension feed: a small JSON endpoint that has served
// their browser extension for years — { response: [ {title, url, status,
// start_utc_tz, end_utc_tz, ...} ] }. Only ongoing/upcoming events appear.
// No location data — format is left null for enrichment to determine (most
// HackerEarth hackathons are online).

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const API = 'https://www.hackerearth.com/chrome-extension/events/'

type HackerEarthEvent = {
  title?: string
  url?: string
  status?: string
  start_utc_tz?: string
  end_utc_tz?: string
  challenge_type?: string
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function fetchHackerEarth(): Promise<IngestRow[]> {
  const res = await fetch(API, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`hackerearth -> ${res.status}`)

  const body = (await res.json()) as { response?: HackerEarthEvent[] }
  const items = body.response
  if (!Array.isArray(items)) {
    throw new Error(
      `hackerearth: no response array — keys: ${Object.keys(body ?? {})
        .slice(0, 10)
        .join(',')}`
    )
  }

  const rows: IngestRow[] = []
  for (const e of items) {
    const title = str(e.title)
    const url = str(e.url)
    if (!title || !url) continue
    rows.push({
      source: 'hackerearth',
      source_id: null,
      title,
      url,
      starts_at: toISO(e.start_utc_tz),
      ends_at: toISO(e.end_utc_tz),
      location_raw: null,
      format: null,
      prize_pool: null,
      themes: str(e.challenge_type) ? [String(e.challenge_type)] : [],
    })
  }

  // An empty feed is plausible here (the endpoint only lists live events), so
  // zero mapped rows only errors when items existed but none mapped.
  if (items.length > 0 && rows.length === 0) {
    throw new Error(`hackerearth: 0 events mapped from ${items.length} items — field names drifted?`)
  }
  return rows
}
