import assert from 'node:assert/strict'
import test from 'node:test'

import { circuitTravelCovered } from '../lib/ingest/travel-circuits'
import { isUpcomingAndOpen } from '../lib/scoring'
import type { Hackathon } from '../lib/types'

// --- circuitTravelCovered: only Tier A implies the travel prior ---

test('Tier A circuit sets travel_covered prior to true', () => {
  // HackMIT is Tier A (documented reimbursement).
  assert.equal(circuitTravelCovered({ source: 'mlh', title: 'HackMIT 2026', url: null, format: 'in_person' }), true)
})

test('Tier B circuit does NOT claim travel — leaves it for the FAQ crawl', () => {
  // ETHGlobal / ETHTokyo are Tier B (unclear / monitor).
  assert.equal(circuitTravelCovered({ source: 'luma', title: 'ETHTokyo 2026', url: null, format: 'in_person' }), null)
  assert.equal(circuitTravelCovered({ source: 'ethglobal', title: 'ETHGlobal Singapore', url: null, format: 'in_person' }), null)
})

test('online and unmatched events never get the prior', () => {
  assert.equal(circuitTravelCovered({ source: 'mlh', title: 'HackMIT', url: null, format: 'online' }), null)
  assert.equal(circuitTravelCovered({ source: 'luma', title: 'Random Meetup', url: null, format: 'in_person' }), null)
})

// --- India filter: released only when travel is confirmed covered ---

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString()

function indiaEvent(travel_covered: boolean | null): Hackathon {
  return {
    id: 'x',
    source: 'devfolio',
    title: 'ETHIndia 2026',
    url: 'https://ethindia.co/',
    starts_at: future(30),
    ends_at: future(32),
    registration_deadline: future(20),
    location_raw: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    format: 'in_person',
    prize_pool: null,
    themes: [],
    travel_covered,
  } as unknown as Hackathon
}

test('India-focused event stays hidden when travel is not covered', () => {
  assert.equal(isUpcomingAndOpen(indiaEvent(null)), false)
  assert.equal(isUpcomingAndOpen(indiaEvent(false)), false)
})

test('India-focused event surfaces once travel is confirmed covered', () => {
  assert.equal(isUpcomingAndOpen(indiaEvent(true)), true)
})
