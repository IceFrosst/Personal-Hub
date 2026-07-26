import type { Hackathon, TravelScope } from '@/lib/types'
import {
  TIER_A_RESEARCH_BATCH,
  TIER_B_RESEARCH_BATCH,
} from './travel-priority-additions'
import { AFRICA_AU_TIER_A, AFRICA_AU_TIER_B } from './travel-priority-africa-au'

/**
 * Tier A/B circuits with documented or frequently reported travel support.
 * A = strong / explicit reimbursement (≥15% for eligible)  |  B = limited / selective / variable
 */
export type TravelPriorityTier = 'A' | 'B'

/**
 * A circuit's travel policy in the SAME structured shape the LLM extracts.
 *
 * Why this exists: `travel_covered: true` alone can never make
 * `travelUsefulForMe` return 'yes' — a bare boolean with no geography is
 * deliberately downgraded to 'maybe' (see lib/travel-for-me.ts), which is what
 * the Travel filter, the solid Travel tag, and the digest's travel count all
 * key on. The scope was supposed to come from enrichment, but most flagship
 * circuits ship a JS-only shell: the open-egress probe measured hackmit,
 * pennapps, hackthenorth, bitcamp, hackgt, technica and bigredhacks at 1–3
 * words of server-rendered text. Plain fetch cannot read them and the
 * no-headless rule stands, so the registry is the only place their policy can
 * live.
 *
 * Fill this ONLY from wording someone actually read — a dated probe quote or
 * the official FAQ. Never from reputation or memory: an unverified 'global'
 * here would forge exactly the false positive the 'maybe' downgrade exists to
 * prevent. No policy is a perfectly good answer; the circuit stays 'maybe'.
 */
export type CircuitTravelPolicy = {
  scope: TravelScope
  /** Who is eligible, e.g. ['Europe'], ['India']. [] when the text sets no limit. */
  regions?: string[]
  /** Stated amount/cap, verbatim-ish, e.g. 'up to €120 from Europe'. */
  cap?: string
  /** The sentence this was read from, and when. */
  quote: string
  verifiedOn: string
}

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
  /** Verified policy — see CircuitTravelPolicy. Absent = unknown, not "none". */
  travelPolicy?: CircuitTravelPolicy
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
    evidence: 'Travel reimbursement up to regional cap for attendees who submit',
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
    evidence: 'Official: meals, travels, and lodging for accepted (dormant until 2027 apps)',
    travelPolicy: {
      scope: 'global',
      // States the support with no geographic qualifier anywhere on the page —
      // 'global' per the same definition the enrichment prompt uses.
      regions: [],
      quote:
        'We take care of meals, travels, and lodging so you can focus on building and dreaming big.',
      verifiedOn: '2026-07-26',
    },
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
    evidence: 'Long history of travel reimbursement (dormant until next reg)',
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
    evidence: 'Published travel guidelines + partial reimbursement',
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
    evidence: 'FAQ lists travel reimbursements; Oct 2026 Ann Arbor',
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
  // EU — HackUPC promoted: published half-travel, max €120 EU / €200 outside
  {
    id: 'hackupc',
    label: 'HackUPC',
    tier: 'A',
    region: 'eu',
    titlePattern: /\bhack\s*upc\b/i,
    hostPatterns: [/hackupc\.com$/i],
    faqPaths: ['/faq', '/'],
    siteUrl: 'https://hackupc.com/',
    evidence:
      '2026 policy: half of travel costs — max €50 Spain outside Catalonia, €120 Europe, €120–200 outside Europe (receipts + demo). Dormant until 2027 cycle.',
    travelPolicy: {
      scope: 'international',
      // Names Europe explicitly AND funds arrivals from outside it — the one
      // circuit in this registry whose own wording covers a Baltic traveller.
      regions: ['Europe', 'global'],
      cap: '50% of cost — up to €50 Spain, €120 Europe, €120–200 outside Europe',
      quote:
        'We pay half of the travel costs, with a maximum of €50 for Spaniards outside of Catalonia, up to €120 if you are coming from Europe and up to a range between €120 and €200 if you come from outside Europe.',
      verifiedOn: '2026-07-26',
    },
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
]

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
