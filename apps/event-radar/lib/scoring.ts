import type { Hackathon } from './types'

export type ScoreReason = { label: string; pts: number }
export type ScoredHackathon = { score: number; reasons: ScoreReason[] }

// Countries reachable from Lithuania cheaply enough that missing travel
// coverage matters much less. Home country is scored separately.
const NEIGHBOR_COUNTRIES = ['latvia', 'estonia', 'poland']
const HOME_COUNTRY = 'lithuania'

function matchesCountry(h: Hackathon, names: string[]): boolean {
  const haystack = `${h.country ?? ''} ${h.location_raw ?? ''}`.toLowerCase()
  return names.some((n) => haystack.includes(n))
}

function prizeNumber(prize: string | null): number {
  if (!prize) return 0
  const digits = prize.replace(/[^0-9]/g, '')
  return digits ? parseInt(digits, 10) : 0
}

// Ranking priorities locked in EVENT_RADAR_PLAN.md. Score is computed at read
// time so re-weighting never needs a migration. `unknown` (null) fields earn a
// small optimistic nudge but never as much as a confirmed yes.
export function scoreHackathon(h: Hackathon, now: Date = new Date()): ScoredHackathon {
  const reasons: ScoreReason[] = []
  const add = (label: string, pts: number) => {
    if (pts !== 0) reasons.push({ label, pts })
  }

  const online = h.format === 'online'

  if (online) {
    add('Online — no travel needed', 35)
  } else {
    if (h.travel_covered === true) add('Travel covered', 40)
    else if (h.travel_covered === null) add('Travel coverage unknown', 8)

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

// Feed and notification eligibility is intentionally fail-closed for most
// sources: both starts_at and registration_deadline must parse as valid
// timestamps and be strictly later than now.
//
// Luma is the exception: its discovery API never supplies a registration
// deadline (RSVPs stay open until the event starts). For source === 'luma'
// with a null deadline, a strictly future starts_at is enough to qualify.
export function isUpcomingAndOpen(h: Hackathon, now: Date = new Date()): boolean {
  const nowTimestamp = now.getTime()
  if (!Number.isFinite(nowTimestamp)) return false

  const startsAt = validTimestamp(h.starts_at)
  if (startsAt === null || startsAt <= nowTimestamp) return false

  // Luma RSVPs stay open until the event starts; treat unknown deadline as open.
  if (h.source === 'luma' && h.registration_deadline == null) {
    return true
  }

  const registrationDeadline = validTimestamp(h.registration_deadline)
  return registrationDeadline !== null && registrationDeadline > nowTimestamp
}
