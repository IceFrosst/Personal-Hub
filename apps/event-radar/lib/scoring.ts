import type { Hackathon, NotificationSettings } from './types'
import { DEFAULT_NOTIFICATION_SETTINGS } from './types'
import { isTravelPriority, matchTravelPriority } from './travel-priority'
import { isDormantCircuit } from './dormant-tier-a'
import { normalizeHomeBase, travelUsefulForMe } from './travel-for-me'

export type ScoreReason = { label: string; pts: number }
export type ScoredHackathon = { score: number; reasons: ScoreReason[] }

const NEIGHBOR_OF: Record<string, string[]> = {
  lithuania: ['latvia', 'estonia', 'poland'],
  latvia: ['lithuania', 'estonia', 'poland'],
  estonia: ['lithuania', 'latvia', 'finland'],
  poland: ['lithuania', 'germany', 'czechia', 'czech', 'czech republic'],
}

const INDIA_MARKERS = [
  'india',
  'indian',
  'bengaluru',
  'bangalore',
  'mumbai',
  'delhi',
  'hyderabad',
  'chennai',
  'pune',
  'kolkata',
  'noida',
  'gurgaon',
  'gurugram',
  'jaipur',
  'ahmedabad',
  'kerala',
  'tamil nadu',
  'maharashtra',
]

export const MIN_LEAD_DAYS = 7

/** Full boost only when travel policy is useful for the user's home base. */
export const TRAVEL_USEFUL_BOOST = 50
/** Ambiguous / selective travel — small nudge, not the full boost. */
export const TRAVEL_MAYBE_BOOST = 12
/** Priority country is intentionally smaller than confirmed useful travel. */
export const PRIORITY_COUNTRY_BOOST = 30
/** Multi-day (>24h) events — raised to 25 per user request. */
export const MULTI_DAY_BOOST = 25

function matchesCountry(h: Hackathon, names: string[]): boolean {
  const haystack = `${h.country ?? ''} ${h.location_raw ?? ''} ${h.city ?? ''}`.toLowerCase()
  return names.some((n) => n.length > 0 && haystack.includes(n))
}

export function isIndiaFocused(
  h: Pick<Hackathon, 'country' | 'location_raw' | 'city' | 'source' | 'title'>
): boolean {
  if (h.source === 'unstop') return true
  if (matchesCountry(h as Hackathon, INDIA_MARKERS)) return true
  const title = (h.title ?? '').toLowerCase()
  if (/\b(sih|smart india|india hackathon)\b/i.test(title)) return true
  return false
}

