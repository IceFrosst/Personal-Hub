import { durationHours } from './scoring'
import { travelUsefulForMe } from './travel-for-me'
import type { Hackathon } from './types'

// Daily digest: instead of one push per newly ingested hackathon, the radar
// sends at most ONE notification per user per day summarising what appeared.
// The digest is suppressed entirely unless at least one new event is IRL,
// multi-day, or travel-covered — a pile of online one-evening jams is not worth
// a buzz.

/** How long a freshly ingested event wears the "New" badge in the feed. */
export const NEW_BADGE_HOURS = 72

/**
 * Minimum gap between digests. Deliberately below 24h: the Vercel cron fires at
 * 05:00 UTC ±59min and the GitHub Actions add ~4 runs/day, so a strict 24h gate
 * would silently skip a day whenever a run drifted later than the previous one
 * (05:59 one day, 05:01 the next = 23h02m). 20h keeps it to one per calendar day
 * in practice without losing a day to jitter.
 */
export const DIGEST_MIN_GAP_HOURS = 20

/** Newly ingested — drives the "New" tag on cards. */
export function isNewHackathon(
  h: Pick<Hackathon, 'created_at'>,
  now: Date = new Date()
): boolean {
  const created = Date.parse(h.created_at)
  if (!Number.isFinite(created)) return false
  // A created_at slightly in the future (clock skew) still counts as new.
  return created > now.getTime() - NEW_BADGE_HOURS * 3600_000
}

/**
 * In-person for counting purposes. Deliberately stricter than the feed's IRL
 * tab (which treats unknown format as IRL): a notification that claims "3 IRL"
 * should mean three events we actually know are in person.
 */
export function isIrlEvent(h: Pick<Hackathon, 'format'>): boolean {
  return h.format === 'in_person' || h.format === 'hybrid'
}

/** Same rule as the feed's Multi-day filter and the scoring boost. */
export function isMultiDayEvent(h: Pick<Hackathon, 'starts_at' | 'ends_at'>): boolean {
  const hours = durationHours(h)
  return hours !== null && hours > 24
}

/**
 * Travel that actually helps someone based in `homeBase` — the same predicate
 * behind the solid "Travel" tag on cards and the feed's Travel filter, so the
 * three surfaces can never disagree.
 */
export function hasUsefulTravel(h: Hackathon, homeBase: string): boolean {
  return travelUsefulForMe(h, homeBase) === 'yes'
}

/** An event only earns a place in the digest if it carries one of the tags. */
export function qualifiesForDigest(h: Hackathon, homeBase: string): boolean {
  return isIrlEvent(h) || isMultiDayEvent(h) || hasUsefulTravel(h, homeBase)
}

export type DigestCounts = {
  /** Number of qualifying new events — everything the digest reports on. */
  total: number
  irl: number
  multi_day: number
  travel: number
}

/**
 * Count the qualifying events by tag. The buckets deliberately OVERLAP — one
 * in-person multi-day event with travel covered counts in all three — so the
 * numbers read as "how many have this property", not as a partition of `total`.
 */
export function summarizeDigest(events: Hackathon[], homeBase: string): DigestCounts {
  const qualifying = events.filter((h) => qualifiesForDigest(h, homeBase))
  return {
    total: qualifying.length,
    irl: qualifying.filter(isIrlEvent).length,
    multi_day: qualifying.filter(isMultiDayEvent).length,
    travel: qualifying.filter((h) => hasUsefulTravel(h, homeBase)).length,
  }
}

export type DigestPayload = { title: string; body: string }

/**
 * Build the push copy. Returns null when nothing qualifies — the caller must
 * treat null as "send nothing at all" (the no-buzz-for-nothing rule).
 */
export function buildDigestPayload(counts: DigestCounts): DigestPayload | null {
  if (counts.total <= 0) return null

  const parts: string[] = []
  if (counts.irl > 0) parts.push(`${counts.irl} IRL`)
  if (counts.multi_day > 0) parts.push(`${counts.multi_day} multi-day`)
  if (counts.travel > 0) parts.push(`${counts.travel} travel covered`)

  return {
    title: `${counts.total} new hackathon${counts.total === 1 ? '' : 's'}`,
    body: parts.join(' · '),
  }
}

/**
 * One digest per day. Unparseable/missing timestamps fail OPEN (send) so a bad
 * stored value can never mute notifications forever.
 */
export function shouldSendDigest(
  lastDigestAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastDigestAt) return true
  const last = Date.parse(lastDigestAt)
  if (!Number.isFinite(last)) return true
  return now.getTime() - last >= DIGEST_MIN_GAP_HOURS * 3600_000
}
