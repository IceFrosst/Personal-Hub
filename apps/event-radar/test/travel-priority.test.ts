import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TRAVEL_PRIORITY,
  isTravelPriority,
  matchTravelPriority,
  travelPriorityStats,
} from '../lib/travel-priority'

test('expanded registry has 40+ circuits', () => {
  const { total, tierA, tierB } = travelPriorityStats()
  assert.ok(total >= 40, `expected >=40 got ${total}`)
  assert.ok(tierA >= 15, `tier A expected >=15 got ${tierA}`)
  assert.ok(tierB >= 20, `tier B expected >=20 got ${tierB}`)
})

test('new Tier A names match', () => {
  assert.equal(matchTravelPriority({ title: 'HackPrinceton' })?.id, 'hackprinceton')
  assert.equal(matchTravelPriority({ title: 'BoilerMake XII' })?.tier, 'A')
  assert.equal(matchTravelPriority({ title: 'nwHacks 2027' })?.id, 'nwhacks')
  assert.equal(matchTravelPriority({ title: 'UofTHacks 12' })?.id, 'uofthacks')
  assert.equal(matchTravelPriority({ title: 'HackDuke Code for Good' })?.id, 'hackduke')
})

test('new Tier B regions match', () => {
  assert.equal(matchTravelPriority({ title: 'HackZurich 2026' })?.region, 'eu')
  assert.equal(matchTravelPriority({ title: 'AdventureX 2026' })?.region, 'asia')
  assert.equal(matchTravelPriority({ title: 'UNIHACK' })?.region, 'oceania')
  assert.equal(matchTravelPriority({ title: 'ShellHacks' })?.id, 'shellhacks')
  assert.equal(matchTravelPriority({ title: 'Colosseum Hackathon' })?.id, 'colosseum')
})

test('still rejects random events', () => {
  assert.equal(isTravelPriority({ title: 'Random Meetup', url: 'https://lu.ma/x', source: 'luma' }), false)
})
