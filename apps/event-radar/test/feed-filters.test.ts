import assert from 'node:assert/strict'
import test from 'node:test'

import { matchesFeedFilters, type FeedFilters } from '../lib/feed-filters'
import { selectNewArrivals } from '../lib/new-arrivals'
import { coerceHackathon } from '../lib/types'

const NOW = new Date('2026-07-30T12:00:00Z')
const never = () => false

const BASE: FeedFilters = {
  formatMode: 'irl',
  multiDayOnly: false,
  travelOnly: false,
  homeBase: 'lithuania',
}

function row(over: Record<string, unknown> = {}) {
  return coerceHackathon({
    id: 'r1',
    source: 'luma',
    title: 'Fresh Hack',
    url: 'https://lu.ma/fresh',
    created_at: '2026-07-30T09:00:00Z',
    starts_at: '2026-09-01T09:00:00Z',
    ends_at: '2026-09-03T18:00:00Z', // multi-day
    format: 'in_person',
    themes: [],
    ...over,
  })
}

test('IRL and Online are mutually exclusive', () => {
  const irl = row()
  const online = row({ id: 'o', format: 'online' })

  assert.equal(matchesFeedFilters(irl, BASE), true)
  assert.equal(matchesFeedFilters(online, BASE), false)

  const onlineMode: FeedFilters = { ...BASE, formatMode: 'online' }
  assert.equal(matchesFeedFilters(irl, onlineMode), false)
  assert.equal(matchesFeedFilters(online, onlineMode), true)
})

test('unknown format counts as IRL, never as Online', () => {
  // Deliberate: an unenriched row is more likely in-person than online, and
  // hiding it from both tabs would make it unreachable.
  const unknown = row({ format: null })
  assert.equal(matchesFeedFilters(unknown, BASE), true)
  assert.equal(matchesFeedFilters(unknown, { ...BASE, formatMode: 'online' }), false)
})

test('multi-day needs a duration over 24h, and unknown duration does not pass', () => {
  const filters: FeedFilters = { ...BASE, multiDayOnly: true }
  assert.equal(matchesFeedFilters(row(), filters), true)

  const sameDay = row({ starts_at: '2026-09-01T09:00:00Z', ends_at: '2026-09-01T20:00:00Z' })
  assert.equal(matchesFeedFilters(sameDay, filters), false)

  const noEnd = row({ ends_at: null })
  assert.equal(matchesFeedFilters(noEnd, filters), false)
})

test('Travel ✓ requires a verified useful policy, not a bare travel_covered', () => {
  const filters: FeedFilters = { ...BASE, travelOnly: true }

  const bare = row({ travel_covered: true })
  assert.equal(matchesFeedFilters(bare, filters), false, 'bare boolean is only "maybe"')

  const verified = row({
    travel_covered: true,
    themes: ['travel_scope:international', 'travel_region:Europe'],
  })
  assert.equal(matchesFeedFilters(verified, filters), true)
})

test('filters compose — IRL + multi-day + travel all have to hold', () => {
  const filters: FeedFilters = {
    ...BASE,
    multiDayOnly: true,
    travelOnly: true,
  }
  const good = row({
    travel_covered: true,
    themes: ['travel_scope:global'],
  })
  assert.equal(matchesFeedFilters(good, filters), true)
  // Same event, but online → fails the format leg alone.
  assert.equal(matchesFeedFilters(row({ ...good, format: 'online' }), filters), false)
})

// The reason the predicate is shared rather than duplicated: "New + Travel ✓"
// has to mean exactly what "Travel ✓" means in the feed, or the same event
// would show under one and not the other.
test('the New tab and the feed agree on what a chip means', () => {
  const filters: FeedFilters = { ...BASE, travelOnly: true }
  const verified = row({ travel_covered: true, themes: ['travel_scope:global'] })
  const online = row({ id: 'o', format: 'online', travel_covered: true, themes: ['travel_scope:global'] })

  const arrivals = selectNewArrivals([verified, online], never, NOW).filter((h) =>
    matchesFeedFilters(h, filters)
  )
  assert.deepEqual(
    arrivals.map((h) => h.id),
    ['r1'],
    'online row is excluded under IRL in New, exactly as it is in the feed'
  )
})

test('with no chips on, everything passes', () => {
  const permissive: FeedFilters = { ...BASE, formatMode: 'irl' }
  assert.equal(matchesFeedFilters(row(), permissive), true)
  assert.equal(matchesFeedFilters(row({ ends_at: null }), permissive), true)
  assert.equal(matchesFeedFilters(row({ travel_covered: null }), permissive), true)
})
