import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isTravelPriority,
  matchTravelPriority,
  travelPriorityFaqPaths,
  travelPriorityTierLabel,
} from '../lib/travel-priority'

test('matches HackMIT by title and host', () => {
  assert.equal(matchTravelPriority({ title: 'HackMIT 2026', url: 'https://example.com' })?.id, 'hackmit')
  assert.equal(
    matchTravelPriority({ title: 'Something', url: 'https://hackmit.org/' })?.id,
    'hackmit'
  )
})

test('matches TreeHacks and PennApps', () => {
  assert.equal(matchTravelPriority({ title: 'TreeHacks 2027' })?.tier, 'A')
  assert.equal(matchTravelPriority({ title: 'PennApps XXVI' })?.id, 'pennapps')
})

test('matches Junction and ETHGlobal as tier B', () => {
  assert.equal(matchTravelPriority({ title: 'Junction 2026' })?.tier, 'B')
  assert.equal(matchTravelPriority({ title: 'ETHGlobal NYC', source: 'ethglobal' })?.id, 'ethglobal')
})

test('FAQ paths exist for priority circuits', () => {
  const paths = travelPriorityFaqPaths({ title: 'HackMIT 2026' })
  assert.ok(paths.includes('/faq'))
  assert.ok(paths.length >= 2)
})

test('label and isTravelPriority helpers', () => {
  assert.equal(isTravelPriority({ title: 'Hack the North 2026', url: '', source: 'known' }), true)
  assert.ok(travelPriorityTierLabel({ title: 'HackMIT', url: '', source: 'known' })?.includes('A'))
  assert.equal(isTravelPriority({ title: 'Random Meetup', url: 'https://lu.ma/x', source: 'luma' }), false)
})
