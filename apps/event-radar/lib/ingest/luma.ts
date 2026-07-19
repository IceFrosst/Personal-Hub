import type { IngestRow } from './devpost'

// Luma's public discovery API — the same feed that powers lu.ma's "Discover"
// search. `get-paginated-events?query=hackathon` fuzzy-matches the query, so it
// returns real global hackathons (Austin, Bengaluru, Sydney, …) alongside some
// loosely-related meetups; we keep only entries whose name actually mentions a
// hackathon so the catalog stays on-topic. No auth needed — the signed-in-only
// endpoint is `/search/get-results`, which we deliberately do NOT use.
//
// Each entry's `url` is a bare slug; the public event page is lu.ma/<slug>.
// Luma is heavy on short community hackathons worldwide — good breadth, and the
// strict future-start/open-registration eligibility rule drops the many
// same-day/past entries the fuzzy search also returns.

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const API = 'https://api.lu.ma/discover/get-paginated-events'
const QUERY = 'hackathon'
// Bound the crawl: the feed is cursor-paginated and effectively unbounded, but
// hackathons this feed surfaces thin out fast and each page is one HTTP round
// trip against the function's time budget. Four pages ≈ 150 candidate events.
const MAX_PAGES = 4

type LumaGeo = {
  city?: string | null
  region?: string | null
  country?: string | null
  city_state?: string | null
}

type LumaEvent = {
  api_id?: string
  name?: string
  url?: string
  start_at?: string
  end_at?: string
  location_type?: string
  geo_address_info?: LumaGeo | null
  virtual_info?: { has_access?: boolean } | null
}

type LumaPage = {
  entries?: Array<{ event?: LumaEvent }>
  has_more?: boolean
  next_cursor?: string | null
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function place(geo: LumaGeo | null | undefined): string | null {
  if (!geo) return null
  const cs = str(geo.city_state)
  if (cs) return cs
  return [str(geo.city), str(geo.region), str(geo.country)].filter(Boolean).join(', ') || null
}

function hasUsefulGeo(geo: LumaGeo | null | undefined): boolean {
  if (!geo) return false
  return !!(str(geo.city) || str(geo.country) || str(geo.city_state) || str(geo.region))
}

// Pure mapper — one API page of entries to IngestRows, name-filtered. Exported
// so the parser can be unit-tested without a live network call.
export function parseLumaPage(page: LumaPage): IngestRow[] {
  const rows: IngestRow[] = []
  for (const entry of page.entries ?? []) {
    const e = entry.event
    if (!e) continue
    const title = str(e.name)
    const slug = str(e.url)
    if (!title || !slug) continue
    // Drop the fuzzy near-misses ("Cafe Cursor", generic meetups) the query
    // pulls in; keep anything self-describing as a hackathon / hack day / jam.
    if (!/\bhack|hackathon|hack[- ]?day|hack[- ]?night|game\s*jam\b/i.test(title)) continue

    const geo = e.geo_address_info
    const locationRaw = place(geo)

    // More aggressive format detection:
    // - explicit offline → in_person
    // - any useful geo data → in_person (most Luma in-person events land here)
    // - explicit online → online
    // - otherwise fall back to online only if nothing location-like exists
    let format: 'online' | 'in_person' = 'online'
    if (e.location_type === 'offline' || hasUsefulGeo(geo) || locationRaw) {
      format = 'in_person'
    } else if (e.location_type === 'online') {
      format = 'online'
    }

    rows.push({
      source: 'luma',
      source_id: str(e.api_id),
      title,
      url: `https://lu.ma/${slug}`,
      starts_at: toISO(e.start_at),
      ends_at: toISO(e.end_at),
      location_raw: locationRaw,
      format,
      prize_pool: null,
      themes: [],
    })
  }
  return rows
}

export async function fetchLuma(): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  const seen = new Set<string>()
  let cursor: string | null = null
  let pages = 0

  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({ query: QUERY })
    if (cursor) params.set('pagination_cursor', cursor)
    const res = await fetch(`${API}?${params.toString()}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) {
      // A first-page failure is fatal (nothing gathered); later pages degrade
      // to whatever we already have rather than throwing away a good crawl.
      if (i === 0) throw new Error(`luma -> ${res.status}`)
      break
    }
    const page = (await res.json()) as LumaPage
    if (!Array.isArray(page.entries)) {
      if (i === 0) throw new Error(`luma: expected entries[], got ${typeof page.entries}`)
      break
    }
    pages++
    for (const row of parseLumaPage(page)) {
      if (seen.has(row.url)) continue
      seen.add(row.url)
      rows.push(row)
    }
    cursor = str(page.next_cursor)
    if (!page.has_more || !cursor) break
  }

  if (rows.length === 0) {
    throw new Error(`luma: 0 hackathons mapped across ${pages} page(s) — feed shape or query drifted?`)
  }
  return rows
}
