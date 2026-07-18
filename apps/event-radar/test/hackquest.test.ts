import assert from 'node:assert/strict'
import test from 'node:test'

import { parseHackQuest } from '../lib/ingest/hackquest'

const body = {
  data: {
    listHackathons: {
      total: 3,
      data: [
        {
          id: 'h1',
          name: 'Injective Global Cup',
          alias: 'injective-global-cup',
          status: 'publish',
          totalRewards: '150000',
          info: { mode: 'ONLINE' },
          timeline: {
            registrationOpen: '2026-07-01T00:00:00.000Z',
            registrationClose: '2026-07-26T15:59:00.000Z',
            submissionOpen: '2026-08-01T00:00:00.000Z',
            submissionClose: '2026-08-20T00:00:00.000Z',
            rewardTime: '2026-09-01T00:00:00.000Z',
          },
          ecosystem: [{ type: 'Injective' }, { type: 'AI' }],
        },
        // Not published — no linkable page, dropped.
        {
          id: 'h2',
          name: 'Draft Only',
          alias: 'draft-only',
          status: 'draft',
          info: { mode: 'ONLINE' },
          timeline: {},
        },
        // Hybrid, missing submission window — falls back to registration/reward.
        {
          id: 'h3',
          name: 'ChainHack',
          alias: 'chainhack',
          status: 'publish',
          totalRewards: 0,
          info: { mode: 'HYBRID' },
          timeline: {
            registrationOpen: '2026-07-05T00:00:00.000Z',
            registrationClose: '2026-07-30T04:00:00.000Z',
            rewardTime: '2026-08-15T00:00:00.000Z',
          },
          ecosystem: [],
        },
      ],
    },
  },
}

test('maps published hackathons with source-provided registration deadlines', () => {
  const rows = parseHackQuest(body)
  assert.equal(rows.length, 2)

  assert.deepEqual(rows[0], {
    source: 'hackquest',
    source_id: 'h1',
    title: 'Injective Global Cup',
    url: 'https://www.hackquest.io/hackathon/injective-global-cup',
    starts_at: '2026-08-01T00:00:00.000Z',
    ends_at: '2026-08-20T00:00:00.000Z',
    location_raw: null,
    format: 'online',
    prize_pool: '$150,000',
    registration_deadline: '2026-07-26T15:59:00.000Z',
    themes: ['Injective', 'AI'],
  })

  const chainhack = rows[1]
  assert.equal(chainhack.format, 'hybrid')
  assert.equal(chainhack.prize_pool, null) // 0 rewards -> no prize string
  assert.equal(chainhack.starts_at, '2026-07-05T00:00:00.000Z') // fell back to registrationOpen
  assert.equal(chainhack.ends_at, '2026-08-15T00:00:00.000Z') // fell back to rewardTime
  assert.equal(chainhack.registration_deadline, '2026-07-30T04:00:00.000Z')
})

test('tolerates a shapeless response without throwing', () => {
  assert.deepEqual(parseHackQuest({}), [])
  assert.deepEqual(parseHackQuest({ data: { listHackathons: { data: [] } } }), [])
})
