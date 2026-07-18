import assert from 'node:assert/strict'
import test from 'node:test'

import { parseDoraHackathons } from '../lib/ingest/dorahacks'

// 2026-07-18T00:00:00Z in seconds
const NOW = Date.parse('2026-07-18T00:00:00.000Z') / 1000

function dora(overrides: Record<string, unknown> = {}) {
  return {
    id: 2019,
    title: 'MunichTech Innovation Hackathon 2026',
    start_time: Date.parse('2026-08-01T00:00:00.000Z') / 1000,
    end_time: Date.parse('2026-09-01T00:00:00.000Z') / 1000,
    participation_form: 'Virtual',
    organization: { name: 'MunichTech EXPO' },
    ...overrides,
  }
}

test('maps unix timestamps and builds the /detail URL', () => {
  const [row] = parseDoraHackathons([dora()], NOW)
  assert.equal(row.source, 'dorahacks')
  assert.equal(row.source_id, '2019')
  assert.equal(row.url, 'https://dorahacks.io/hackathon/2019/detail')
  assert.equal(row.starts_at, '2026-08-01T00:00:00.000Z')
  assert.equal(row.ends_at, '2026-09-01T00:00:00.000Z')
  // No distinct registration field — submissions run until the event ends.
  assert.equal(row.registration_deadline, '2026-09-01T00:00:00.000Z')
  assert.equal(row.format, 'online')
})

test('drops events whose end_time has already passed', () => {
  assert.equal(
    parseDoraHackathons([dora({ end_time: Date.parse('2026-07-01T00:00:00.000Z') / 1000 })], NOW)
      .length,
    0
  )
})

test('reads an in-person format from the venue when the form is offline', () => {
  const [row] = parseDoraHackathons(
    [dora({ participation_form: 'Offline', venue_name: 'Messe München', venue_address: 'Munich' })],
    NOW
  )
  assert.equal(row.format, 'in_person')
  assert.equal(row.location_raw, 'Messe München')
})

test('falls back to the organization name for location when no venue', () => {
  const [row] = parseDoraHackathons([dora({ venue_name: null })], NOW)
  assert.equal(row.location_raw, 'MunichTech EXPO')
})

test('skips items with no id or title', () => {
  assert.equal(parseDoraHackathons([dora({ id: null }), dora({ title: '' })], NOW).length, 0)
})
