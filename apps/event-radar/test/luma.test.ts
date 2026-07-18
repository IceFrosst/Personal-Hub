import assert from 'node:assert/strict'
import test from 'node:test'

import { parseLumaPage } from '../lib/ingest/luma'

const page = {
  has_more: true,
  next_cursor: 'abc',
  entries: [
    {
      event: {
        api_id: 'evt-1',
        name: 'EVM Capital Hackathon',
        url: 'no8xhlna',
        start_at: '2026-07-18T05:30:00.000Z',
        end_at: '2026-07-19T05:30:00.000Z',
        location_type: 'offline',
        geo_address_info: { city: 'Bengaluru', region: 'Karnataka', country: 'India', city_state: 'Bengaluru, India' },
      },
    },
    {
      // Fuzzy near-miss the query pulls in — no "hack" in the name, dropped.
      event: { api_id: 'evt-2', name: 'Cafe Cursor Shanghai', url: 'cafe-cursor', location_type: 'offline' },
    },
    {
      // Online hackathon with no geo — maps to format 'online'.
      event: {
        api_id: 'evt-3',
        name: 'Global AI Hack Night',
        url: 'ai-hack-night',
        start_at: '2026-08-01T18:00:00.000Z',
        location_type: 'online',
      },
    },
    {
      // Missing url — unusable, dropped.
      event: { api_id: 'evt-4', name: 'Ghost Hackathon' },
    },
  ],
}

test('maps hackathon entries and drops fuzzy/unusable ones', () => {
  const rows = parseLumaPage(page)
  assert.equal(rows.length, 2)

  assert.deepEqual(rows[0], {
    source: 'luma',
    source_id: 'evt-1',
    title: 'EVM Capital Hackathon',
    url: 'https://lu.ma/no8xhlna',
    starts_at: '2026-07-18T05:30:00.000Z',
    ends_at: '2026-07-19T05:30:00.000Z',
    location_raw: 'Bengaluru, India',
    format: 'in_person',
    prize_pool: null,
    themes: [],
  })

  assert.equal(rows[1].title, 'Global AI Hack Night')
  assert.equal(rows[1].format, 'online')
  assert.equal(rows[1].location_raw, null)
})

test('tolerates an empty or shapeless page without throwing', () => {
  assert.deepEqual(parseLumaPage({}), [])
  assert.deepEqual(parseLumaPage({ entries: [] }), [])
})
