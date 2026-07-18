import type { IngestRow } from './devpost'

// HackQuest — a large web3/AI hackathon platform (global, Asia-heavy: 0G, Mantle,
// MetaMask, Bittensor, …). Public GraphQL at api.hackquest.io answers anonymously.
// `hackathons(filter){ total data }` returns the whole catalog (~111) in one call,
// so we fetch all and drop the past ones in the parser.
//
// Like Unstop, there's no distinct "event start" — a HackQuest hackathon is a
// register→submit window — so `starts_at` is proxied from the registration deadline
// (`registrationClose`) to satisfy the fail-closed future-start rule. No location/
// mode field is exposed, so `format` is left for enrichment to decide.

const API = 'https://api.hackquest.io/graphql'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36'

const QUERY = `query EventRadarHackathons($filter: HackathonSearchFilter!) {
  hackathons(filter: $filter) {
    data {
      id
      name
      alias
      status
      timeline { registrationClose submissionClose }
    }
  }
}`

type HackQuestTimeline = {
  registrationClose?: string | null
  submissionClose?: string | null
}

export type HackQuestHackathon = {
  id?: string | null
  name?: string | null
  alias?: string | null
  status?: string | null
  timeline?: HackQuestTimeline | null
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function ms(v: unknown): number | null {
  const s = str(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

export function parseHackQuest(
  hackathons: HackQuestHackathon[],
  now: number = Date.now()
): IngestRow[] {
  const rows: IngestRow[] = []
  for (const h of hackathons) {
    if (str(h.status) !== 'publish') continue
    const alias = str(h.alias)
    const title = str(h.name)
    const deadlineMs = ms(h.timeline?.registrationClose)
    // Drop entries with no registration deadline or one already in the past —
    // they can't be joined and would only clog the catalog + enrichment backlog.
    if (!alias || !title || deadlineMs === null || deadlineMs <= now) continue

    const submitMs = ms(h.timeline?.submissionClose)
    rows.push({
      source: 'hackquest',
      source_id: str(h.id) ?? alias,
      title,
      url: `https://www.hackquest.io/hackathon/${alias}`,
      // No real event-start field — proxy it from the registration deadline.
      starts_at: new Date(deadlineMs).toISOString(),
      ends_at: submitMs !== null && submitMs > deadlineMs ? new Date(submitMs).toISOString() : null,
      location_raw: null,
      format: null,
      prize_pool: null,
      registration_deadline: new Date(deadlineMs).toISOString(),
      themes: [],
    })
  }
  return rows
}

export async function fetchHackQuest(): Promise<IngestRow[]> {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': UA,
      // api.hackquest.io fronts a WAF that rejects header-thin requests; look like
      // the site's own browser call to clear it.
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://www.hackquest.io',
      Referer: 'https://www.hackquest.io/',
    },
    body: JSON.stringify({ query: QUERY, variables: { filter: {} } }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`hackquest -> ${res.status}`)
  const body = (await res.json()) as {
    data?: { hackathons?: { data?: HackQuestHackathon[] | null } | null }
    errors?: { message?: string }[]
  }
  if (body.errors?.length) {
    throw new Error(`hackquest graphql: ${body.errors.map((e) => e.message).join('; ')}`)
  }
  return parseHackQuest(body.data?.hackathons?.data ?? [])
}
