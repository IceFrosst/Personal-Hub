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
  /** Match event title */
  titlePattern: RegExp
  /** Match hostname of event URL */
  hostPatterns: RegExp[]
  /** Extra paths to fetch for travel FAQ enrichment */
  faqPaths: string[]
  /** Official site (for known seeds / checkers) */
  siteUrl: string
  evidence: string
}

export const TRAVEL_PRIORITY: TravelPriorityCircuit[] = [
  {
    id: 'hackmit',
    label: 'HackMIT',
    tier: 'A',
    titlePattern: /\bhack\s*mit\b/i,
    hostPatterns: [/hackmit\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics', '/info'],
    siteUrl: 'https://hackmit.org/',
    evidence: 'All attendees eligible for travel reimbursement up to regional cap',
  },
  {
    id: 'treehacks',
    label: 'TreeHacks',
    tier: 'A',
    titlePattern: /\btree\s*hacks\b/i,
    hostPatterns: [/treehacks\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://treehacks.com/',
    evidence: 'Meals, travel, and lodging for accepted hackers (per site)',
  },
  {
    id: 'pennapps',
    label: 'PennApps',
    tier: 'A',
    titlePattern: /\bpenn\s*apps\b/i,
    hostPatterns: [/pennapps\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://pennapps.com/',
    evidence: 'Long-standing travel reimbursement program',
  },
  {
    id: 'hackthenorth',
    label: 'Hack the North',
    tier: 'A',
    titlePattern: /\bhack\s*the\s*north\b/i,
    hostPatterns: [/hackthenorth\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics', '/info'],
    siteUrl: 'https://hackthenorth.com/',
    evidence: 'Frequently offers travel reimbursement for accepted hackers',
  },
  {
    id: 'junction',
    label: 'Junction',
    tier: 'B',
    titlePattern: /\bjunction\b/i,
    hostPatterns: [/hackjunction\.com$/i, /junction\.fi$/i],
    faqPaths: ['/faq', '/travel', '/info', '/practical'],
    siteUrl: 'https://www.hackjunction.com/',
    evidence: 'Limited travel grants (e.g. up to €300 for main event)',
  },
  {
    id: 'ethglobal',
    label: 'ETHGlobal',
    tier: 'B',
    titlePattern: /eth\s?global/i,
    hostPatterns: [/ethglobal\.com$/i],
    faqPaths: ['/faq', '/travel', '/perks', '/scholarships'],
    siteUrl: 'https://ethglobal.com/',
    evidence: 'Travel scholarships on many in-person flagships (per event)',
  },
  {
    id: 'cassini',
    label: 'CASSINI',
    tier: 'B',
    titlePattern: /\bcassini\b/i,
    hostPatterns: [/cassini\.eu$/i, /taikai\.network$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.cassini.eu/hackathons',
    evidence: 'Some editions reimburse travel/accommodation for finals teams',
  },
  {
    id: 'eudis',
    label: 'EUDIS',
    tier: 'B',
    titlePattern: /\beudis\b/i,
    hostPatterns: [],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.eudis.eu/',
    evidence: 'Often covers travel/stay for on-site rounds',
  },
  {
    id: 'copernicus',
    label: 'Copernicus',
    tier: 'B',
    titlePattern: /\bcopernicus\b.*hack/i,
    hostPatterns: [],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.copernicus.eu/',
    evidence: 'Regional on-site events sometimes fund travel',
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
    evidence: 'Sometimes limited travel support',
  },
  {
    id: 'encode',
    label: 'Encode',
    tier: 'B',
    titlePattern: /\bencode\b.*hack/i,
    hostPatterns: [/encode\.club$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.encode.club/',
    evidence: 'Occasional travel/stipend for selected builders',
  },
  {
    id: 'easya',
    label: 'EasyA',
    tier: 'B',
    titlePattern: /\beasy\s*a\b/i,
    hostPatterns: [/easya\.io$/i, /easyahackathon/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.easya.io/',
    evidence: 'Often cited for travel support on selected events',
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
    // ETHGlobal source rows
    if (c.id === 'ethglobal' && source === 'ethglobal') return c
  }
  return null
}

export function isTravelPriority(h: Pick<Hackathon, 'title' | 'url' | 'source'>): boolean {
  return matchTravelPriority(h) !== null
}

export function travelPriorityTierLabel(h: Pick<Hackathon, 'title' | 'url' | 'source'>): string | null {
  const m = matchTravelPriority(h)
  if (!m) return null
  return `Travel ${m.tier} · ${m.label}`
}

/** FAQ paths for harder enrichment on priority domains. */
export function travelPriorityFaqPaths(row: {
  title?: string | null
  url?: string | null
  source?: string | null
}): string[] {
  return matchTravelPriority(row)?.faqPaths ?? []
}
