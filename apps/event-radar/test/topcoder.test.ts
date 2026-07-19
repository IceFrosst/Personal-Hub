import assert from 'node:assert/strict'
import test from 'node:test'

import { parseTopcoderChallenges } from '../lib/ingest/topcoder'

test('keeps hackathon-like challenges and drops pure SRMs', () => {
  const rows = parseTopcoderChallenges([
    {
      id: '123',
      name: 'AI Buildathon 2026',
      type: 'Challenge',
      status: 'Active',
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-08-15T00:00:00.000Z',
      registrationEndDate: '2026-08-10T00:00:00.000Z',
      overview: { totalPrizes: 5000 },
      tags: ['AI', 'hackathon'],
    },
    {
      id: '999',
      name: 'Single Round Match 900',
      type: 'SRM',
      status: 'Active',
      tags: ['competitive-programming'],
    },
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].source, 'topcoder')
  assert.equal(rows[0].title, 'AI Buildathon 2026')
  assert.equal(rows[0].prize_pool, '5000 USD')
  assert.equal(rows[0].url, 'https://www.topcoder.com/challenges/123')
})

test('empty input is safe', () => {
  assert.deepEqual(parseTopcoderChallenges([]), [])
})
