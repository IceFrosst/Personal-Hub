import assert from 'node:assert/strict'
import test from 'node:test'

import { parseHackQuest, type HackQuestHackathon } from '../lib/ingest/hackquest'

const NOW = Date.parse('2026-07-18T00:00:00.000Z')

function hq(overrides: Partial<HackQuestHackathon> = {}): HackQuestHackathon {
  return {
    id: '57e543a9-0b08-4ba3-8326-e5cd751c0248',
    name: '0G APAC Hackathon',
    alias: '0G-APAC-Hackathon',
    status: 'publish',
    timeline: {
      registrationClose: '2026-08-16T15:59:00.000Z',
      submissionClose: '2026-08-20T15:59:00.000Z',
    },
    ...overrides,
  }
}

test('maps a hackathon to its alias URL and proxies start from the deadline', () => {
  const [row] = parseHackQuest([hq()], NOW)
  assert.equal(row.source, 'hackquest')
  assert.equal(row.url, 'https://www.hackquest.io/hackathon/0G-APAC-Hackathon')
  assert.equal(row.registration_deadline, '2026-08-16T15:59:00.000Z')
  assert.equal(row.starts_at, row.registration_deadline)
  assert.equal(row.ends_at, '2026-08-20T15:59:00.000Z')
})

test('drops entries whose registration already closed', () => {
  assert.equal(
    parseHackQuest([hq({ timeline: { registrationClose: '2025-07-20T15:59:00.000Z' } })], NOW).length,
    0
  )
})

test('drops unpublished entries', () => {
  assert.equal(parseHackQuest([hq({ status: 'draft' })], NOW).length, 0)
})

test('omits ends_at when submission is not strictly after the deadline', () => {
  const [row] = parseHackQuest(
    [hq({ timeline: { registrationClose: '2026-08-16T15:59:00.000Z', submissionClose: '2026-08-16T15:59:00.000Z' } })],
    NOW
  )
  assert.equal(row.ends_at, null)
})

test('skips entries missing an alias, name, or deadline', () => {
  assert.equal(parseHackQuest([hq({ alias: null }), hq({ name: '' }), hq({ timeline: null })], NOW).length, 0)
})
