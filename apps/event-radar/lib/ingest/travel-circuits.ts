import type { HackathonFormat } from '@/lib/types'
import { matchTravelPriority, travelPriorityFaqPaths } from '@/lib/travel-priority'

// Layer-1 travel detection: curated circuits with standing travel programs.
// Enrichment always runs first; circuit prior only fills when page extraction
// returns null. Explicit page false always wins.
//
// Registry lives in lib/travel-priority.ts (Tier A/B) so the app filter,
// score boost, and FAQ enrichment share the same matchers.

export function circuitTravelCovered(row: {
  source: string
  title: string
  url?: string | null
  format: HackathonFormat | null
}): true | null {
  if (row.format === 'online') return null
  const hit = matchTravelPriority({
    source: row.source,
    title: row.title,
    url: row.url ?? null,
  })
  return hit ? true : null
}

/** Extra FAQ-style paths when the main page is thin / SPA. */
export function circuitFaqPaths(row: {
  source: string
  title: string
  url?: string | null
}): string[] {
  return travelPriorityFaqPaths(row)
}

// Listing aggregators — their per-event page is NOT the organizer's own site,
// so appending /faq or /travel to it is meaningless. For these, any travel
// policy that exists is already in the listing text we fetch first. We only run
// the generic second-hop crawl when the event URL is the organizer's own domain
// (MLH member events, curated known/watch seeds, self-hosted sites).
const AGGREGATOR_HOSTS = [
  /(^|\.)devpost\.com$/i,
  /(^|\.)lu\.ma$/i,
  /(^|\.)luma\.com$/i,
  /(^|\.)hackquest\.io$/i,
  /(^|\.)dorahacks\.io$/i,
  /(^|\.)devfolio\.co$/i,
  /(^|\.)taikai\.network$/i,
  /(^|\.)unstop\.com$/i,
  /(^|\.)hackerearth\.com$/i,
  /(^|\.)hackclub\.com$/i,
  /(^|\.)ethglobal\.com$/i,
  /(^|\.)topcoder\.com$/i,
  /(^|\.)mlh\.io$/i,
]

// Where an organizer most commonly documents travel/reimbursement.
const GENERIC_TRAVEL_PATHS = ['/faq', '/travel', '/logistics']

function isAggregatorHost(host: string): boolean {
  return AGGREGATOR_HOSTS.some((re) => re.test(host))
}

/**
 * Second-hop travel/FAQ URLs for the general population — any in-person or
 * unknown-format event whose URL is the organizer's own domain. Returns
 * absolute origin-relative URLs (e.g. https://hackxyz.org/faq). Empty for online
 * events (no travel to reimburse) and aggregator-hosted listings.
 */
export function genericTravelFaqUrls(row: {
  url?: string | null
  format: HackathonFormat | null
}): string[] {
  if (row.format === 'online') return []
  if (!row.url) return []
  let origin: string
  let host: string
  try {
    const u = new URL(row.url)
    origin = u.origin
    host = u.hostname
  } catch {
    return []
  }
  if (isAggregatorHost(host)) return []
  return GENERIC_TRAVEL_PATHS.map((p) => `${origin}${p}`)
}
