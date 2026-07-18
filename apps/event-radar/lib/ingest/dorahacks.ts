import type { IngestRow } from './devpost'

// DoraHacks — the largest web3 hackathon platform (global, frequent bounties
// and travel/grant support). Public JSON API used by their own site:
//   https://dorahacks.io/api/hackathon/?page=1&page_size=24&status=<status>
// We pull both `upcoming` and `ongoing`. Response is `results[]` with a `next`
// URL for pagination; `start_time`/`end_time` are unix epoch SECONDS, and the
// public event page is https://dorahacks.io/hackathon/<uname>/detail.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://dorahacks.io/api/hackathon/'
const STATUSES = ['upcoming', 'ongoing'] as const
const MAX_PAGES_PER_STATUS = 3

type JsonObject = Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function asObject(v: unknown): JsonObject {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {}
}

// start_time/end_time are unix epoch seconds. Guard against a millisecond value
// (> ~ year 2286 in seconds) so a units change doesn't silently produce dates
// far in the future.
function epochToISO(v: unknown): string | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n > 1e12 ? n : n * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function toThemes(field: unknown): string[] {
  if (Array.isArray(field)) return field.map((f) => str(f)).filter((f): f is string => f !== null)
  const single = str(field)
  return single ? [single] : []
}

export function parseDoraHacks(results: unknown[]): IngestRow[] {
  const rows: IngestRow[] = []
  const seen = new Set<string>()
  for (const raw of results) {
    const item = asObject(raw)
    const title = str(item.title)
    const uname = str(item.uname)
    if (!title || !uname) continue
    if (seen.has(uname)) continue
    seen.add(uname)

    const venue = str(item.venue_name)
    rows.push({
      source: 'dorahacks',
      source_id: item.id !== undefined && item.id !== null ? String(item.id) : uname,
      title,
      url: `https://dorahacks.io/hackathon/${uname}/detail`,
      starts_at: epochToISO(item.start_time),
      ends_at: epochToISO(item.end_time),
      location_raw: venue,
      format: item.participation_form === 'Virtual' ? 'online' : venue ? 'in_person' : null,
      prize_pool: null,
      themes: toThemes(item.field),
    })
  }
  return rows
}

export async function fetchDoraHacks(): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  let sawItems = false

  for (const status of STATUSES) {
    let url: string | null = `${BASE}?page=1&page_size=24&status=${status}`
    let page = 0
    while (url && page < MAX_PAGES_PER_STATUS) {
      page++
      const res: Response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`dorahacks ${status} page ${page} -> ${res.status}`)

      const body = (await res.json()) as { results?: unknown[]; next?: unknown }
      const items = body.results
      if (!Array.isArray(items)) {
        throw new Error(
          `dorahacks ${status} page ${page}: expected results[] array, got ${typeof items} ` +
            `(top keys: ${Object.keys(body ?? {}).slice(0, 8).join(',')})`
        )
      }
      if (items.length > 0) sawItems = true
      rows.push(...parseDoraHacks(items))
      url = str(body.next)
    }
  }

  if (rows.length === 0) {
    throw new Error(
      `dorahacks: 0 events mapped (sawItems=${sawItems}) — field names (title/uname) drifted?`
    )
  }
  return rows
}
