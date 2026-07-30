import assert from 'node:assert/strict'
import test from 'node:test'

import { isUpcomingAndOpen, scoreHackathon } from '../lib/scoring'
import type { Hackathon } from '../lib/types'
import { coerceHackathon } from '../lib/types'

const NOW = new Date('2026-07-18T12:00:00.000Z')

function hackathon(overrides: Partial<Hackathon> = {}): Hackathon {
  return {
    id: 'hackathon-1',
    source: 'test',
    source_id: null,
    title: 'Future Hackathon',
    url: 'https://example.com/hackathon',
    starts_at: '2026-08-01T09:00:00.000Z',
    ends_at: '2026-08-03T17:00:00.000Z',
    registration_deadline: '2026-07-31T23:59:59.000Z',
    format: 'in_person',
    city: 'Vilnius',
    country: 'Lithuania',
    location_raw: 'Vilnius, Lithuania',
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
    enriched_at: null,
    notified_at: null,
    last_seen_at: NOW.toISOString(),
    created_at: NOW.toISOString(),
    ...overrides,
  }
}

test('includes a hackathon that starts later and still accepts registrations', () => {
  assert.equal(isUpcomingAndOpen(hackathon(), NOW), true)
})

test('excludes a hackathon that already started even when registration remains open', () => {
  assert.equal(
    isUpcomingAndOpen(hackathon({ starts_at: '2026-07-18T11:59:59.999Z' }), NOW),
    false
  )
})

test('uses a strict future boundary for the start time', () => {
  assert.equal(isUpcomingAndOpen(hackathon({ starts_at: NOW.toISOString() }), NOW), false)
})

test('excludes a hackathon after registration closes', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({ registration_deadline: '2026-07-18T11:59:59.999Z' }),
      NOW
    ),
    false
  )
})

test('uses a strict future boundary for the registration deadline', () => {
  assert.equal(
    isUpcomingAndOpen(hackathon({ registration_deadline: NOW.toISOString() }), NOW),
    false
  )
})

test('fails closed when the start is missing', () => {
  assert.equal(isUpcomingAndOpen(hackathon({ starts_at: null }), NOW), false)
})

test('fails closed for non-Luma sources when registration deadline is missing', () => {
  assert.equal(isUpcomingAndOpen(hackathon({ registration_deadline: null }), NOW), false)
})

test('includes a Luma row with future start and no registration deadline', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({ source: 'luma', registration_deadline: null }),
      NOW
    ),
    true
  )
})

test('still excludes a Luma row that has already started', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({
        source: 'luma',
        starts_at: '2026-07-18T11:59:59.999Z',
        registration_deadline: null,
      }),
      NOW
    ),
    false
  )
})

test('Luma with an explicit past deadline is still excluded', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({
        source: 'luma',
        registration_deadline: '2026-07-18T11:59:59.999Z',
      }),
      NOW
    ),
    false
  )
})

test('fails closed when the start or registration deadline is malformed', () => {
  assert.equal(isUpcomingAndOpen(hackathon({ starts_at: 'not-a-date' }), NOW), false)
  assert.equal(
    isUpcomingAndOpen(hackathon({ registration_deadline: 'not-a-date' }), NOW),
    false
  )
})

test('fails closed when the comparison time is invalid', () => {
  assert.equal(isUpcomingAndOpen(hackathon(), new Date('not-a-date')), false)
})

test('TreeHacks without open deadline is excluded even if start is far out', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({
        title: 'TreeHacks 2027',
        url: 'https://treehacks.com/',
        starts_at: '2027-02-13T12:00:00.000Z',
        registration_deadline: null,
      }),
      NOW
    ),
    false
  )
})

test('PennApps without open deadline is excluded', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({
        title: 'PennApps XXVII',
        url: 'https://pennapps.com/',
        starts_at: '2026-09-20T12:00:00.000Z',
        registration_deadline: null,
      }),
      NOW
    ),
    false
  )
})

test('TreeHacks with future registration deadline is allowed', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({
        title: 'TreeHacks 2027',
        url: 'https://treehacks.com/',
        starts_at: '2027-02-13T12:00:00.000Z',
        registration_deadline: '2026-11-15T23:59:59.000Z',
      }),
      NOW
    ),
    true
  )
})

test('travel-priority circuit without deadline is excluded (no bypass)', () => {
  assert.equal(
    isUpcomingAndOpen(
      hackathon({
        title: 'HackMIT 2026',
        url: 'https://hackmit.org/',
        starts_at: '2026-09-19T12:00:00.000Z',
        registration_deadline: null,
      }),
      NOW
    ),
    false
  )
})

test('full travel boost only when policy is useful for home base', () => {
  const usOnly = scoreHackathon(
    hackathon({
      city: 'Boston',
      country: 'United States',
      location_raw: 'Boston, MA',
      travel_covered: true,
      travel_scope: 'domestic',
      travel_regions: ['US'],
    }),
    NOW,
    { priority_countries: [], home_base: 'lithuania' }
  )
  assert.ok(!usOnly.reasons.some((r) => r.label.includes('for you') && r.pts === 50))

  const eu = scoreHackathon(
    hackathon({
      city: 'Barcelona',
      country: 'Spain',
      location_raw: 'Barcelona',
      travel_covered: true,
      travel_scope: 'international',
      travel_regions: ['EU', 'Europe'],
    }),
    NOW,
    { priority_countries: [], home_base: 'lithuania' }
  )
  assert.ok(eu.reasons.some((r) => r.pts === 50 && r.label.includes('for you')))
})

// ── Travel-verified horizon ────────────────────────────────────────────────
// HackUPC forced this: verified to pay half of travel from Europe, deadline
// open, and invisible only because it starts 279 days out.
function farFuture(over: Record<string, unknown> = {}) {
  return coerceHackathon({
    id: 'far-1',
    source: 'known',
    title: 'HackUPC',
    url: 'https://hackupc.com/',
    starts_at: '2027-05-01T08:00:00.000Z',
    ends_at: '2027-05-03T18:00:00.000Z',
    registration_deadline: '2027-04-15T23:59:59.000Z',
    format: 'in_person',
    travel_covered: true,
    themes: ['travel_scope:international', 'travel_region:Europe'],
    ...over,
  })
}

const AT = new Date('2026-07-26T12:00:00Z') // 279 days before that start

test('a verified international travel program is visible past the 240-day horizon', () => {
  assert.equal(isUpcomingAndOpen(farFuture(), AT), true)
})

test('the same event without a verified scope stays behind the normal horizon', () => {
  // travel_covered alone must not buy the longer window — that is the whole
  // distinction between "documented" and "unknown".
  assert.equal(isUpcomingAndOpen(farFuture({ themes: [] }), AT), false)
})

test('a verified but selective/domestic scope does not get the longer window', () => {
  assert.equal(
    isUpcomingAndOpen(farFuture({ themes: ['travel_scope:selective'] }), AT),
    false
  )
  assert.equal(
    isUpcomingAndOpen(farFuture({ themes: ['travel_scope:domestic'] }), AT),
    false
  )
})

test('the extended horizon still ends — nothing beyond 400 days', () => {
  assert.equal(
    isUpcomingAndOpen(farFuture({ starts_at: '2028-01-01T08:00:00.000Z' }), AT),
    false
  )
})

test('extended horizon does not bypass a closed registration deadline', () => {
  assert.equal(
    isUpcomingAndOpen(farFuture({ registration_deadline: '2026-01-01T00:00:00.000Z' }), AT),
    false
  )
})
