import type { Hackathon } from './types'
import { isNewHackathon } from './digest'

/**
 * What the last refresh actually brought in.
 *
 * Deliberately does NOT apply `isUpcomingAndOpen`. A freshly ingested row
 * normally has no `registration_deadline` — enrichment fills that on a later
 * pass — and the feed is fail-closed on a missing deadline. Requiring
 * eligibility here would leave the tab empty in the minutes right after a
 * refresh, which is exactly when you open it.
 *
 * So the only gate relaxed is the unknown deadline. Events that have already
 * started are still dropped, and rows hidden by the user stay hidden.
 */
export function selectNewArrivals(
  hackathons: Hackathon[],
  isHidden: (h: Hackathon) => boolean,
  now: Date = new Date()
): Hackathon[] {
  return hackathons
    .filter((h) => isNewHackathon(h, now))
    .filter((h) => {
      const start = h.starts_at ? Date.parse(h.starts_at) : NaN
      // An unparseable/absent start is kept: it is still new information, and
      // enrichment may resolve the date on the next pass. Dropping it would
      // hide exactly the rows most likely to need a look.
      return !Number.isFinite(start) || start > now.getTime()
    })
    .filter((h) => !isHidden(h))
    .sort((a, b) => {
      // Newest arrival first. This is a "what just landed" list, so score must
      // not reorder it — that is what the main feed is for.
      const ca = a.created_at ?? ''
      const cb = b.created_at ?? ''
      return ca < cb ? 1 : ca > cb ? -1 : 0
    })
}
