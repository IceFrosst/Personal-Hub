import type { Hackathon } from './types'

/**
 * Western / southern / south-eastern Europe — the block the region packs never
 * covered.
 *
 * Before this file, France had exactly one bare "hackathon Paris" query and
 * Spain, Portugal, Greece, Malta, Ireland, Switzerland, Romania, Bulgaria and
 * the Balkans had nothing at all — despite every one of them being a short,
 * cheap flight from Vilnius.
 *
 * Measured from open egress on 2026-07-26 rather than assumed. The `yield`
 * notes below are future in-person hackathons returned by that query on the
 * day, and they are why the list is ordered the way it is. Two caveats worth
 * keeping in mind before pruning anything:
 *
 *   1. Luma rate-limited the probe partway through, so every query from
 *      Croatia onward returned 403 and is genuinely UNMEASURED — a 0 below
 *      means "measured zero", an absent note means "not yet measured".
 *   2. Hackathon scenes are seasonal. A zero in July says little about
 *      November, which is exactly when the big EU student events run.
 *
 * These are cheap to carry now: the sweep rotates through a window
 * (lib/ingest/luma-rotation.ts), so a query joins the rotation rather than
 * pushing another one past the rate limit.
 */

export type CountryPack = {
  id: string
  label: string
  markers: string[]
  lumaQueries: string[]
  organisers: Array<{ id: string; label: string; url: string }>
  notes: string
}

