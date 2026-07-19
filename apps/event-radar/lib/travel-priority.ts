import type { Hackathon } from '@/lib/types'

/**
 * Tier A/B circuits with documented or frequently reported travel support.
 *
 * A = strong / explicit reimbursement history (often all accepted or large pool)
 * B = limited grants, scholarships, selective, or year-variable
 *
 * Always re-check FAQ — policies change yearly. Match is title OR host.
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
  region: 'na' | 'eu' | 'asia' | 'oceania' | 'global'
}

export const TRAVEL_PRIORITY: TravelPriorityCircuit[] = [
  // ========== Tier A — strongest travel history ==========
  {
    id: 'hackmit',
    label: 'HackMIT',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*mit\b/i,
    hostPatterns: [/hackmit\.org$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://hackmit.org/',
    evidence: 'All attendees eligible; regional cap; docs required',
  },
  {
    id: 'treehacks',
    label: 'TreeHacks',
    tier: 'A',
    region: 'na',
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
    region: 'na',
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
    region: 'na',
    titlePattern: /\bhack\s*the\s*north\b/i,
    hostPatterns: [/hackthenorth\.com$/i],
    faqPaths: ['/faq', '/travel', '/logistics'],
    siteUrl: 'https://hackthenorth.com/',
    evidence: 'Frequently offers travel reimbursement',
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
    evidence: 'Sometimes travel support (varies by year)',
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
    evidence: 'Sometimes / limited',
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
    evidence: 'Historically limited reimbursement',
  },
  {
    id: 'bitcamp',
    label: 'Bitcamp',
    tier: 'A',
    region: 'na',
    titlePattern: /\bbitcamp\b/i,
    hostPatterns: [/bit\.camp$/i, /bitcamp\.org$/i],
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
    hostPatterns: [/hack\.gt$/i, /hackgt\.com$/i],
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
    evidence: 'Ivy flagship; often travel support for accepted',
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
    evidence: 'Purdue flagship; often limited reimbursement',
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
    evidence: 'Western Canada major; travel support common',
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
    evidence: 'Toronto major student hackathon; often travel help',
  },
  {
    id: 'hackduke',
    label: 'HackDuke',
    tier: 'A',
    region: 'na',
    titlePattern: /\bhack\s*duke\b/i,
    hostPatterns: [/hackduke\.org$/i, /hackduke\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackduke.org/',
    evidence: 'Duke code-for-good; travel often available',
  },

  // ========== Tier B — limited / selective / variable ==========
  // --- more North America ---
  {
    id: 'hackny',
    label: 'HackNY',
    tier: 'B',
    region: 'na',
    titlePattern: /\bhack\s*ny\b/i,
    hostPatterns: [/hackny\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackny.org/',
    evidence: 'NYC; occasional travel / fellowship-style support',
  },
  {
    id: 'hacktx',
    label: 'HackTX',
    tier: 'B',
    region: 'na',
    titlePattern: /\bhack\s*tx\b/i,
    hostPatterns: [/hacktx\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hacktx.com/',
    evidence: 'Limited reimbursement some years (e.g. ~$50–100)',
  },
  {
    id: 'shellhacks',
    label: 'ShellHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bshell\s*hacks\b/i,
    hostPatterns: [/shellhacks\.net$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://shellhacks.net/',
    evidence: 'FIU / South FL major; limited support some years',
  },
  {
    id: 'knighthacks',
    label: 'KnightHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bknight\s*hacks\b/i,
    hostPatterns: [/knighthacks\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://knighthacks.org/',
    evidence: 'UCF; limited travel some seasons',
  },
  {
    id: 'tartanhacks',
    label: 'TartanHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\btartan\s*hacks\b|\bhack\s*cmu\b/i,
    hostPatterns: [/tartanhacks\.com$/i, /hackcmu\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://tartanhacks.com/',
    evidence: 'CMU; limited/selective support',
  },
  {
    id: 'vandyhacks',
    label: 'VandyHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bvandy\s*hacks\b/i,
    hostPatterns: [/vandyhacks\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.vandyhacks.org/',
    evidence: 'Vanderbilt; occasional limited reimbursement',
  },
  {
    id: 'hophacks',
    label: 'HopHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bhop\s*hacks\b/i,
    hostPatterns: [/hophacks\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hophacks.com/',
    evidence: 'Johns Hopkins; limited support some years',
  },
  {
    id: 'hackru',
    label: 'HackRU',
    tier: 'B',
    region: 'na',
    titlePattern: /\bhack\s*ru\b/i,
    hostPatterns: [/hackru\.org$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackru.org/',
    evidence: 'Rutgers; limited travel some seasons',
  },
  {
    id: 'dubhacks',
    label: 'DubHacks',
    tier: 'B',
    region: 'na',
    titlePattern: /\bdub\s*hacks\b/i,
    hostPatterns: [/dubhacks\.co$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://dubhacks.co/',
    evidence: 'UW Seattle; occasional travel support',
  },

  // --- Europe ---
  {
    id: 'junction',
    label: 'Junction',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bjunction\b/i,
    hostPatterns: [/hackjunction\.com$/i, /junction\.fi$/i],
    faqPaths: ['/faq', '/travel', '/info'],
    siteUrl: 'https://www.hackjunction.com/',
    evidence: 'Limited grants (e.g. ~€300) — not everyone',
  },
  {
    id: 'starthack',
    label: 'START Hack',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bstart\s*hack\b/i,
    hostPatterns: [/starthack\.eu$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.starthack.eu/',
    evidence: 'Occasional partner/travel support',
  },
  {
    id: 'hackupc',
    label: 'HackUPC',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bhack\s*upc\b/i,
    hostPatterns: [/hackupc\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackupc.com/',
    evidence: 'Sometimes limited support',
  },
  {
    id: 'hackzurich',
    label: 'HackZurich',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bhack\s*zurich\b|\bhack\s*z[üu]rich\b/i,
    hostPatterns: [/hackzurich\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackzurich.com/',
    evidence: 'Large EU hackathon; occasional travel packages',
  },
  {
    id: 'vhacks',
    label: 'VHacks',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bv\s*hacks\b|\bvhacks\b/i,
    hostPatterns: [/vhacks\.org$/i, /vathacks/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.vhacks.org/',
    evidence: 'Vatican/Rome student hack; selective travel help some years',
  },
  {
    id: 'hackcambridge',
    label: 'Hack Cambridge',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bhack\s*cambridge\b/i,
    hostPatterns: [/hackcambridge\.com$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://hackcambridge.com/',
    evidence: 'UK uni; limited travel support historically',
  },
  {
    id: 'junctionx',
    label: 'JunctionX',
    tier: 'B',
    region: 'global',
    titlePattern: /\bjunction\s*x\b/i,
    hostPatterns: [/hackjunction\.com$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.hackjunction.com/',
    evidence: 'Junction satellite events; local/variable support',
  },

  // --- EU institutional / space / defence ---
  {
    id: 'ethglobal',
    label: 'ETHGlobal',
    tier: 'B',
    region: 'global',
    titlePattern: /eth\s?global/i,
    hostPatterns: [/ethglobal\.com$/i],
    faqPaths: ['/faq', '/travel', '/perks', '/scholarships'],
    siteUrl: 'https://ethglobal.com/',
    evidence: 'Per-event scholarships; not every city',
  },
  {
    id: 'encode',
    label: 'Encode',
    tier: 'B',
    region: 'global',
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
    region: 'eu',
    titlePattern: /\bcassini\b/i,
    hostPatterns: [/cassini\.eu$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.cassini.eu/hackathons',
    evidence: 'Varies heavily by edition',
  },
  {
    id: 'eudis',
    label: 'EUDIS',
    tier: 'B',
    region: 'eu',
    titlePattern: /\beudis\b/i,
    hostPatterns: [],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.eudis.eu/',
    evidence: 'Sometimes support for selected teams',
  },
  {
    id: 'copernicus',
    label: 'Copernicus',
    tier: 'B',
    region: 'eu',
    titlePattern: /\bcopernicus\b/i,
    hostPatterns: [],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.copernicus.eu/',
    evidence: 'Occasionally local support',
  },

  // --- Asia / Oceania ---
  {
    id: 'adventurex',
    label: 'AdventureX',
    tier: 'B',
    region: 'asia',
    titlePattern: /\badventure\s*x\b/i,
    hostPatterns: [/adventure-x\.org$/i],
    faqPaths: ['/faq', '/en'],
    siteUrl: 'https://adventure-x.org/en',
    evidence: 'China mega-builder; limited travel help some years',
  },
  {
    id: 'hackust',
    label: 'HackUST',
    tier: 'B',
    region: 'asia',
    titlePattern: /\bhack\s*ust\b/i,
    hostPatterns: [/hack\.ust\.hk$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://hack.ust.hk/',
    evidence: 'HKUST; mostly local; occasional regional support',
  },
  {
    id: 'unihack',
    label: 'UNIHACK',
    tier: 'B',
    region: 'oceania',
    titlePattern: /\bunihack\b/i,
    hostPatterns: [/unihack\.net$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://unihack.net/',
    evidence: 'Australia student; limited interstate support sometimes',
  },
  {
    id: 'unearthed',
    label: 'Unearthed',
    tier: 'B',
    region: 'oceania',
    titlePattern: /\bunearthed\b/i,
    hostPatterns: [/unearthed\.solutions$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://unearthed.solutions/',
    evidence: 'Resources sector hacks; sometimes sponsor travel for finals',
  },

  // --- Web3 / global builder ---
  {
    id: 'easya',
    label: 'EasyA',
    tier: 'B',
    region: 'global',
    titlePattern: /\beasy\s*a\b/i,
    hostPatterns: [/easya\.io$/i],
    faqPaths: ['/faq', '/travel'],
    siteUrl: 'https://www.easya.io/',
    evidence: 'Often cited for travel support on selected events',
  },
  {
    id: 'colosseum',
    label: 'Colosseum / Solana',
    tier: 'B',
    region: 'global',
    titlePattern: /\bcolosseum\b|\bsolana\b.*hack|\bhyperdrive\b/i,
    hostPatterns: [/colosseum\.com$/i, /solana\.com$/i],
    faqPaths: ['/faq'],
    siteUrl: 'https://www.colosseum.com/',
    evidence: 'Selected builders sometimes get event travel',
  },
  {
    id: 'superteam',
    label: 'Superteam',
    tier: 'B',
    region: 'global',
    titlePattern: /\bsuperteam\b/i,
    hostPatterns: [/superteam\.fun$/i],
    faqPaths: [],
    siteUrl: 'https://superteam.fun/',
    evidence: 'Regional Solana community events; selective travel',
  },
  {
    id: 'dorahacks-offline',
    label: 'DoraHacks (offline)',
    tier: 'B',
    region: 'global',
    titlePattern: /\bdora\s*hacks\b/i,
    hostPatterns: [/dorahacks\.io$/i],
    faqPaths: [],
    siteUrl: 'https://dorahacks.io/',
    evidence: 'Mostly online; offline finals may fund selected teams',
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

export function travelPriorityStats() {
  const a = TRAVEL_PRIORITY.filter((c) => c.tier === 'A').length
  const b = TRAVEL_PRIORITY.filter((c) => c.tier === 'B').length
  return { total: TRAVEL_PRIORITY.length, tierA: a, tierB: b }
}
