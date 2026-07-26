import type { Hackathon } from './types'

/**
 * Turkey / Türkiye.
 *
 * Groundwork, deliberately shipped ahead of any events. The 2026-07-26
 * open-egress probe found the Turkish scene genuinely unindexed rather than
 * merely unreachable: Luma returns 0 entries for Istanbul, Ankara, Turkey and
 * Türkiye alike; hackathon.com says outright there are no upcoming Turkey
 * hackathons; and every Turkish event on tr.allhackathons.com is past. The
 * scene runs through national programmes (TEKNOFEST, TÜBİTAK) and university
 * portals that publish no machine-readable feed.
 *
 * So this file is not a source — it is the geography layer, so that the day a
 * Turkish event does arrive through any existing source it can be matched,
 * scored and filtered instead of landing as an unrecognised string.
 *
 * The spelling matters more here than for other countries: these events label
 * themselves "Türkiye" and "İstanbul", and `matchesCountry` in scoring.ts is a
 * plain lowercase substring test — so a priority_countries entry of "turkey"
 * would never match "Türkiye". TURKEY_ALIASES is what closes that gap.
 */

/** Every spelling a Turkish event might use, including dotted-İ variants. */
export const TURKEY_ALIASES = ['turkey', 'türkiye', 'turkiye', 'türkiyesi'] as const

export const TURKEY_MARKERS = [
  ...TURKEY_ALIASES,
  'turkish',
  'istanbul',
  'i̇stanbul',
  'İstanbul'.toLowerCase(),
  'ankara',
  'izmir',
  'i̇zmir',
  'bursa',
  'antalya',
  'kocaeli',
  'gebze',
  'eskisehir',
  'eskişehir',
  'konya',
  'adana',
  'trabzon',
  'bogazici',
  'boğaziçi',
  'bilkent',
  'teknofest',
  'tübitak',
  'tubitak',
]

export function isTurkey(
  h: Pick<Hackathon, 'country' | 'city' | 'location_raw' | 'title' | 'themes'>
): boolean {
  const hay =
    `${h.country ?? ''} ${h.city ?? ''} ${h.location_raw ?? ''} ${h.title ?? ''} ${(h.themes ?? []).join(' ')}`.toLowerCase()
  return TURKEY_MARKERS.some((m) => hay.includes(m))
}

/**
 * Luma discovery queries. All four returned 0 entries on 2026-07-26 — kept so
 * the net is already cast when the scene does start publishing there, at the
 * cost of four cheap requests per sweep.
 */
export const LUMA_TURKEY_QUERIES = [
  'hackathon Istanbul',
  'hackathon Ankara',
  'hackathon Türkiye',
  'hackathon Izmir',
] as const

/**
 * Where Turkish hackathons are actually announced. None expose a parseable
 * feed, which is why they are a watch list for the monthly probe rather than
 * an ingest source. Reachability is from the 2026-07-26 GitHub-runner probe.
 */
export const TURKEY_ORGANISERS = [
  {
    id: 'teknofest',
    label: 'TEKNOFEST',
    url: 'https://www.teknofest.org/en/competitions/',
    note: 'Largest programme, international tracks. Reachable, but competitions render as nav links with no dates.',
  },
  {
    id: 't3vakfi',
    label: 'T3 Foundation',
    url: 'https://t3vakfi.org/en/',
    note: 'TEKNOFEST organiser. Reachable, 11k words, no structured events.',
  },
  {
    id: 'thy-terminal',
    label: 'Turkish Airlines Terminal',
    url: 'https://terminal.turkishairlines.com/',
    note: 'Runs Travel/Design hackathons. Reachable; latest listed edition is TravelX Ideathon 2024 — nothing upcoming. NOTE: hackathon.turkishairlines.com does not resolve.',
  },
  {
    id: 'tubitak',
    label: 'TÜBİTAK',
    url: 'https://tubitak.gov.tr/en/competitions',
    note: 'Reachable. Competitions are research-project contests for students, not hackathons.',
  },
  {
    id: 'bilisimvadisi',
    label: 'Bilişim Vadisi',
    url: 'https://bilisimvadisi.com.tr/en/events/',
    note: 'Tech park with an events page. Reachable.',
  },
  {
    id: 'itucekirdek',
    label: 'İTÜ Çekirdek',
    url: 'https://itucekirdek.com/etkinlikler/',
    note: 'ITU incubator, Turkish-only events page. Reachable.',
  },
  {
    id: 'kworks',
    label: 'Koç University KWORKS',
    url: 'https://kworks.ku.edu.tr/en/',
    note: 'CloudFront 403s automated requests — needs a human visit.',
  },
  {
    id: 'istanbul-blockchain-week',
    label: 'Istanbul Blockchain Week',
    url: 'https://istanbulblockchainweek.com/',
    note: 'Cloudflare challenge — 403 to automated requests. Side hackathons usually announced on Luma.',
  },
] as const
