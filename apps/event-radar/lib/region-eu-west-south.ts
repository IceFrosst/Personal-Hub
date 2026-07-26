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
 * Measured from open egress on 2026-07-26 (paced re-run) rather than assumed.
 * Two things that measurement taught us, both of which matter before anyone
 * prunes this list:
 *
 *   1. **Luma's discover search is fuzzy about place.** A query's raw hit count
 *      is NOT evidence that the query works — "hackathon Paris" returned a
 *      London and a Berlin event, "hackathon France" returned one in Argentina,
 *      and "hackathon Lisbon" returned San Francisco and London. Yield notes
 *      below therefore count only hits whose OWN geo matches the region. The
 *      off-target hits are still ingested correctly (the row's location comes
 *      from the event, never from the query), they just prove nothing about
 *      that query.
 *   2. **Hackathon scenes are seasonal.** A zero in July says little about
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
    // yield: 0 on-target. Paris/France/Station F did return hits, but every one
    // was elsewhere (London, Berlin, Mar del Plata) — fuzzy search, not French
    // events. Kept because France is the largest EU scene with no coverage and
    // the cost is one rotation slot; revisit in the autumn.
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
      'Densest untapped EU scene, but every July hit was off-target (fuzzy search). Re-measure in autumn.',
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
    // yield: 1 on-target — AI Summit Hackathon, Barcelona (2026-09-19), found
    // by both "Spain" and "Barcelona". HackUPC (Barcelona) is Tier A with a
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
    // yield: 0 on-target — "Lisbon" matched a San Francisco and a London event.
    // Taikai (already an ingest source) is Portuguese, so some of this scene
    // arrives that way regardless.
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
    notes: 'No on-target July hits; Web Summit week draws satellites, and TAIKAI already covers some.',
  },
  {
    id: 'ireland',
    label: 'Ireland',
    markers: ['ireland', 'irish', 'dublin', 'cork', 'galway', 'limerick'],
    // yield: 3 on-target and all genuinely Irish — GTM Hackathon (Dublin,
    // 2026-08-15), FutureHack (Galway, 2026-08-20), Daytona HackSprint (Dublin,
    // 2026-08-29). The best real yield of the whole probe, from a country that
    // had no coverage at all.
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
    notes: 'Highest real yield of any newly probed country — three genuinely Irish events.',
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
    // yield: 2 on-target — Critical Infrastructure Shield (Winterthur/Zürich,
    // 2026-10-23) and Leukerbad Hackathon (2026-11-14). Note the umlaut matters:
    // "Zürich" found the Winterthur event, plain "Zurich" only returned Berlin.
    // HackZurich itself is still on hiatus ("HackZurich is taking a break"), so
    // this yield is other organisers entirely.
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
    // yield: measured 0, all eight queries. Kept because the cost is a rotation
    // slot and the Mediterranean student calendar runs spring/autumn, not July.
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
    // yield: measured 0 (the paced re-run reached these; the first, unpaced
    // probe had been rate-limited before it got here). Hack Kosice is a Tier A
    // circuit already in the travel registry, which is reason enough to keep
    // querying its region even at zero today.
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
    notes: 'Measured 0 in July. Hack Kosice is Tier A and reachable (285 words).',
  },
  {
    id: 'small-states',
    label: 'Luxembourg · Iceland',
    markers: ['luxembourg', 'iceland', 'reykjavik', 'reykjavík'],
    // yield: measured 0 in the paced re-run.
    lumaQueries: ['hackathon Luxembourg', 'hackathon Reykjavik'],
    organisers: [],
    notes: 'Measured 0. Small scenes; low expectation, negligible cost in a rotation.',
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
