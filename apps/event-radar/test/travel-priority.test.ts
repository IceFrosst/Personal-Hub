import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TRAVEL_PRIORITY,
  isTravelPriority,
  matchTravelPriority,
  travelPriorityFaqPaths,
} from '../lib/travel-priority'

test('registry includes full Tier A and B from policy tables', () => {
  const ids = new Set(TRAVEL_PRIORITY.map((c) => c.id))
  for (const id of [
    'hackmit',
    'treehacks',
    'pennapps',
    'hackthenorth',
    'hackillinois',
    'calhacks',
    'lahacks',
    'mhacks',
    'bitcamp',
    'hackgt',
    'junction',
    'starthack',
    'hackupc',
    'ethglobal',
    'encode',
    'cassini',
    'eudis',
    'copernicus',
  ]) {
    assert.ok(ids.has(id), `missing ${id}`)
  }
})

test('Tier A count is 10', () => {
  assert.equal(TRAVEL_PRIORITY.filter((c) => c.tier === 'A').length, 10)
})

test('matches new Tier A events', () => {
  assert.equal(matchTravelPriority({ title: 'HackIllinois 2027' })?.id, 'hackillinois')
  assert.equal(matchTravelPriority({ title: 'CalHacks 13.0' })?.tier, 'A')
  assert.equal(matchTravelPriority({ title: 'LA Hacks' })?.id, 'lahacks')
  assert.equal(matchTravelPriority({ title: 'MHacks 2026' })?.id, 'mhacks')
  assert.equal(matchTravelPriority({ title: 'Bitcamp' })?.id, 'bitcamp')
  assert.equal(matchTravelPriority({ title: 'HackGT 13' })?.id, 'hackgt')
})

test('FAQ paths and isTravelPriority', () => {
  assert.ok(travelPriorityFaqPaths({ title: 'CalHacks' }).includes('/faq'))
  assert.equal(isTravelPriority({ title: 'Junction 2026', url: '', source: 'known' }), true)
  assert.equal(isTravelPriority({ title: 'Random Meetup', url: 'https://lu.ma/x', source: 'luma' }), false)
})
