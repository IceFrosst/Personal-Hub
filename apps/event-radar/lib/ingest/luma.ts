import type { IngestRow } from './devpost'
import { LUMA_BALTIC_PL_QUERIES } from '@/lib/region-baltic'
import { LUMA_BATCH1_QUERIES } from '@/lib/region-priority-batch1'
import { LUMA_BATCH2_QUERIES } from '@/lib/region-priority-batch2'
import { LUMA_BATCH3_QUERIES } from '@/lib/region-priority-batch3'
import { LUMA_BATCH4_QUERIES } from '@/lib/region-priority-batch4'
import { LUMA_TURKEY_QUERIES } from '@/lib/region-turkey'
import { LUMA_EU_WEST_SOUTH_QUERIES } from '@/lib/region-eu-west-south'
import { selectQueryWindow } from './luma-rotation'

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const API = 'https://api.lu.ma/discover/get-paginated-events'

const QUERIES = [
  'hackathon',
  'hackathon Singapore',
  'hackathon "Hong Kong"',
  'hackathon Paris',
  'hackathon "San Francisco"',
  'buildathon',
  'Junction hackathon',
  ...LUMA_BALTIC_PL_QUERIES,
  ...LUMA_BATCH1_QUERIES,
  ...LUMA_BATCH2_QUERIES,
  ...LUMA_BATCH3_QUERIES,
  ...LUMA_BATCH4_QUERIES,
  ...LUMA_TURKEY_QUERIES,
  ...LUMA_EU_WEST_SOUTH_QUERIES,
] as const

/**
 * Page budget for a *rotation* query. Measured 2026-08-04: every city/region
 * query in the list exhausts on page 1 (`has_more=false`) — Berlin 10 entries,
 * London 20, Vilnius 1, Paris 2 — so this ceiling never actually binds for them
 * and raising it would buy nothing while costing request budget.
 */
const PAGES_PER_QUERY = 2

/**
 * Page budget for the always-run primary `hackathon` query, which is a
 * different animal: the same probe walked it to **7 pages / 290 entries**, and
 * `has_more` was still true at page 2. So the old shared cap of 2 was reading
 * roughly a quarter of the single most productive query in the sweep, on every
 * single run — the Devpost bug again, in the one place it costs most.
 *
 * Set above the measured depth so the feed's own `has_more` ends the walk, not
 * this number. The extra requests are only ever spent when there is genuinely
 * more to read, and they are the best-value requests in the sweep: the primary
 * returns hundreds of events where a city query returns one or two.
 *
 * Budget note: this adds ~5 requests to a sweep that starts hitting Luma's
 * limiter around 40. If that pushes the tail of the rotation window into a 403,
 * the rotation is precisely what absorbs it — those queries run on the next
 * sweep instead. Watch `luma_queries.blocked` in the cron report; if it climbs,
 * lower LUMA_WINDOW rather than this.
 */
const PRIMARY_PAGES = 10

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Counters for one sweep, so a rate-limit wall shows up in the cron report. */
export type LumaSweepStats = { ok: number; blocked: number; failed: number }

async function fetchLumaQuery(
  query: string,
  seen: Set<string>,
  stats: LumaSweepStats,
  maxPages: number = PAGES_PER_QUERY
): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  let cursor: string | null = null

  for (let i = 0; i < maxPages; i++) {
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
      stats.failed++
      break
    }
    if (!res.ok) {
      if (i === 0 && query === 'hackathon') throw new Error(`luma -> ${res.status}`)
      // 403/429 is the rate limiter, not an empty result. Counting it separately
      // is the whole point — this used to look identical to "no more pages",
      // which is how ~two thirds of the query list went missing unnoticed.
      if (res.status === 403 || res.status === 429) stats.blocked++
      else stats.failed++
      break
    }
    stats.ok++
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

/** Gap between requests. Enough to stay under the limiter, cheap enough for the budget. */
const REQUEST_GAP_MS = 250
/** Consecutive rate-limited queries after which the sweep gives up for this run. */
const BLOCKED_STREAK_LIMIT = 5

export const lastSweepStats: LumaSweepStats = { ok: 0, blocked: 0, failed: 0 }

export async function fetchLuma(): Promise<IngestRow[]> {
  const seen = new Set<string>()
  const rows: IngestRow[] = []
  const stats: LumaSweepStats = { ok: 0, blocked: 0, failed: 0 }

  const primary = await fetchLumaQuery('hackathon', seen, stats, PRIMARY_PAGES)
  rows.push(...primary)

  // Rotate through the list instead of firing all 108 at once — see
  // luma-rotation.ts for why the tail of this list was never actually running.
  const unique = [...new Set(QUERIES.filter((q) => q !== 'hackathon'))]
  const window = selectQueryWindow(unique)

  let blockedStreak = 0
  for (const q of window) {
    await sleep(REQUEST_GAP_MS)
    const before = stats.blocked
    try {
      const batch = await fetchLumaQuery(q, seen, stats)
      rows.push(...batch)
    } catch {
      /* non-primary failure non-fatal */
    }
    // Once the limiter is on us, every further request is wasted time inside a
    // 50s budget — stop and let the next run's window pick up the rest.
    blockedStreak = stats.blocked > before ? blockedStreak + 1 : 0
    if (blockedStreak >= BLOCKED_STREAK_LIMIT) break
  }

  Object.assign(lastSweepStats, stats)

  if (rows.length === 0) {
    throw new Error(
      `luma: 0 hackathons mapped (queries ok=${stats.ok} blocked=${stats.blocked} ` +
        `failed=${stats.failed}) — rate limited, or feed shape drifted?`
    )
  }
  return rows
}
