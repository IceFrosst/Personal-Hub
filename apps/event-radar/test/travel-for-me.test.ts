import assert from 'node:assert/strict'
import test from 'node:test'

import { travelTagLabel, travelUsefulForMe } from '../lib/travel-for-me'
import type { Hackathon } from '../lib/types'

function h(overrides: Partial<Hackathon> = {}): Hackathon {
  return {
    id: '1',
    source: 'test',
    source_id: null,
    title: 'Test',
    url: 'https://example.com',
    starts_at: null,
    ends_at: null,
    registration_deadline: null,
    format: 'in_person',
    city: null,
    country: null,
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
    enriched_at: null,
    notified_at: null,
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

test('US-only domestic is not useful from Lithuania', () => {
  assert.equal(
    travelUsefulForMe(
      h({
        travel_covered: true,
        travel_scope: 'domestic',
        country: 'United States',
        travel_regions: ['US'],
      }),
      'lithuania'
    ),
    'no'
  )
})

test('Africa-only regional is not useful from Lithuania', () => {
  assert.equal(
    travelUsefulForMe(
      h({
        travel_covered: true,
        travel_scope: 'regional',
        travel_regions: ['Africa'],
      }),
      'lithuania'
    ),
    'no'
  )
})

test('EU / international is useful from Lithuania', () => {
  assert.equal(
    travelUsefulForMe(
      h({
        travel_covered: true,
        travel_scope: 'international',
        travel_regions: ['EU', 'Europe'],
      }),
      'lithuania'
    ),
    'yes'
  )
})

test('boolean true without scope is maybe (no full boost)', () => {
  assert.equal(
    travelUsefulForMe(h({ travel_covered: true, travel_scope: null }), 'lithuania'),
    'maybe'
  )
})

test('selective is maybe', () => {
  assert.equal(
    travelUsefulForMe(
      h({ travel_covered: true, travel_scope: 'selective' }),
      'lithuania'
    ),
    'maybe'
  )
})

test('tag labels distinguish for-me vs not', () => {
  assert.equal(
    travelTagLabel(
      h({ travel_covered: true, travel_scope: 'international', travel_regions: ['global'] }),
      'lithuania'
    ),
    'Travel'
  )
  assert.equal(
    travelTagLabel(
      h({ travel_covered: true, travel_scope: 'domestic', country: 'USA', travel_regions: ['US'] }),
      'lithuania'
    ),
    'Travel · US'
  )
})
