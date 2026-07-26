import assert from 'node:assert/strict'
import test from 'node:test'

import { isTurkey } from '../lib/region-turkey'
import { scoreHackathon, PRIORITY_COUNTRY_BOOST } from '../lib/scoring'
import { homeRegion } from '../lib/travel-for-me'
import { DEFAULT_NOTIFICATION_SETTINGS, coerceHackathon } from '../lib/types'

function turkishEvent(over: Record<string, unknown> = {}) {
  return coerceHackathon({
    id: 'tr-1',
    source: 'allhackathons',
    title: 'Istanbul AI Hackathon',
    url: 'https://allhackathons.com/hackathon/istanbul-ai/',
    starts_at: '2027-03-01T09:00:00.000Z',
    ends_at: '2027-03-03T18:00:00.000Z',
    registration_deadline: '2027-02-01T00:00:00.000Z',
    format: 'in_person',
    country: 'Türkiye',
    city: 'İstanbul',
    location_raw: 'İstanbul, Türkiye',
    themes: [],
    ...over,
  })
}

test('recognises Türkiye and İstanbul spellings', () => {
  assert.equal(isTurkey(turkishEvent()), true)
  assert.equal(isTurkey(turkishEvent({ country: 'Turkey', city: 'Ankara' })), true)
  assert.equal(
    isTurkey(turkishEvent({ country: null, city: null, location_raw: 'Izmir, Turkiye' })),
    true
  )
})

test('does not claim unrelated events', () => {
  assert.equal(
    isTurkey(turkishEvent({ title: 'Berlin Hack', country: 'Germany', city: 'Berlin', location_raw: 'Berlin' })),
    false
  )
})

// The gap this closes: matchesCountry is a plain lowercase substring test, so
// a priority_countries entry of "turkey" never matched a country of "Türkiye".
test('a "turkey" preference scores a Türkiye-labelled event as priority', () => {
  const prefs = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    priority_countries: ['turkey'],
    home_base: 'lithuania',
  }
  const { reasons } = scoreHackathon(turkishEvent(), new Date('2026-07-26T12:00:00Z'), prefs)
  const priority = reasons.find((r) => r.pts === PRIORITY_COUNTRY_BOOST)
  assert.ok(priority, `expected a priority-country boost, got ${JSON.stringify(reasons)}`)
})

test('Turkey resolves to the europe travel region', () => {
  assert.equal(homeRegion('turkey'), 'europe')
  assert.equal(homeRegion('türkiye'), 'europe')
})
