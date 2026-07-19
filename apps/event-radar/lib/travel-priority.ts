import type { Hackathon } from '@/lib/types'
import {
  TIER_A_RESEARCH_BATCH,
  TIER_B_RESEARCH_BATCH,
} from './travel-priority-additions'
import { AFRICA_AU_TIER_A, AFRICA_AU_TIER_B } from './travel-priority-africa-au'

/**
 * Tier A/B circuits with documented or frequently reported travel support.
 * A = strong / explicit reimbursement  |  B = limited / selective / variable
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
  region: 'na' | 'eu' | 'asia' | 'oceania' | 'africa' | 'global'
}

const CORE: TravelPriorityCircuit[] = [
  {
    id: 'hackmit',
    label: 'HackMIT',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*mit\b/i,
    hostPatterns: [/hackmit\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://hackmit.org/',
    evidence: 'X 2026: flying out 1000 students — food and travel covered',
  },
  {
    id: 'treehacks',
    label: 'TreeHacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\btree\s*hacks\b/i,
    hostPatterns: [/treehacks\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://treehacks.com/',
    evidence: 'Official: meals, travels, and lodging for accepted',
  },
  {
    id: 'pennapps',
    label: 'PennApps',
    tier: 'A',
    region: 'na',
    titlePattern: /\bpenn\s*apps\b/i,
    hostPatterns: [/pennapps\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://pennapps.com/',
    evidence: 'Long history of travel reimbursement',
  },
  {
    id: 'hackthenorth',
    label: 'Hack the North',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*the\s*north\b/i,
    hostPatterns: [/hackthenorth\.com$/i],
    faqPaths: ['/faq', '/travel', '/travel-guidelines'],
    siteUrl: 'https://hackthenorth.com/',
    evidence: 'Published travel guidelines + partial reimbursement 2026',
  },
  {
    id: 'hackillinois',
    label: 'HackIllinois',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*illinois\b/i,
    hostPatterns: [/hackillinois\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.hackillinois.org/',
    evidence: 'Often listed with reimbursement',
  },
  {
    id: 'calhacks',
    label: 'CalHacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bcal\s*hacks\b/i,
    hostPatterns: [/calhacks\.io$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://calhacks.io/',
    evidence: 'SF; FAQ includes travel reimbursement',
  },
  {
    id: 'lahacks',
    label: 'LA Hacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bla\s*hacks\b/i,
    hostPatterns: [/lahacks\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://lahacks.com/',
    evidence: 'FAQ Travel Reimbursement Logistics',
  },
  {
    id: 'mhacks',
    label: 'MHacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bmhacks\b/i,
    hostPatterns: [/mhacks\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.mhacks.org/',
    evidence: 'Historically yes',
  },
  {
    id: 'bitcamp',
    label: 'Bitcamp',
    tier: 'A',
    region: 'na',
    titlePattern: /\bbitcamp\b/i,
    hostPatterns: [/bit\.camp$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://bit.camp/',
    evidence: 'Sometimes limited',
  },
  {
    id: 'hackgt',
    label: 'HackGT',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*gt\b/i,
    hostPatterns: [/hack\.gt$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hack.gt/',
    evidence: 'Sometimes limited',
  },
  {
    id: 'hackprinceton',
    label: 'HackPrinceton',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*princeton\b/i,
    hostPatterns: [/hackprinceton\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackprinceton.com/',
    evidence: 'Ivy flagship',
  },
  {
    id: 'boilermake',
    label: 'BoilerMake',
    tier: 'A',
    region: 'na',
    titlePattern: /\bboiler\s*make\b/i,
    hostPatterns: [/boilermake\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://boilermake.org/',
    evidence: 'Purdue',
  },
  {
    id: 'nwhacks',
    label: 'nwHacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bnw\s*hacks\b/i,
    hostPatterns: [/nwhacks\.io$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.nwhacks.io/',
    evidence: 'Western Canada',
  },
  {
    id: 'uofthacks',
    label: 'UofTHacks',
    tier: 'A',
    region: 'na',
    titlePattern: /\bu\s*of\s*t\s*hacks\b|\buofthacks\b/i,
    hostPatterns: [/uofthacks\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://uofthacks.com/',
    evidence: 'Toronto',
  },
  {
    id: 'hackduke',
    label: 'HackDuke',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*duke\b/i,
    hostPatterns: [/hackduke\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackduke.org/',
    evidence: 'Duke',
  },
  {
    id: 'junction',
    label: 'Junction',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bjunction\b/i,
    hostPatterns: [/hackjunction\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.hackjunction.com/',
    evidence: 'Limited grants ~€300',
  },
  {
    id: 'starthack',
    label: 'START Hack',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bstart\s*hack\b/i,
    hostPatterns: [/starthack\.eu$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.starthack.eu/',
    evidence: 'Occasional',
  },
  {
    id: 'hackupc',
    label: 'HackUPC',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bhack\s*upc\b/i,
    hostPatterns: [/hackupc\.com$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://hackupc.com/',
    evidence: 'Sometimes',
  },
  {
    id: 'ethglobal',
    label: 'ETHGlobal',
    tier: 'B',
    region: 'global',
    titlePattern: /eth\s?global/i,
    hostPatterns: [/ethglobal\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://ethglobal.com/',
    evidence: 'Per-event scholarships',
  },
  {
    id: 'encode',
    label: 'Encode',
    tier: 'B',
    region: 'global',
    titlePattern: /\bencode\b/i,
    hostPatterns: [/encode\.club$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.encode.club/',
    evidence: 'Selective',
  },
  {
    id: 'cassini',
    label: 'CASSINI',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bcassini\b/i,
    hostPatterns: [/cassini\.eu$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.cassini.eu/hackathons',
    evidence: 'Varies',
  },
  {
    id: 'hackust',
    label: 'HackUST',
    tier: 'B',
    region: 'asia',
    titlePattern: /\bhack\s*ust\b/i,
    hostPatterns: [/hack\.ust\.hk$/i],
    faqPaths: [],
    siteUrl: 'https://hack.ust.hk/',
    evidence: 'HK mostly local',
  },
  {
    id: 'easya',
    label: 'EasyA',
    tier: 'B',
    region: 'global',
    titlePattern: /\beasy\s*a\b/i,
    hostPatterns: [/easya\.io$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.easya.io/',
    evidence: 'Selected events',
  },
]

// Research A first (incl. Africa/AU A), then core, then B batches.
export const TRAVEL_PRIORITY: TravelPriorityCircuit[] = [
  ...AFRICA_AU_TIER_A,
  ...TIER_A_RESEARCH_BATCH,
  ...CORE,
  ...AFRICA_AU_TIER_B,
  ...TIER_B_RESEARCH_BATCH,
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
  return m ? `Travel ${m.tier} · ${m.label}` : null
}

export function travelPriorityFaqPaths(row: {
  title?: string | null
  url?: string | null
  source?: string | null
}): string[] {
  return matchTravelPriority(row)?.faqPaths ?? []
}

export function travelPriorityStats() {
  return {
    total: TRAVEL_PRIORITY.length,
    tierA: TRAVEL_PRIORITY.filter((c) => c.tier === 'A').length,
    tierB: TRAVEL_PRIORITY.filter((c) => c.tier === 'B').length,
  }
}
