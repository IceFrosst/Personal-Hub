import type { IngestRow } from './devpost'

// DoraHacks — the largest web3/global hackathon platform (BUIDL). Its Django REST
// list API (`/api/hackathon/`) sits behind an AWS WAF that intermittently demands a
// JS-solved `aws-waf-token` cookie a server can't produce. Sending a `Referer` is
// the reliable tell that raises the pass rate, but it's still opportunistic: when
// the WAF challenges (HTTP 405 + an HTML "Human Verification" body) we keep whatever
// pages already came back rather than throwing the run away. One clean page is ~50
// hackathons; a fully-blocked run surfaces as a per-source error in the cron report.
//
// Timestamps are Unix seconds. There's no distinct registration-deadline field
// (BUIDL hackathons accept submissions until they end), so the deadline is `end_time`
// and the start is `start_time`; past events (end_time already gone) are dropped so
// the catalog and the enrichment backlog only ever carry live/upcoming rows.

const API = 'https://dorahacks.io/api/hackathon/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const PAGE_SIZE = 50
const MAX_PAGES = 4

type DoraOrg = { name?: string | null } | null

type DoraHackathon = {
  id?: number | null
  title?: string | null
  uname?: string | null
  start_time?: number | null
  end_time?: number | null
  participation_form?: string | null
  venue_name?: string | null
  venue_address?: string | null
  organization?: DoraOrg
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

const isoFromUnix = (v: unknown): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? new Date(v * 1000).toISOString() : null

function mapFormat(form: string | null, hasVenue: boolean): IngestRow['format'] {
  const f = (form ?? '').toLowerCase()
  if (f.includes('virtual') || f.includes('online')) return 'online'
  if (f.includes('hybrid')) return 'hybrid'
  if (f.includes('offline') || f.includes('person') || f.includes('venue') || hasVenue)
    return 'in_person'
  return null
}

// nowSeconds is injectable so the parser is deterministic in tests.
export function parseDoraHackathons(
  results: DoraHackathon[],
  nowSeconds: number = Date.now() / 1000
): IngestRow[] {
  const rows: IngestRow[] = []
  for (const h of results) {
    const id = typeof h.id === 'number' ? h.id : null
    const title = str(h.title)
    if (id === null || !title) continue
    // Drop already-ended events; unknown end_time is kept (enrichment/eligibility decide).
    if (typeof h.end_time === 'number' && h.end_time <= nowSeconds) continue

    const venue = str(h.venue_name) ?? str(h.venue_address)
    const org = str(h.organization?.name)
    const location = venue ?? null

    rows.push({
      source: 'dorahacks',
      source_id: String(id),
      title,
      url: `https://dorahacks.io/hackathon/${id}/detail`,
      starts_at: isoFromUnix(h.start_time),
      ends_at: isoFromUnix(h.end_time),
      location_raw: location ?? org ?? null,
      format: mapFormat(str(h.participation_form), venue !== null),
      prize_pool: null,
      // BUIDL submissions stay open until the hackathon ends.
      registration_deadline: isoFromUnix(h.end_time),
      themes: [],
    })
  }
  return rows
}

export async function fetchDoraHacks(): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: Response
    try {
      res = await fetch(`${API}?page=${page}&page_size=${PAGE_SIZE}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': UA,
          // The WAF pass tell — a request that looks like the SPA's own XHR.
          Referer: 'https://dorahacks.io/hackathon',
        },
        signal: AbortSignal.timeout(9000),
      })
    } catch {
      break // network/timeout — keep what we have
    }

    // WAF challenge (405 + HTML) or any non-JSON: stop, but don't discard prior pages.
    const contentType = res.headers.get('content-type') ?? ''
    if (!res.ok || !contentType.includes('application/json')) {
      if (page === 1) throw new Error(`dorahacks page 1 -> ${res.status} (WAF challenge?)`)
      break
    }

    const body = (await res.json()) as { results?: DoraHackathon[]; next?: string | null }
    const batch = parseDoraHackathons(body.results ?? [])
    for (const row of batch) {
      if (seen.has(row.url)) continue
      seen.add(row.url)
      rows.push(row)
    }
    if (!body.next || (body.results?.length ?? 0) === 0) break
  }

  return rows
}
