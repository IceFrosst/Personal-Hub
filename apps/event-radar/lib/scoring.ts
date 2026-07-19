import type { Hackathon } from './types'
import { isTravelPriority, matchTravelPriority } from './travel-priority'

export type ScoreReason = { label: string; pts: number }
export type ScoredHackathon = { score: number; reasons: ScoreReason[] }

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

export function scoreHackathon(h: Hackathon, now: Date = new Date()): ScoredHackathon {
  const reasons: ScoreReason[] = []
  const add = (label: string, pts: number) => {
    if (pts !== 0) reasons.push({ label, pts })
  }

  const online = h.format === 'online'

  if (!online) {
    // Confirmed travel: largest single boost (was 40 → 50)
    if (h.travel_covered === true) add('Travel covered', 50)
    else if (h.travel_covered === null) add('Travel coverage unknown', 8)

    // Tier A/B circuit — still valuable even before enrichment confirms
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

export function isUpcomingAndOpen(h: Hackathon, now: Date = new Date()): boolean {
  const nowTimestamp = now.getTime()
  if (!Number.isFinite(nowTimestamp)) return false

  const startsAt = validTimestamp(h.starts_at)
  if (startsAt === null || startsAt <= nowTimestamp) return false

  // Luma / known / watch / travel-priority seeds often lack a hard deadline.
  if (
    (h.source === 'luma' || h.source === 'known' || h.source === 'watch') &&
    h.registration_deadline == null
  ) {
    return true
  }

  // Travel-priority domains: show if start is future even without deadline
  if (isTravelPriority(h) && h.registration_deadline == null) {
    return true
  }

  const registrationDeadline = validTimestamp(h.registration_deadline)
  return registrationDeadline !== null && registrationDeadline > nowTimestamp
}
