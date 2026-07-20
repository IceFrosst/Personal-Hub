import type { Hackathon, NotificationSettings } from './types'
import { DEFAULT_NOTIFICATION_SETTINGS } from './types'
import { isTravelPriority, matchTravelPriority } from './travel-priority'

export type ScoreReason = { label: string; pts: number }
export type ScoredHackathon = { score: number; reasons: ScoreReason[] }

const NEIGHBOR_COUNTRIES = ['latvia', 'estonia', 'poland']
const HOME_COUNTRY = 'lithuania'
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

/** Travel covered = 50; priority country is intentionally smaller. */
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

export function scoreHackathon(
  h: Hackathon,
  now: Date = new Date(),
  prefs: Pick<NotificationSettings, 'priority_countries'> = DEFAULT_NOTIFICATION_SETTINGS
): ScoredHackathon {
  const reasons: ScoreReason[] = []
  const add = (label: string, pts: number) => {
    if (pts !== 0) reasons.push({ label, pts })
  }

  if (isIndiaFocused(h)) {
    return { score: -100, reasons: [{ label: 'India-focused — filtered', pts: -100 }] }
  }

  const online = h.format === 'online'
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

  if (!online) {
    if (h.travel_covered === true) add('Travel covered', 50)
    else if (h.travel_covered === null) add('Travel coverage unknown', 8)

    const circuit = matchTravelPriority(h)
    if (circuit && h.travel_covered !== true) {
      add(`Travel tier ${circuit.tier} · ${circuit.label}`, 18)
    } else if (circuit && h.travel_covered === true) {
      add(`Travel tier ${circuit.tier}`, 8)
    }

    if (inPriority) {
      add('Priority country (cheap from LT)', PRIORITY_COUNTRY_BOOST)
    } else if (matchesCountry(h, [HOME_COUNTRY])) {
      add('In Lithuania', 25)
    } else if (matchesCountry(h, NEIGHBOR_COUNTRIES) && h.travel_covered !== true) {
      add('Neighbor country — cheap to reach', 15)
    }
  } else if (inPriority) {
    add('Priority country (cheap from LT)', Math.floor(PRIORITY_COUNTRY_BOOST / 2))
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

export function isUpcomingAndOpen(h: Hackathon, now: Date = new Date()): boolean {
  const nowTimestamp = now.getTime()
  if (!Number.isFinite(nowTimestamp)) return false

  if (isIndiaFocused(h)) return false

  const startsAt = validTimestamp(h.starts_at)
  if (startsAt === null) return false

  const minStart = nowTimestamp + MIN_LEAD_DAYS * 86400000
  if (startsAt < minStart) return false

  const maxHorizonMs = 240 * 86400000
  if (startsAt - nowTimestamp > maxHorizonMs) return false

  const registrationDeadline = validTimestamp(h.registration_deadline)

  if (registrationDeadline !== null && registrationDeadline <= nowTimestamp) return false

  if (h.source === 'known' || h.source === 'watch') {
    return registrationDeadline !== null && registrationDeadline > nowTimestamp
  }

  if (h.source === 'luma' && registrationDeadline === null) {
    return startsAt - nowTimestamp <= 120 * 86400000
  }

  if (registrationDeadline !== null) return registrationDeadline > nowTimestamp

  if (isTravelPriority(h)) {
    return startsAt - nowTimestamp <= 90 * 86400000
  }

  return false
}
