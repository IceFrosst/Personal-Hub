import type { IngestRow } from './devpost'

// Unstop — a very large India/global opportunities platform. Its public search API
// (`/api/public/opportunity/search-result?opportunity=hackathons`) exposes ~6000
// all-time hackathons; passing `oppstatus=open` narrows it to the set with
// registration currently open (~90), which is exactly the actionable slice and keeps
// the catalog + enrichment backlog bounded.
//
// Caveat baked into the mapping: Unstop items carry no event start date (only a
// submission `end_date` and a registration window). The fail-closed eligibility rule
// needs a future start, so `starts_at` is proxied from the registration deadline
// (`end_regn_dt`) — a hackathon's event effectively kicks off around when
// registration closes. `ends_at` uses the real `end_date`. `region` (not the always
// "online_coding_challenge" `subtype`) is the real online/offline signal.

const API = 'https://unstop.com/api/public/opportunity/search-result'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const PER_PAGE = 100
const MAX_PAGES = 3

type UnstopRegn = {
  end_regn_dt?: string | null
} | null

type UnstopItem = {
  id?: number | null
  title?: string | null
  seo_url?: string | null
  public_url?: string | null
  region?: string | null
  regn_open?: number | null
  end_date?: string | null
  regnRequirements?: UnstopRegn
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

function mapFormat(region: string | null): IngestRow['format'] {
  const r = (region ?? '').toLowerCase()
  if (r === 'online') return 'online'
  if (r === 'offline') return 'in_person'
  if (r.includes('hybrid')) return 'hybrid'
  return null
}

export function parseUnstopItems(items: UnstopItem[]): IngestRow[] {
  const rows: IngestRow[] = []
  for (const it of items) {
    const title = str(it.title)
    const url = str(it.seo_url) ?? (str(it.public_url) ? `https://unstop.com/${it.public_url}` : null)
    if (!title || !url) continue

    const deadline = toISO(it.regnRequirements?.end_regn_dt)

    rows.push({
      source: 'unstop',
      source_id: it.id != null ? String(it.id) : null,
      title,
      url,
      // No real event-start field on Unstop — proxy it from the registration
      // deadline so the row can satisfy the fail-closed future-start rule.
      starts_at: deadline,
      ends_at: toISO(it.end_date),
      location_raw: null,
      format: mapFormat(str(it.region)),
      prize_pool: null,
      registration_deadline: deadline,
      themes: [],
    })
  }
  return rows
}

export async function fetchUnstop(): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${API}?opportunity=hackathons&oppstatus=open&per_page=${PER_PAGE}&page=${page}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) {
      if (page === 1) throw new Error(`unstop page 1 -> ${res.status}`)
      break
    }
    const body = (await res.json()) as { data?: { data?: UnstopItem[]; last_page?: number } }
    const items = body.data?.data ?? []
    if (items.length === 0) break
    for (const row of parseUnstopItems(items)) {
      if (seen.has(row.url)) continue
      seen.add(row.url)
      rows.push(row)
    }
    if (body.data?.last_page && page >= body.data.last_page) break
  }

  return rows
}
