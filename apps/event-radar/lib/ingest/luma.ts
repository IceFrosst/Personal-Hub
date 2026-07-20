import type { IngestRow } from './devpost'
import { LUMA_BALTIC_PL_QUERIES } from '@/lib/region-baltic'
import { LUMA_BATCH1_QUERIES } from '@/lib/region-priority-batch1'
import { LUMA_BATCH2_QUERIES } from '@/lib/region-priority-batch2'

// Luma public discovery API — multi-query crawl for global + regional coverage.

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const API = 'https://api.lu.ma/discover/get-paginated-events'

const QUERIES = [
  'hackathon',
  'hackathon Singapore',
  'hackathon "Hong Kong"',
  'hackathon London',
  'hackathon Paris',
  'hackathon "San Francisco"',
  'buildathon',
  'Junction hackathon',
  ...LUMA_BALTIC_PL_QUERIES,
  ...LUMA_BATCH1_QUERIES,
  ...LUMA_BATCH2_QUERIES,
] as const

const PAGES_PER_QUERY = 2

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

export function parseLumaPage(page: LumaPage): IngestRow[] {
  const rows: IngestRow[] = []
  for (const entry of page.entries ?? []) {
    const e = entry.event
    if (!e) continue
    const title = str(e.name)
    const slug = str(e.url)
    if (!title || !slug) continue
    if (!/\bhack|hackathon|hack[- ]?day|hack[- ]?night|game\s*jam|buildathon|hakaton|häkaton\b/i.test(title))
      continue

    const geo = e.geo_address_info
    const locationRaw = place(geo)

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

async function fetchLumaQuery(query: string, seen: Set<string>): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  let cursor: string | null = null

  for (let i = 0; i < PAGES_PER_QUERY; i++) {
    const params = new URLSearchParams({ query })
    if (cursor) params.set('pagination_cursor', cursor)
    let res: Response
    try {
      res = await fetch(`${API}?${params.toString()}`, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      })
    } catch {
      break
    }
    if (!res.ok) {
      if (i === 0 && query === 'hackathon') throw new Error(`luma -> ${res.status}`)
      break
    }
    const page = (await res.json()) as LumaPage
    if (!Array.isArray(page.entries)) break
    for (const row of parseLumaPage(page)) {
      if (seen.has(row.url)) continue
      seen.add(row.url)
      rows.push(row)
    }
    cursor = str(page.next_cursor)
    if (!page.has_more || !cursor) break
  }
  return rows
}

export async function fetchLuma(): Promise<IngestRow[]> {
  const seen = new Set<string>()
  const rows: IngestRow[] = []

  const primary = await fetchLumaQuery('hackathon', seen)
  rows.push(...primary)

  const unique = [...new Set(QUERIES.filter((q) => q !== 'hackathon'))]

  for (const q of unique) {
    try {
      const batch = await fetchLumaQuery(q, seen)
      rows.push(...batch)
    } catch {
      /* non-primary failure non-fatal */
    }
  }

  if (rows.length === 0) {
    throw new Error('luma: 0 hackathons mapped — feed shape or query drifted?')
  }
  return rows
}
