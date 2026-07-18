import type { IngestRow } from './devpost'

// HackQuest — a large Web3/AI hackathon platform (ecosystem-sponsored online
// buildathons: Injective, Arbitrum, 0G, OKX…). No REST API and GraphQL
// introspection is disabled, so we reuse the site's own operation: the
// `getAllHackathonInfo` query (`listHackathons`), lifted verbatim from the
// frontend bundle. Public, no auth. Like ETHGlobal, HackQuest gives an exact
// registration deadline up front (`timeline.registrationClose`), so we pass it
// through instead of leaving it for enrichment to guess.
//
// Detail page: https://www.hackquest.io/hackathon/<alias>.

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const API = 'https://api.hackquest.io/graphql'
const SITE = 'https://www.hackquest.io/hackathon'
const PAGE_LIMIT = 200 // total catalog is ~110; one page covers it.

// Lifted from the HackQuest frontend (operation `getAllHackathonInfo`). Only
// the fields the radar maps are requested.
const QUERY = `query getAllHackathonInfo($page: Int, $limit: Int) {
  listHackathons(page: $page, limit: $limit) {
    total
    data {
      id
      name
      alias
      status
      totalRewards
      info { mode }
      timeline {
        registrationOpen
        registrationClose
        submissionOpen
        submissionClose
        rewardTime
      }
      ecosystem { type }
    }
  }
}`

type HqTimeline = {
  registrationOpen?: string | null
  registrationClose?: string | null
  submissionOpen?: string | null
  submissionClose?: string | null
  rewardTime?: string | null
}

type HqHackathon = {
  id?: string
  name?: string
  alias?: string
  status?: string
  totalRewards?: string | number | null
  info?: { mode?: string | null } | null
  timeline?: HqTimeline | null
  ecosystem?: Array<{ type?: string | null }> | null
}

type HqResponse = {
  data?: { listHackathons?: { total?: number; data?: HqHackathon[] } }
  errors?: Array<{ message?: string }>
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function toFormat(mode: unknown): IngestRow['format'] {
  switch (str(mode)?.toUpperCase()) {
    case 'ONLINE':
      return 'online'
    case 'OFFLINE':
      return 'in_person'
    case 'HYBRID':
      return 'hybrid'
    default:
      return null
  }
}

function toPrize(total: unknown): string | null {
  const n = typeof total === 'number' ? total : Number(str(total))
  if (!Number.isFinite(n) || n <= 0) return null
  return `$${n.toLocaleString('en-US')}`
}

// Pure mapper — a GraphQL response body to IngestRows. Exported for unit tests.
export function parseHackQuest(body: HqResponse): IngestRow[] {
  const list = body.data?.listHackathons?.data
  if (!Array.isArray(list)) return []
  const rows: IngestRow[] = []
  for (const h of list) {
    const title = str(h.name)
    const alias = str(h.alias)
    // Only published hackathons have a real, linkable page.
    if (!title || !alias || str(h.status) !== 'publish') continue
    const t = h.timeline ?? {}
    const themes = (h.ecosystem ?? [])
      .map((e) => str(e?.type))
      .filter((x): x is string => !!x)
    rows.push({
      source: 'hackquest',
      source_id: str(h.id),
      title,
      url: `${SITE}/${alias}`,
      // The event "starts" when building opens; fall back to registration open.
      starts_at: toISO(t.submissionOpen) ?? toISO(t.registrationOpen),
      ends_at: toISO(t.submissionClose) ?? toISO(t.rewardTime),
      location_raw: null, // ecosystem-hosted online events carry no venue
      format: toFormat(h.info?.mode),
      prize_pool: toPrize(h.totalRewards),
      // Source-provided exact signup deadline — enrichment must not overwrite it.
      registration_deadline: toISO(t.registrationClose),
      themes,
    })
  }
  return rows
}

export async function fetchHackQuest(): Promise<IngestRow[]> {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      operationName: 'getAllHackathonInfo',
      query: QUERY,
      variables: { page: 1, limit: PAGE_LIMIT },
    }),
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`hackquest -> ${res.status}`)

  const body = (await res.json()) as HqResponse
  if (body.errors?.length) {
    throw new Error(`hackquest graphql: ${body.errors.map((e) => e.message).join('; ').slice(0, 200)}`)
  }
  if (!Array.isArray(body.data?.listHackathons?.data)) {
    throw new Error('hackquest: listHackathons.data missing — query shape drifted?')
  }

  const rows = parseHackQuest(body)
  if (rows.length === 0) {
    const total = body.data?.listHackathons?.total ?? 0
    throw new Error(`hackquest: 0 hackathons mapped from ${total} total — field names drifted?`)
  }
  return rows
}