function prizeNumber(prize: string | null): number {
  if (!prize) return 0
  const digits = prize.replace(/[^0-9]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

function validTimestamp(value: string | null): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export function durationHours(h: Pick<Hackathon, 'starts_at' | 'ends_at'>): number | null {
  const s = validTimestamp(h.starts_at)
  const e = validTimestamp(h.ends_at)
  if (s === null || e === null || e <= s) return null
  return (e - s) / 3600000
}

export type ScorePrefs = Pick<NotificationSettings, 'priority_countries' | 'home_base'>

export function scoreHackathon(
  h: Hackathon,
  now: Date = new Date(),
  prefs: ScorePrefs = DEFAULT_NOTIFICATION_SETTINGS
): ScoredHackathon {
  const reasons: ScoreReason[] = []
  const add = (label: string, pts: number) => {
    if (pts !== 0) reasons.push({ label, pts })
  }

  // India-focused events are filtered UNLESS travel is confirmed covered —
  // Ignas will fly to India for a fully-covered event, but not a local-only one.
  if (isIndiaFocused(h) && h.travel_covered !== true) {
    return { score: -100, reasons: [{ label: 'India-focused, travel not covered — filtered', pts: -100 }] }
  }

  const online = h.format === 'online'
  const home = normalizeHomeBase(prefs.home_base)
  const priorityList = (prefs.priority_countries ?? [])
    .map((c) => c.toLowerCase().trim())
    .filter(Boolean)

  // Normalize czech aliases for matching
  const priorityExpanded = priorityList.flatMap((c) =>
    c === 'czechia' || c === 'czech' || c === 'czech republic'
      ? ['czechia', 'czech', 'czech republic']
      : [c]
  )

  const inPriority = priorityExpanded.length > 0 && matchesCountry(h, priorityExpanded)
  const neighbors = NEIGHBOR_OF[home] ?? []

  if (!online) {
    const useful = travelUsefulForMe(h, home)

    if (useful === 'yes') {
      add('Travel covered (for you)', TRAVEL_USEFUL_BOOST)
    } else if (useful === 'maybe') {
      add('Travel possible — check FAQ', TRAVEL_MAYBE_BOOST)
    } else if (useful === 'no' && (h.travel_covered === true || h.travel_scope)) {
      add('Travel not for your region', 0)
    } else if (h.travel_covered === null && !h.travel_scope) {
      add('Travel coverage unknown', 8)
    }

    const circuit = matchTravelPriority(h)
    // Tier badge only when we do not already have a hard "yes" from the page
    if (circuit && useful !== 'yes') {
      // Don't boost US-only circuits for a Baltic home base
      if (circuit.region === 'na' && home !== 'united states' && home !== 'canada') {
        add(`Travel tier ${circuit.tier} · ${circuit.label} (NA)`, 4)
      } else if (circuit.region === 'africa') {
        add(`Travel tier ${circuit.tier} · ${circuit.label} (Africa)`, 4)
      } else {
        add(`Travel tier ${circuit.tier} · ${circuit.label}`, 18)
      }
    } else if (circuit && useful === 'yes') {
      add(`Travel tier ${circuit.tier}`, 8)
    }

    if (inPriority) {
      add('Priority country (cheap from home)', PRIORITY_COUNTRY_BOOST)
    } else if (matchesCountry(h, [home])) {
      add(`In home country (${home})`, 25)
    } else if (neighbors.length > 0 && matchesCountry(h, neighbors) && useful !== 'yes') {
      add('Neighbor country — cheap to reach', 15)
    }
  } else if (inPriority) {
    add('Priority country (cheap from home)', Math.floor(PRIORITY_COUNTRY_BOOST / 2))
  }

  const hours = durationHours(h)
  if (hours !== null && hours > 24) {
    add('Multi-day event', MULTI_DAY_BOOST)
  }

  if (h.accommodation_covered === true) add('Accommodation provided', 20)
  else if (h.accommodation_covered === null) add('Accommodation unknown', 4)

  if (h.open_to_business_students === true) add('Open to business students', 15)
  else if (h.open_to_business_students === null) add('Eligibility unknown', 5)
  else add('Developers only', -30)

  const prize = prizeNumber(h.prize_pool)
  if (prize >= 10000) add('Big prize pool', 5)
  else if (prize >= 1000) add('Prize pool', 3)

  if (h.registration_deadline) {
    const days = (new Date(h.registration_deadline).getTime() - now.getTime()) / 86400000
    if (days >= 0 && days <= 14) add('Closing soon', 5)
  }

  const score = reasons.reduce((sum, r) => sum + r.pts, 0)
  return { score, reasons }
}

/**
 * Main-feed eligibility. Fail-closed for missing deadlines (except Luma).
 * Dormant circuits (TreeHacks, PennApps, …) never appear without a future reg deadline.
 * Travel-priority no longer bypasses the deadline requirement.
 */
export function isUpcomingAndOpen(h: Hackathon, now: Date = new Date()): boolean {
  const nowTimestamp = now.getTime()
  if (!Number.isFinite(nowTimestamp)) return false

  // India-focused events surface only once travel is confirmed covered (see note
  // in scoreHackathon). A local-only Indian event stays hidden; ETHIndia-class
  // fully-covered ones can appear.
  if (isIndiaFocused(h) && h.travel_covered !== true) return false

  const startsAt = validTimestamp(h.starts_at)
  if (startsAt === null) return false

  const minStart = nowTimestamp + MIN_LEAD_DAYS * 86400000
  if (startsAt < minStart) return false

  const maxHorizonMs = 240 * 86400000
  if (startsAt - nowTimestamp > maxHorizonMs) return false

  const registrationDeadline = validTimestamp(h.registration_deadline)

  if (registrationDeadline !== null && registrationDeadline <= nowTimestamp) return false

  // Dormant Tier A/B: only when we have a real open deadline
  if (isDormantCircuit(h)) {
    return registrationDeadline !== null && registrationDeadline > nowTimestamp
  }

  if (h.source === 'known' || h.source === 'watch') {
    return registrationDeadline !== null && registrationDeadline > nowTimestamp
  }

  if (h.source === 'luma' && registrationDeadline === null) {
    return startsAt - nowTimestamp <= 120 * 86400000
  }

  if (registrationDeadline !== null) return registrationDeadline > nowTimestamp

  // No more travel-priority bypass without deadline — was letting TreeHacks/PennApps through
  void isTravelPriority

  return false
}
