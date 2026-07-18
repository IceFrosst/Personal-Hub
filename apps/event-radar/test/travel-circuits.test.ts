import assert from 'node:assert/strict'
import test from 'node:test'

import { circuitTravelCovered } from '../lib/ingest/travel-circuits'

test('flags ETHGlobal events by source', () => {
  assert.equal(
    circuitTravelCovered({ source: 'ethglobal', title: 'ETHGlobal Cannes', format: 'in_person' }),
    true
  )
})

test('flags a circuit event cross-posted to another source by title', () => {
  assert.equal(
    circuitTravelCovered({ source: 'devfolio', title: 'ETHGlobal New Delhi 2026', format: null }),
    true
  )
  assert.equal(
    circuitTravelCovered({ source: 'taikai', title: 'CASSINI Hackathons - Space for Water', format: null }),
    true
  )
  assert.equal(
    circuitTravelCovered({ source: 'taikai', title: 'EUDIS Hackathon 2026', format: 'hybrid' }),
    true
  )
})

test('never flags online events — no travel needed', () => {
  assert.equal(
    circuitTravelCovered({ source: 'ethglobal', title: 'ETHGlobal Online', format: 'online' }),
    null
  )
})

test('returns null for unknown circuits so page detection decides', () => {
  assert.equal(
    circuitTravelCovered({ source: 'devpost', title: 'Some Local Hackathon', format: 'in_person' }),
    null
  )
})

test('matches tightly — a substring in an unrelated word does not trip a circuit', () => {
  assert.equal(
    circuitTravelCovered({ source: 'devpost', title: 'Copernicating Robots Jam', format: 'in_person' }),
    null
  )
})
