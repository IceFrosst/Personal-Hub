import type { Hackathon } from '@/lib/types'

/**
 * Tier A/B circuits with documented travel reimbursement / grants.
 * Used for: circuit prior, FAQ path expansion, feed filter, score boost, card tag.
 *
 * tier A = strong/explicit participant travel support (US flagships)
 * tier B = EU / grants / scholarships (limited or selective)
 */
export type TravelPriorityTier = 'A' | 'B'

export type TravelPriorityCircuit = {
  id: string
  label: string
  tier: TravelPriorityTier
  titlePattern: RegExp
  hostPatterns: RegExp[]
  faqPaths: string[]
  siteUrl: string
  evidence: string
}

export const TRAVEL_PRIORITY: TravelPriorityCircuit[] = [
  // ---- Tier A — US / Canada flagships ----
  {
    id: 'hackmit',
    label: 'HackMIT',
    tier: 'A',
    titlePattern: /\bhack\s*mit\b/i,
    hostPatterns: [/hackmit\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics', '/info'],
    siteUrl: 'https://hackmit.org/',
    evidence: 'All attendees eligible; regional cap; docs required',
  },
  {
    id: 'treehacks',
    label: 'TreeHacks',
    tier: 'A',
    titlePattern: /\btree\s*hacks\b/i,
    hostPatterns: [/treehacks\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://treehacks.com/',
    evidence: 'Meals, travel, lodging for accepted hackers',
  },
  {
    id: 'pennapps',
    label: 'PennApps',
    tier: 'A',
    titlePattern: /\bpenn\s*apps\b/i,
    hostPatterns: [/pennapps\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://pennapps.com/',
    evidence: 'Long history of travel reimbursement',
  },
  {
    id: 'hackthenorth',
    label: 'Hack the North',
    tier: 'A',
    titlePattern: /\bhack\s*the\s*north\b/i,
    hostPatterns: [/hackthenorth\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics', '/info'],
    siteUrl: 'https://hackthenorth.com/',
    evidence: 'Often cited for travel reimbursement',
  },
  {
    id: 'hackillinois',
    label: 'HackIllinois',
    tier: 'A',
    titlePattern: /\bhack\s*illinois\b/i,
    hostPatterns: [/hackillinois\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://www.hackillinois.org/',
    evidence: 'Often listed with reimbursement',
  },
  {
    id: 'calhacks',
    label: 'CalHacks',
    tier: 'A',
    titlePattern: /\bcal\s*hacks\b/i,
    hostPatterns: [/calhacks\.io$/i, /hack\.berkeley\.edu$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://calhacks.io/',
    evidence: 'Sometimes travel support (varies by year)',
  },
  {
    id: 'lahacks',
    label: 'LA Hacks',
    tier: 'A',
    titlePattern: /\bla\s*hacks\b/i,
    hostPatterns: [/lahacks\.com$/i, /lahacks\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://lahacks.com/',
    evidence: 'Sometimes / limited travel support',
  },
  {
    id: 'mhacks',
    label: 'MHacks',
    tier: 'A',
    titlePattern: /\bmhacks\b/i,
    hostPatterns: [/mhacks\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://www.mhacks.org/',
    evidence: 'Historically offered limited reimbursement',
  },
  {
    id: 'bitcamp',
    label: 'Bitcamp',
    tier: 'A',
    titlePattern: /\bbitcamp\b/i,
    hostPatterns: [/bit\.camp$/i, /bitcamp\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://bit.camp/',
    evidence: 'Sometimes limited travel support',
  },
  {
    id: 'hackgt',
    label: 'HackGT',
    tier: 'A',
    titlePattern: /\bhack\s*gt\b/i,
    hostPatterns: [/hack\.gt$/i, /hackgt\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://hack.gt/',
    evidence: 'Sometimes limited travel support',
  },

  // ---- Tier B — Europe / multi-day with grants ----
  {
    id: 'junction',
    label: 'Junction',
    tier: 'B',
    titlePattern: /\bjunction\b/i,
    hostPatterns: [/hackjunction\.com$/i, /junction\.fi$/i],
    faqPaths: ['/faq', '/travel', '/info', '/practical'],
    siteUrl: 'https://www.hackjunction.com/',
    evidence: 'Limited travel grants (e.g. up to ~€300) — not everyone',
  },
  {
    id: 'starthack',
    label: 'START Hack',
    tier: 'B',
    titlePattern: /\bstart\s*hack\b/i,
    hostPatterns: [/starthack\.eu$/i, /startglobal\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://www.starthack.eu/',
    evidence: 'Occasional partner/travel support',
  },
  {
    id: 'hackupc',
    label: 'HackUPC',
    tier: 'B',
    titlePattern: /\bhack\s*upc\b/i,
    hostPatterns: [/hackupc\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackupc.com/',
    evidence: 'Sometimes limited support',
  },
  {
    id: 'ethglobal',
    label: 'ETHGlobal',
    tier: 'B',
    titlePattern: /eth\s?global/i,
    hostPatterns: [/ethglobal\.com$/i],
    faqPaths: ['/faq', '/travel', '/perks', '/scholarships'],
    siteUrl: 'https://ethglobal.com/',
    evidence: 'Per-event scholarships / support; not guaranteed every city',
  },
  {
    id: 'encode',
    label: 'Encode',
    tier: 'B',
    titlePattern: /\bencode\b/i,
    hostPatterns: [/encode\.club$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.encode.club/',
    evidence: 'Occasional travel/stipend for selected builders',
  },
  {
    id: 'cassini',
    label: 'CASSINI',
    tier: 'B',
    titlePattern: /\bcassini\b/i,
    hostPatterns: [/cassini\.eu$/i, /taikai\.network$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.cassini.eu/hackathons',
    evidence: 'Varies heavily — some years housing/help, some none',
  },
  {
    id: 'eudis',
    label: 'EUDIS',
    tier: 'B',
    titlePattern: /\beudis\b/i,
    hostPatterns: [],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.eudis.eu/',
    evidence: 'Sometimes support for selected teams',
  },
  {
    id: 'copernicus',
    label: 'Copernicus',
    tier: 'B',
    titlePattern: /\bcopernicus\b/i,
    hostPatterns: [],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.copernicus.eu/',
    evidence: 'Occasionally local support',
  },
]

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function matchTravelPriority(row: {
  title?: string | null
  url?: string | null
  source?: string | null
}): TravelPriorityCircuit | null {
  const title = row.title ?? ''
  const host = row.url ? hostOf(row.url) : ''
  const source = row.source ?? ''

  for (const c of TRAVEL_PRIORITY) {
    if (c.titlePattern.test(title)) return c
    if (host && c.hostPatterns.some((re) => re.test(host))) return c
    if (c.id === 'ethglobal' && source === 'ethglobal') return c
  }
  return null
}

export function isTravelPriority(h: Pick<Hackathon, 'title' | 'url' | 'source'>): boolean {
  return matchTravelPriority(h) !== null
}

export function travelPriorityTierLabel(
  h: Pick<Hackathon, 'title' | 'url' | 'source'>
): string | null {
  const m = matchTravelPriority(h)
  if (!m) return null
  return `Travel ${m.tier} · ${m.label}`
}

export function travelPriorityFaqPaths(row: {
  title?: string | null
  url?: string | null
  source?: string | null
}): string[] {
  return matchTravelPriority(row)?.faqPaths ?? []
}
