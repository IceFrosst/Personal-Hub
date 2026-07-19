import type { IngestRow } from './devpost'

// TAIKAI — EU/web3-heavy hackathon platform and the home of exactly the events
// the ranking rewards: CASSINI (EU space), EUDIS (EU defence), Copernicus, and
// other travel-reimbursing European circuits. Its web app talks to a public
// Prisma-style GraphQL API (https://api.taikai.network/api/graphql) that answers
// anonymously; introspection is disabled but the `challenges` query and the
// `Challenge` fields below are stable.
//
// Two quirks the query works around:
//   - `isClosed` is unreliable (stale 2024/2025 events still report open), so we
//     filter server-side on `endParticipantRegistrationDate > now` instead — that
//     doubles as the registration deadline the fail-closed rule needs.
//   - a hackathon has no single "event start" field; it runs as a list of dated
//     `steps`. We take the first step on/after registration closes as the start
//     (falling back to the deadline itself), and the last step as the end.

const API = 'https://api.taikai.network/api/graphql'
const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'

const QUERY = `query EventRadarHackathons($now: DateTime!) {
  challenges(
    where: { isPublic: { equals: true }, endParticipantRegistrationDate: { gt: $now } }
    orderBy: { endParticipantRegistrationDate: asc }
    perPage: 100
  ) {
    slug
    name
    shortDescription
    endParticipantRegistrationDate
    prize
    prizeCurrency { name }
    organization { slug }
    steps { startDate }
  }
}`

type TaikaiStep = { startDate?: string | null }

export type TaikaiChallenge = {
  slug?: string | null
  name?: string | null
  shortDescription?: string | null
  endParticipantRegistrationDate?: string | null
  prize?: number | null
  prizeCurrency?: { name?: string | null } | null
  organization?: { slug?: string | null } | null
  steps?: TaikaiStep[] | null
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function ms(v: unknown): number | null {
  const s = str(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

export function parseTaikaiChallenges(challenges: TaikaiChallenge[]): IngestRow[] {
  const rows: IngestRow[] = []
  for (const c of challenges) {
    const slug = str(c.slug)
    const orgSlug = str(c.organization?.slug)
    const title = str(c.name)
    const deadlineMs = ms(c.endParticipantRegistrationDate)
    if (!slug || !orgSlug || !title || deadlineMs === null) continue

    const stepMs = (c.steps ?? [])
      .map((s) => ms(s?.startDate))
      .filter((t): t is number => t !== null)
      .sort((a, b) => a - b)

    // First step at/after registration closes = the event start; if the steps
    // don't reach past the deadline, use the deadline itself so the row still
    // carries a valid future start for the eligibility check.
    const startMs = stepMs.find((t) => t >= deadlineMs) ?? deadlineMs
    const endMs = stepMs.length > 0 ? stepMs[stepMs.length - 1] : null

    const prize = typeof c.prize === 'number' && c.prize > 0 ? c.prize : null
    const currency = str(c.prizeCurrency?.name)

    rows.push({
      source: 'taikai',
      source_id: slug,
      title,
      url: `https://taikai.network/en/${orgSlug}/hackathons/${slug}`,
      starts_at: new Date(startMs).toISOString(),
      ends_at: endMs !== null && endMs >= startMs ? new Date(endMs).toISOString() : null,
      location_raw: null,
      format: null,
      prize_pool: prize !== null ? `${prize}${currency ? ` ${currency}` : ''}` : null,
      registration_deadline: new Date(deadlineMs).toISOString(),
      themes: [],
    })
  }
  return rows
}

export async function fetchTaikai(): Promise<IngestRow[]> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ query: QUERY, variables: { now: new Date().toISOString() } }),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`taikai -> ${res.status}`)
  const body = (await res.json()) as {
    data?: { challenges?: TaikaiChallenge[] | null }
    errors?: { message?: string }[]
  }
  if (body.errors?.length) {
    throw new Error(`taikai graphql: ${body.errors.map((e) => e.message).join('; ')}`)
  }
  return parseTaikaiChallenges(body.data?.challenges ?? [])
}
