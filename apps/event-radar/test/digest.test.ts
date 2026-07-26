import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DIGEST_MIN_GAP_HOURS,
  NEW_BADGE_HOURS,
  buildDigestPayload,
  hasUsefulTravel,
  isIrlEvent,
  isMultiDayEvent,
  isNewHackathon,
  qualifiesForDigest,
  shouldSendDigest,
  summarizeDigest,
} from '../lib/digest'
import type { Hackathon } from '../lib/types'

const NOW = new Date('2026-07-26T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString()

function make(over: Partial<Hackathon> = {}): Hackathon {
  return {
    id: 'id',
    source: 'luma',
    source_id: null,
    title: 'Test Hack',
    url: 'https://example.com/x',
    starts_at: '2026-09-01T09:00:00Z',
    ends_at: '2026-09-01T18:00:00Z',
    registration_deadline: null,
    format: 'in_person',
    city: null,
    country: 'Lithuania',
    location_raw: null,
    prize_pool: null,
    travel_covered: null,
    travel_scope: null,
    travel_regions: [],
    travel_cap: null,
    travel_notes: null,
    accommodation_covered: null,
    open_to_business_students: null,
    themes: [],
    raw_description: null,
    enriched_at: hoursAgo(1),
    notified_at: null,
    last_seen_at: hoursAgo(1),
    created_at: hoursAgo(1),
    ...over,
  }
}

test('isNewHackathon covers the badge window and expires after it', () => {
  assert.equal(isNewHackathon(make({ created_at: hoursAgo(1) }), NOW), true)
  assert.equal(isNewHackathon(make({ created_at: hoursAgo(NEW_BADGE_HOURS - 1) }), NOW), true)
  assert.equal(isNewHackathon(make({ created_at: hoursAgo(NEW_BADGE_HOURS + 1) }), NOW), false)
  // Clock skew into the future still reads as new, never as stale.
  assert.equal(isNewHackathon(make({ created_at: hoursAgo(-2) }), NOW), true)
  assert.equal(isNewHackathon(make({ created_at: 'not-a-date' }), NOW), false)
})

test('isIrlEvent counts only known in-person formats', () => {
  assert.equal(isIrlEvent(make({ format: 'in_person' })), true)
  assert.equal(isIrlEvent(make({ format: 'hybrid' })), true)
  assert.equal(isIrlEvent(make({ format: 'online' })), false)
  // Unknown format is NOT claimed as IRL in a notification.
  assert.equal(isIrlEvent(make({ format: null })), false)
})

test('isMultiDayEvent needs more than 24h', () => {
  assert.equal(isMultiDayEvent(make()), false) // 9h same-day
  assert.equal(
    isMultiDayEvent(
      make({ starts_at: '2026-09-01T09:00:00Z', ends_at: '2026-09-03T18:00:00Z' })
    ),
    true
  )
  assert.equal(isMultiDayEvent(make({ starts_at: null, ends_at: null })), false)
})

test('hasUsefulTravel matches the solid Travel tag (scope + region aware)', () => {
  const covered = make({ travel_scope: 'global', travel_covered: true })
  assert.equal(hasUsefulTravel(covered, 'lithuania'), true)

  // International but explicitly limited to another region → not for me.
  const naOnly = make({
    travel_scope: 'international',
    travel_covered: true,
    travel_regions: ['north america'],
  })
  assert.equal(hasUsefulTravel(naOnly, 'lithuania'), false)

  // Bare boolean without geography is only "maybe" → doesn't count as covered.
  assert.equal(hasUsefulTravel(make({ travel_covered: true }), 'lithuania'), false)
  assert.equal(hasUsefulTravel(make(), 'lithuania'), false)
})

test('qualifiesForDigest gates on IRL / multi-day / travel', () => {
  assert.equal(qualifiesForDigest(make({ format: 'in_person' }), 'lithuania'), true)
  assert.equal(
    qualifiesForDigest(
      make({ format: 'online', starts_at: '2026-09-01T09:00:00Z', ends_at: '2026-09-03T09:00:00Z' }),
      'lithuania'
    ),
    true
  )
  assert.equal(
    qualifiesForDigest(
      make({ format: 'online', travel_scope: 'global', travel_covered: true }),
      'lithuania'
    ),
    // online ⇒ travelUsefulForMe is 'no', and it's single-day ⇒ nothing qualifies
    false
  )
  // A plain online one-evening jam never earns a buzz.
  assert.equal(qualifiesForDigest(make({ format: 'online' }), 'lithuania'), false)
  assert.equal(qualifiesForDigest(make({ format: null }), 'lithuania'), false)
})

test('summarizeDigest counts overlapping buckets and ignores non-qualifiers', () => {
  const events = [
    // IRL + multi-day + travel — counts in all three buckets.
    make({
      format: 'in_person',
      starts_at: '2026-09-01T09:00:00Z',
      ends_at: '2026-09-03T18:00:00Z',
      travel_scope: 'global',
      travel_covered: true,
    }),
    make({ format: 'in_person' }), // IRL only
    make({ format: 'online' }), // dropped
  ]
  assert.deepEqual(summarizeDigest(events, 'lithuania'), {
    total: 2,
    irl: 2,
    multi_day: 1,
    travel: 1,
  })
})

test('buildDigestPayload writes the count breakdown, and null when nothing qualifies', () => {
  assert.equal(buildDigestPayload({ total: 0, irl: 0, multi_day: 0, travel: 0 }), null)

  assert.deepEqual(buildDigestPayload({ total: 5, irl: 3, multi_day: 2, travel: 1 }), {
    title: '5 new hackathons',
    body: '3 IRL · 2 multi-day · 1 travel covered',
  })

  // Singular title; empty buckets are omitted rather than shown as "0".
  assert.deepEqual(buildDigestPayload({ total: 1, irl: 0, multi_day: 1, travel: 0 }), {
    title: '1 new hackathon',
    body: '1 multi-day',
  })
})

test('shouldSendDigest enforces one per day and fails open on bad input', () => {
  assert.equal(shouldSendDigest(null, NOW), true)
  assert.equal(shouldSendDigest(undefined, NOW), true)
  assert.equal(shouldSendDigest('garbage', NOW), true)
  assert.equal(shouldSendDigest(hoursAgo(1), NOW), false)
  assert.equal(shouldSendDigest(hoursAgo(DIGEST_MIN_GAP_HOURS - 1), NOW), false)
  assert.equal(shouldSendDigest(hoursAgo(DIGEST_MIN_GAP_HOURS), NOW), true)
  assert.equal(shouldSendDigest(hoursAgo(26), NOW), true)
})

test('cron jitter does not skip a day (the reason the gap is under 24h)', () => {
  // Yesterday 05:59, today 05:01 — 23h02m apart. A strict 24h gate would mute it.
  const yesterdayLate = new Date('2026-07-25T05:59:00Z').toISOString()
  const todayEarly = new Date('2026-07-26T05:01:00Z')
  assert.equal(shouldSendDigest(yesterdayLate, todayEarly), true)
})
