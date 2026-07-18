import type { IngestRow } from './devpost'

// Unstop (formerly Dare2Compete) — huge India-plus-global catalog of student /
// early-career hackathons, many open to business students (which the ranking
// rewards). Public JSON API used by their own site:
//   https://unstop.com/api/public/opportunity/search-result
//     ?opportunity=hackathons&oppstatus=open&page=N
// The payload nests as data.data.data[] with data.data.next_page_url for
// pagination. `seo_url` is the full public event URL; `regnRequirements`
// carries the exact registration window (start/end), so — like ETHGlobal — we
// pass a real registration_deadline up front instead of leaving it for
// enrichment to guess.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://unstop.com/api/public/opportunity/search-result'
const MAX_PAGES = 3

type JsonObject = Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function asObject(v: unknown): JsonObject {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {}
}

// Unstop's `region` is "online" / "offline" (sometimes "onground"); map it onto
// the shared format vocabulary. Anything unrecognised stays null ("unknown").
function toFormat(region: string | null): IngestRow['format'] {
  if (!region) return null
  const r = region.toLowerCase()
  if (r === 'online') return 'online'
  if (r === 'offline' || r === 'onground' || r === 'on ground') return 'in_person'
  if (r === 'hybrid') return 'hybrid'
  return null
}

// Compact prize summary from the first cash prize (rank 1 in practice). The
// currency arrives as an icon class name ("fa-rupee-sign", …), not a symbol.
function toPrize(prizes: unknown): string | null {
  if (!Array.isArray(prizes)) return null
  for (const raw of prizes) {
    const p = asObject(raw)
    const cash = str(p.cash)
    if (!cash) continue
    const icon = (str(p.currency) ?? '').toLowerCase()
    const symbol = icon.includes('rupee')
      ? '₹'
      : icon.includes('dollar')
        ? '$'
        : icon.includes('euro')
          ? '€'
          : ''
    return `${symbol}${cash}`.trim() || null
  }
  return null
}

function toLocation(addr: unknown): string | null {
  const a = asObject(addr)
  const parts = [str(a.address), str(a.city), str(a.state)]
  const country = str(asObject(a.country).name)
  if (country) parts.push(country)
  const joined = parts.filter(Boolean).join(', ')
  return joined || null
}

function toThemes(filters: unknown): string[] {
  if (!Array.isArray(filters)) return []
  return filters
    .map((raw) => asObject(raw))
    .filter((f) => str(f.type) === 'category')
    .map((f) => str(f.name))
    .filter((name): name is string => name !== null)
}

export function parseUnstop(items: unknown[]): IngestRow[] {
  const rows: IngestRow[] = []
  for (const raw of items) {
    const item = asObject(raw)
    const title = str(item.title)
    let url = str(item.seo_url)
    if (!title || !url) continue
    if (!/^https?:\/\//i.test(url)) url = `https://unstop.com/${url.replace(/^\/+/, '')}`

    const reg = asObject(item.regnRequirements)
    const starts = toISO(item.start_date) ?? toISO(reg.start_regn_dt)
    const ends = toISO(item.end_date) ?? toISO(reg.end_regn_dt)

    rows.push({
      source: 'unstop',
      source_id: item.id !== undefined && item.id !== null ? String(item.id) : null,
      title,
      url,
      starts_at: starts,
      ends_at: ends,
      location_raw: toLocation(item.address_with_country_logo),
      format: toFormat(str(item.region)),
      prize_pool: toPrize(item.prizes),
      registration_deadline: toISO(reg.end_regn_dt),
      themes: toThemes(item.filters),
    })
  }
  return rows
}

export async function fetchUnstop(): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  let sawItems = false

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${BASE}?opportunity=hackathons&oppstatus=open&page=${page}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`unstop page ${page} -> ${res.status}`)

    const body = (await res.json()) as { data?: { data?: unknown[]; next_page_url?: unknown } }
    const items = body.data?.data
    if (!Array.isArray(items)) {
      throw new Error(
        `unstop page ${page}: expected data.data[] array, got ${typeof items} (top keys: ${Object.keys(
          body ?? {}
        )
          .slice(0, 8)
          .join(',')})`
      )
    }
    if (items.length > 0) sawItems = true
    rows.push(...parseUnstop(items))
    if (!str(body.data?.next_page_url)) break
  }

  if (rows.length === 0) {
    throw new Error(
      `unstop: 0 events mapped (sawItems=${sawItems}) — field names (title/seo_url) drifted?`
    )
  }
  return rows
}
