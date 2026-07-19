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
