import type { Hackathon } from './types'
import { durationHours } from './scoring'
import { hasUsefulTravel } from './digest'

export type FormatMode = 'irl' | 'online'

export type FeedFilters = {
  /** IRL ↔ Online switch — mutually exclusive, never both. */
  formatMode: FormatMode
  /** Multi-day (>24h) on/off. */
  multiDayOnly: boolean
  /** Travel ✓ — confirmed-useful travel only, same predicate as the card tag. */
  travelOnly: boolean
  homeBase: string
}

/**
 * The chip row's predicate, shared by the main feed and the New tab.
 *
 * It lives here rather than inline in the component so the two lists cannot
 * drift apart: "New + Travel ✓" has to mean exactly what "Travel ✓" means in
 * the feed, or the same event would appear under one and not the other.
 *
 * Note this is only the chips. Each list still owns its own membership rule —
 * the feed applies `isUpcomingAndOpen`, the New tab deliberately does not (see
 * lib/new-arrivals.ts).
 */
export function matchesFeedFilters(h: Hackathon, f: FeedFilters): boolean {
  if (f.formatMode === 'irl' && h.format === 'online') return false
  if (f.formatMode === 'online' && h.format !== 'online') return false

  if (f.multiDayOnly) {
    const hours = durationHours(h)
    if (hours === null || hours <= 24) return false
  }

  // Same predicate as the solid "Travel" tag on the card — filter and tag can
  // never disagree about what counts as covered.
  if (f.travelOnly && !hasUsefulTravel(h, f.homeBase)) return false

  return true
}
