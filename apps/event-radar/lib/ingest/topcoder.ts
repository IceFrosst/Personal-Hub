import type { IngestRow } from './devpost'

// Topcoder v5 Challenges API — public JSON when reachable from production egress.
// Interactive sandboxes often get 000; production Vercel usually works.
// We only keep challenge types that look like hackathons / ideathons / sprints,
// not pure SRMs or long-running gigs.

const API = 'https://api.topcoder.com/v5/challenges'
const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'

type TcChallenge = {
  id?: string | number
  name?: string
  type?: string
  track?: string
  status?: string
  startDate?: string
  endDate?: string
  registrationStartDate?: string
  registrationEndDate?: string
  numOfRegistrants?: number
  tags?: string[]
  overview?: { totalPrizes?: number } | null
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

function looksLikeHackathon(c: TcChallenge): boolean {
  const blob = [c.name, c.type, c.track, ...(c.tags ?? [])].filter(Boolean).join(' ').toLowerCase()
  if (/hackathon|buildathon|ideathon|codefest|sprint|hack\b/.test(blob)) return true
  // First2Finish / Challenge with substantial prize often are multi-day builds
  if (/challenge|first2finish|develop/.test(blob) && (c.overview?.totalPrizes ?? 0) >= 1000)
    return true
  return false
}

export function parseTopcoderChallenges(items: TcChallenge[]): IngestRow[] {
  const rows: IngestRow[] = []
  for (const c of items) {
    const id = c.id != null ? String(c.id) : null
    const title = str(c.name)
    if (!id || !title) continue
    if (!looksLikeHackathon(c)) continue
    const status = (c.status ?? '').toLowerCase()
    if (status && !/active|open|draft|new/.test(status)) continue

    const deadline = toISO(c.registrationEndDate) ?? toISO(c.endDate)
    const starts = toISO(c.startDate) ?? toISO(c.registrationStartDate) ?? deadline
    const prize =
      typeof c.overview?.totalPrizes === 'number' && c.overview.totalPrizes > 0
        ? `${c.overview.totalPrizes} USD`
        : null

    rows.push({
      source: 'topcoder',
      source_id: id,
      title,
      url: `https://www.topcoder.com/challenges/${id}`,
      starts_at: starts,
      ends_at: toISO(c.endDate),
      location_raw: null,
      format: 'online',
      prize_pool: prize,
      registration_deadline: deadline,
      themes: (c.tags ?? []).filter((t): t is string => typeof t === 'string').slice(0, 6),
    })
  }
  return rows
}

export async function fetchTopcoder(): Promise<IngestRow[]> {
  const url = `${API}?status=Active&perPage=50&page=1`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`topcoder -> ${res.status}`)
  const body = (await res.json()) as TcChallenge[] | { result?: TcChallenge[] }
  const items = Array.isArray(body) ? body : (body.result ?? [])
  if (!Array.isArray(items)) throw new Error('topcoder: unexpected response shape')
  return parseTopcoderChallenges(items)
}
