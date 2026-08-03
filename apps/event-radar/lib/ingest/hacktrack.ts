import type { IngestRow } from './devpost'

/**
 * HackTrack EU — a community-run, automatically updated index of European
 * hackathons with a public, no-auth JSON API.
 *
 * Why it matters here: it is the first source with real breadth across the
 * countries the catalog had nothing for. A snapshot of its archive on
 * 2026-07-26 covered 28 European countries — France 52, Switzerland 31,
 * Ireland 11, Romania 6, Bulgaria 4, Croatia 4, Turkey 14, Luxembourg 1,
 * Serbia 1, North Macedonia 1 — against 15 total EU rows the whole 14-source
 * catalog had managed for those same countries.
 *
 * Every other source is either global-with-no-geography (Devpost, MLH,
 * HackQuest…) or needs a per-city query that Luma rate-limits. This one is
 * EU-shaped by construction and answers in a single request.
 *
 * Caveats, both deliberate:
 *   • `?status=upcoming` is frequently near-empty out of season (1 event in
 *     July). That is the European calendar, not a broken feed, so an empty
 *     upcoming list is NOT treated as an error — unlike a malformed response.
 *   • No registration deadline anywhere in the payload, so rows land with
 *     `registration_deadline: null` and wait on enrichment before the
 *     fail-closed feed will show them.
 *
 * Its `url` often points at lu.ma, which means a HackTrack row can collide
 * with a Luma row for the same event. That is fine and in fact desirable —
 * dedupe is by URL alone, so the two converge on one row instead of doubling.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const API = 'https://hacktrack-eu.vercel.app/api/hackathons?status=upcoming'

/**
 * The API returns ISO-3166 alpha-2, but every geography check downstream
 * (`matchesCountry`, the region markers, `travelUsefulForMe`) is a substring
 * test against country NAMES — "FR" would never match "france". Mapping here
 * is what makes these rows scoreable at all.
 */
const COUNTRY_NAMES: Record<string, string> = {
  AL: 'Albania',
  AT: 'Austria',
  BA: 'Bosnia and Herzegovina',
  BE: 'Belgium',
  BG: 'Bulgaria',
  BY: 'Belarus',
  CH: 'Switzerland',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DE: 'Germany',
  DK: 'Denmark',
  EE: 'Estonia',
  ES: 'Spain',
  FI: 'Finland',
  FR: 'France',
  GB: 'United Kingdom',
  GE: 'Georgia',
  GR: 'Greece',
  HR: 'Croatia',
  HU: 'Hungary',
  IE: 'Ireland',
  IS: 'Iceland',
  IT: 'Italy',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MD: 'Moldova',
  ME: 'Montenegro',
  MK: 'North Macedonia',
  MT: 'Malta',
  NL: 'Netherlands',
  NO: 'Norway',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  RS: 'Serbia',
  SE: 'Sweden',
  SI: 'Slovenia',
  SK: 'Slovakia',
  TR: 'Türkiye',
  UA: 'Ukraine',
}

type HackTrackEvent = {
  id?: string
  name?: string
  city?: string | null
  country_code?: string | null
  date_start?: string | null
  date_end?: string | null
  topics?: unknown
  url?: string | null
  notes?: string | null
  status?: string
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** "Zagreb, Croatia" — the shape every geography check downstream expects. */
export function placeOf(city: string | null, code: string | null): string | null {
  const country = code ? (COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase()) : null
  return [city, country].filter(Boolean).join(', ') || null
}

export function parseHackTrack(payload: { data?: HackTrackEvent[] }): IngestRow[] {
  const rows: IngestRow[] = []
  for (const e of payload.data ?? []) {
    const title = str(e.name)
    const url = str(e.url)
    if (!title || !url) continue

    const starts = toISO(e.date_start)
    const ends = toISO(e.date_end)

    const topics = Array.isArray(e.topics)
      ? e.topics.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 6)
      : []

    rows.push({
      source: 'hacktrack',
      source_id: str(e.id),
      title,
      url,
      starts_at: starts,
      ends_at: ends,
      location_raw: placeOf(str(e.city), str(e.country_code)),
      // The index is explicitly a list of physical European hackathons; it
      // carries a city for essentially every entry. Anything with no place at
      // all stays unknown rather than being called in-person.
      format: str(e.city) || str(e.country_code) ? 'in_person' : null,
      prize_pool: null,
      themes: topics,
    })
  }
  return rows
}

export async function fetchHackTrack(): Promise<IngestRow[]> {
  let res: Response
  try {
    res = await fetch(API, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    })
  } catch (err) {
    throw new Error(`hacktrack: fetch failed — ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!res.ok) throw new Error(`hacktrack -> ${res.status}`)

  const payload = (await res.json()) as { data?: HackTrackEvent[] }
  if (!Array.isArray(payload.data)) {
    throw new Error('hacktrack: response has no `data` array — API shape drifted?')
  }

  // A genuinely empty upcoming list is normal off-season and must not throw:
  // an error here would put the whole sweep into the "finished with errors"
  // banner every summer, which is what got Topcoder removed.
  const now = Date.now()
  return parseHackTrack(payload).filter((r) => {
    const start = r.starts_at ? Date.parse(r.starts_at) : NaN
    return Number.isFinite(start) && start > now
  })
}