export const EU_WEST_SOUTH: CountryPack[] = [
  {
    id: 'france',
    label: 'France',
    markers: [
      'france',
      'french',
      'paris',
      'lyon',
      'toulouse',
      'nantes',
      'lille',
      'marseille',
      'grenoble',
      'bordeaux',
      'sophia antipolis',
      'station f',
    ],
    // yield: Paris 2, France 1, Station F 1 — the strongest gap that was open.
    lumaQueries: [
      'hackathon Paris',
      'hackathon France',
      'hackathon Station F',
      'hackathon Lyon',
      'hackathon Toulouse',
      'hackathon Nantes',
      'hackathon Lille',
      'hackathon Grenoble',
    ],
    organisers: [
      { id: 'station-f', label: 'Station F', url: 'https://stationf.co/events' },
      { id: 'hello-tomorrow', label: 'Hello Tomorrow', url: 'https://hello-tomorrow.org/' },
      { id: 'vivatech', label: 'VivaTech', url: 'https://vivatechnology.com/' },
    ],
    notes:
      'Densest untapped EU scene. Paris/Station F both returned live events on the probe day.',
  },
  {
    id: 'spain',
    label: 'Spain',
    markers: [
      'spain',
      'spanish',
      'españa',
      'barcelona',
      'madrid',
      'valencia',
      'bilbao',
      'sevilla',
      'seville',
      'catalonia',
    ],
    // yield: Spain 1, Barcelona 1. HackUPC (Barcelona) is Tier A with a
    // verified EU-inclusive travel policy — the single best-value EU circuit
    // in the registry, and it only reached the catalog via a hand seed.
    lumaQueries: [
      'hackathon Barcelona',
      'hackathon Spain',
      'hackathon Madrid',
      'hackathon Valencia',
      'hackathon Bilbao',
    ],
    organisers: [
      { id: 'hackupc', label: 'HackUPC', url: 'https://hackupc.com/' },
      { id: 'hackeps', label: 'HackEPS', url: 'https://hackeps.com/' },
      { id: '4yfn', label: '4YFN / MWC Barcelona', url: 'https://www.4yfn.com/' },
    ],
    notes: 'HackUPC pays half of travel, up to €120 from Europe — verified 2026-07-26.',
  },
  {
    id: 'portugal',
    label: 'Portugal',
    markers: ['portugal', 'portuguese', 'lisbon', 'lisboa', 'porto', 'braga', 'coimbra'],
    // yield: Lisbon 2. Taikai (already an ingest source) is Portuguese, so
    // some of this scene arrives that way too.
    lumaQueries: [
      'hackathon Lisbon',
      'hackathon Portugal',
      'hackathon Porto',
      'hackathon Lisboa',
      'hackathon Braga',
    ],
    organisers: [
      { id: 'websummit', label: 'Web Summit Lisbon', url: 'https://websummit.com/' },
      { id: 'taikai-pt', label: 'TAIKAI', url: 'https://taikai.network/' },
    ],
    notes: 'Web Summit week draws satellite hackathons; TAIKAI source already covers some.',
  },
  {
    id: 'ireland',
    label: 'Ireland',
    markers: ['ireland', 'irish', 'dublin', 'cork', 'galway', 'limerick'],
    // yield: Ireland 3, Dublin 2, Galway 1 — the best measured yield of the
    // whole probe, and it had zero coverage before.
    lumaQueries: [
      'hackathon Ireland',
      'hackathon Dublin',
      'hackathon Galway',
      'hackathon Cork',
    ],
    organisers: [
      { id: 'dogpatch', label: 'Dogpatch Labs', url: 'https://dogpatchlabs.com/' },
      { id: 'patch', label: 'Patch', url: 'https://patch.ie/' },
    ],
    notes: 'Highest measured yield of any newly probed country.',
  },
  {
    id: 'switzerland',
    label: 'Switzerland',
    markers: [
      'switzerland',
      'swiss',
      'zurich',
      'zürich',
      'lausanne',
      'geneva',
      'genève',
      'basel',
      'bern',
      'epfl',
      'eth zurich',
    ],
    // yield: Switzerland 2, Zurich 1, Zürich 1. Note HackZurich itself is on
    // hiatus (confirmed again by this probe: "HackZurich is taking a break"),
    // so the yield here is other organisers — worth having.
    lumaQueries: [
      'hackathon Switzerland',
      'hackathon Zurich',
      'hackathon Zürich',
      'hackathon Lausanne',
      'hackathon Geneva',
      'hackathon EPFL',
    ],
    organisers: [
      { id: 'lauzhack', label: 'LauzHack (EPFL)', url: 'https://lauzhack.com/' },
      { id: 'starthack', label: 'START Hack', url: 'https://www.startglobal.org/start-hack/' },
    ],
    notes:
      'HackZurich confirmed still on hiatus. START Hack is already a known seed; LauzHack 403s automated requests.',
  },
  {
    id: 'greece-cyprus-malta',
    label: 'Greece · Cyprus · Malta',
    markers: [
      'greece',
      'greek',
      'athens',
      'thessaloniki',
      'patras',
      'heraklion',
      'cyprus',
      'nicosia',
      'limassol',
      'malta',
      'valletta',
      'msida',
    ],
    // yield: measured 0 for all of these on the probe day. Kept because the
    // cost is a rotation slot and the Mediterranean student calendar runs in
    // spring/autumn, not July.
    lumaQueries: [
      'hackathon Athens',
      'hackathon Greece',
      'hackathon Thessaloniki',
      'hackathon Malta',
      'hackathon Cyprus',
    ],
    organisers: [
      { id: 'ahead-gr', label: 'Ahead by Eurobank', url: 'https://www.ahead.gr/' },
      { id: 'mita-malta', label: 'MITA Malta', url: 'https://mita.gov.mt/' },
    ],
    notes:
      'Measured zero in July. Malta is small enough that its events surface mainly through Eventbrite/Facebook, neither of which is ingestable.',
  },
  {
    id: 'romania-bulgaria',
    label: 'Romania · Bulgaria',
    markers: [
      'romania',
      'romanian',
      'bucharest',
      'bucuresti',
      'cluj',
      'timisoara',
      'iasi',
      'bulgaria',
      'sofia',
      'plovdiv',
      'varna',
    ],
    // yield: measured 0. Innovation Labs (RO) is a large national programme
    // and reachable, but renders no structured event list.
    lumaQueries: [
      'hackathon Bucharest',
      'hackathon Romania',
      'hackathon Cluj',
      'hackathon Sofia',
      'hackathon Bulgaria',
    ],
    organisers: [
      { id: 'innovationlabs-ro', label: 'Innovation Labs', url: 'https://www.innovationlabs.ro/' },
    ],
    notes: 'Innovation Labs reachable but only 34 words of server-rendered text.',
  },
  {
    id: 'balkans-adriatic',
    label: 'Balkans · Adriatic · Slovakia',
    markers: [
      'croatia',
      'zagreb',
      'split',
      'rijeka',
      'slovenia',
      'ljubljana',
      'maribor',
      'slovakia',
      'bratislava',
      'kosice',
      'košice',
      'serbia',
      'belgrade',
      'beograd',
      'novi sad',
    ],
    // UNMEASURED — Luma had started rate-limiting the probe by the time these
    // ran, so all of them returned 403. Do not read that as zero.
    // Hack Kosice is a Tier A circuit already in the travel registry, which is
    // reason enough to query its region.
    lumaQueries: [
      'hackathon Kosice',
      'hackathon Bratislava',
      'hackathon Zagreb',
      'hackathon Ljubljana',
      'hackathon Belgrade',
      'hackathon Novi Sad',
    ],
    organisers: [
      { id: 'hackkosice', label: 'Hack Kosice', url: 'https://www.hackkosice.com/' },
    ],
    notes: 'Unmeasured — probe was rate-limited before reaching these. Hack Kosice is Tier A.',
  },
  {
    id: 'small-states',
    label: 'Luxembourg · Iceland',
    markers: ['luxembourg', 'iceland', 'reykjavik', 'reykjavík'],
    // UNMEASURED — same 403 window as the Balkans block.
    lumaQueries: ['hackathon Luxembourg', 'hackathon Reykjavik'],
    organisers: [],
    notes: 'Unmeasured. Small scenes; low expectation, negligible cost in a rotation.',
  },
]

export const LUMA_EU_WEST_SOUTH_QUERIES: string[] = EU_WEST_SOUTH.flatMap((p) => p.lumaQueries)

export const EU_WEST_SOUTH_ORGANISERS = EU_WEST_SOUTH.flatMap((p) =>
  p.organisers.map((o) => ({ ...o, country: p.id }))
)

const ALL_MARKERS = EU_WEST_SOUTH.flatMap((p) => p.markers)

export function isEuWestSouth(
  h: Pick<Hackathon, 'country' | 'city' | 'location_raw' | 'title' | 'themes'>
): boolean {
  const hay =
    `${h.country ?? ''} ${h.city ?? ''} ${h.location_raw ?? ''} ${h.title ?? ''} ${(h.themes ?? []).join(' ')}`.toLowerCase()
  return ALL_MARKERS.some((m) => hay.includes(m))
}
