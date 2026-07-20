import type { Hackathon } from './types'
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

function matchesCountry(h: Hackathon, names: string[]): boolean {
  const haystack = `${h.country ?? ''} ${h.location_raw ?? ''} ${h.city ?? ''}`.toLowerCase()
  return names.some((n) => haystack.includes(n))
}

/** User is not targeting India — exclude from feed and scoring. */
export function isIndiaFocused(h: Pick<Hackathon, 'country' | 'location_raw' | 'city' | 'source' | 'title'>): boolean {
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

export function scoreHackathon(h: Hackathon, now: Date = new Date()): ScoredHackathon {
  const reasons: ScoreReason[] = []
  const add = (label: string, pts: number) => {
    if (pts !== 0) reasons.push({ label, pts })
  }

  if (isIndiaFocused(h)) {
    return { score: -100, reasons: [{ label: 'India-focused — filtered', pts: -100 }] }
  }

  const online = h.format === 'online'

  if (!online) {
    if (h.travel_covered === true) add('Travel covered', 50)
    else if (h.travel_covered === null) add('Travel coverage unknown', 8)

    const circuit = matchTravelPriority(h)
    if (circuit && h.travel_covered !== true) {
      add(`Travel tier ${circuit.tier} · ${circuit.label}`, 18)
    } else if (circuit && h.travel_covered === true) {
      add(`Travel tier ${circuit.tier}`, 8)
    }

    if (matchesCountry(h, [HOME_COUNTRY])) add('In Lithuania', 25)
    else if (matchesCountry(h, NEIGHBOR_COUNTRIES) && h.travel_covered !== true)
      add('Neighbor country — cheap to reach', 15)
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

function validTimestamp(value: string | null): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * Feed eligibility: future start + registration still open (or about to be).
 * Deliberately strict so dormant / pre-announce / invented next-year rows stay out.
 */
export function isUpcomingAndOpen(h: Hackathon, now: Date = new Date()): boolean {
  const nowTimestamp = now.getTime()
  if (!Number.isFinite(nowTimestamp)) return false

  if (isIndiaFocused(h)) return false

  const startsAt = validTimestamp(h.starts_at)
  if (startsAt === null || startsAt <= nowTimestamp) return false

  // Don't surface events more than ~8 months out (stops 2027 placeholders)
  const maxHorizonMs = 240 * 86400000
  if (startsAt - nowTimestamp > maxHorizonMs) return false

  const registrationDeadline = validTimestamp(h.registration_deadline)

  // Hard rule: if we know the deadline and it's passed → hide
  if (registrationDeadline !== null && registrationDeadline <= nowTimestamp) return false

  // known / watch seeds: only when a real deadline is still open
  // (no more "show forever because start is future")
  if (h.source === 'known' || h.source === 'watch') {
    return registrationDeadline !== null && registrationDeadline > nowTimestamp
  }

  // Luma community events often lack deadlines — allow if start is within 4 months
  if (h.source === 'luma' && registrationDeadline === null) {
    return startsAt - nowTimestamp <= 120 * 86400000
  }

  // Everything else needs an open registration deadline
  if (registrationDeadline !== null) return registrationDeadline > nowTimestamp

  // Last resort: travel-priority without deadline only if start ≤ 90 days
  if (isTravelPriority(h)) {
    return startsAt - nowTimestamp <= 90 * 86400000
  }

  return false
}
