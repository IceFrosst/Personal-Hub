import assert from 'node:assert/strict'
import test from 'node:test'

import { parseTaikaiChallenges, type TaikaiChallenge } from '../lib/ingest/taikai'

function challenge(overrides: Partial<TaikaiChallenge> = {}): TaikaiChallenge {
  return {
    slug: 'space-for-water',
    name: 'CASSINI Hackathons - Space for Water',
    organization: { slug: 'cassinihackathons' },
    endParticipantRegistrationDate: '2026-08-13T02:59:00.000Z',
    prize: 9000,
    prizeCurrency: { name: 'EUR' },
    steps: [
      { startDate: '2026-06-05T03:00:00.000Z' }, // before the deadline
      { startDate: '2026-08-17T22:00:00.000Z' }, // event start
      { startDate: '2026-09-22T11:00:00.000Z' }, // final
    ],
    ...overrides,
  }
}

test('builds the org/hackathon URL and pulls the reg deadline', () => {
  const [row] = parseTaikaiChallenges([challenge()])
  assert.equal(row.source, 'taikai')
  assert.equal(row.url, 'https://taikai.network/en/cassinihackathons/hackathons/space-for-water')
  assert.equal(row.registration_deadline, '2026-08-13T02:59:00.000Z')
  assert.equal(row.prize_pool, '9000 EUR')
})

test('uses the first step on/after the deadline as start and the last as end', () => {
  const [row] = parseTaikaiChallenges([challenge()])
  assert.equal(row.starts_at, '2026-08-17T22:00:00.000Z')
  assert.equal(row.ends_at, '2026-09-22T11:00:00.000Z')
})

test('falls back to the deadline for start when no step reaches past it', () => {
  const [row] = parseTaikaiChallenges([
    challenge({ steps: [{ startDate: '2026-06-05T03:00:00.000Z' }] }),
  ])
  assert.equal(row.starts_at, '2026-08-13T02:59:00.000Z')
  // The only step precedes the start, so end stays null rather than before start.
  assert.equal(row.ends_at, null)
})

test('drops a zero prize instead of emitting "0"', () => {
  const [row] = parseTaikaiChallenges([challenge({ prize: 0 })])
  assert.equal(row.prize_pool, null)
})

test('skips challenges missing slug, org, name, or a parseable deadline', () => {
  assert.equal(parseTaikaiChallenges([challenge({ slug: null })]).length, 0)
  assert.equal(parseTaikaiChallenges([challenge({ organization: null })]).length, 0)
  assert.equal(parseTaikaiChallenges([challenge({ name: ' ' })]).length, 0)
  assert.equal(
    parseTaikaiChallenges([challenge({ endParticipantRegistrationDate: 'not-a-date' })]).length,
    0
  )
})
