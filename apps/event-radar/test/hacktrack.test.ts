import assert from 'node:assert/strict'
import test from 'node:test'

import { parseHackTrack, placeOf } from '../lib/ingest/hacktrack'

// Captured verbatim from https://hacktrack-eu.vercel.app/api/hackathons on
// 2026-07-26.
const PAYLOAD = {
  data: [
    {
      id: '07464d77-a094-4fd8-971a-dbff782b838c',
      name: 'Encode London Hackathon and Conference',
      city: 'London',
      country_code: 'GB',
      date_start: '2026-10-23T00:00:00+00:00',
      date_end: '2026-10-25T00:00:00+00:00',
      topics: [],
      notes: null,
      url: 'https://lu.ma/encode-london-2026',
      status: 'upcoming',
      is_new: false,
    },
    {
      id: 'aaaa',
      name: 'Zagreb AI Hack',
      city: 'Zagreb',
      country_code: 'HR',
      date_start: '2026-11-02T00:00:00+00:00',
      date_end: '2026-11-04T00:00:00+00:00',
      topics: ['ai', 'web'],
      notes: null,
      url: 'https://example.hr/zagreb-ai-hack',
      status: 'upcoming',
      is_new: true,
    },
  ],
}

test('maps an entry into an IngestRow', () => {
  const [first] = parseHackTrack(PAYLOAD)
  assert.equal(first.source, 'hacktrack')
  assert.equal(first.source_id, '07464d77-a094-4fd8-971a-dbff782b838c')
  assert.equal(first.title, 'Encode London Hackathon and Conference')
  assert.equal(first.url, 'https://lu.ma/encode-london-2026')
  assert.equal(first.starts_at, '2026-10-23T00:00:00.000Z')
  assert.equal(first.ends_at, '2026-10-25T00:00:00.000Z')
  assert.equal(first.format, 'in_person')
  // The listing never states one — must not be invented.
  assert.equal(first.registration_deadline, undefined)
})

// The whole point of the country map: every geography check downstream is a
// substring test against names, so a bare "HR" would be invisible to scoring.
test('expands ISO country codes to names the geography checks can match', () => {
  const [, zagreb] = parseHackTrack(PAYLOAD)
  assert.equal(zagreb.location_raw, 'Zagreb, Croatia')
  assert.ok(zagreb.location_raw.toLowerCase().includes('croatia'))
  assert.deepEqual(zagreb.themes, ['ai', 'web'])
})

test('placeOf handles partial and unknown geography', () => {
  assert.equal(placeOf('Valletta', 'MT'), 'Valletta, Malta')
  assert.equal(placeOf(null, 'IS'), 'Iceland')
  assert.equal(placeOf('Belgrade', null), 'Belgrade')
  // Unknown code passes through rather than being dropped or guessed.
  assert.equal(placeOf('Somewhere', 'ZZ'), 'Somewhere, ZZ')
  assert.equal(placeOf(null, null), null)
})

test('maps the countries the catalog had nothing for', () => {
  for (const [code, name] of [
    ['MT', 'Malta'],
    ['BG', 'Bulgaria'],
    ['HR', 'Croatia'],
    ['SK', 'Slovakia'],
    ['RS', 'Serbia'],
    ['CY', 'Cyprus'],
    ['LU', 'Luxembourg'],
    ['IS', 'Iceland'],
  ] as const) {
    assert.equal(placeOf('X', code), `X, ${name}`)
  }
})

test('entries without a title or url are dropped, not half-mapped', () => {
  const rows = parseHackTrack({
    data: [
      { id: '1', name: 'No URL', city: 'Paris', country_code: 'FR' },
      { id: '2', url: 'https://example.com', city: 'Paris', country_code: 'FR' },
    ],
  })
  assert.deepEqual(rows, [])
})

test('an entry with no place stays unknown rather than claiming in-person', () => {
  const [row] = parseHackTrack({
    data: [{ id: '3', name: 'Somewhere Hack', url: 'https://example.com', date_start: null }],
  })
  assert.equal(row.format, null)
  assert.equal(row.location_raw, null)
  assert.equal(row.starts_at, null)
})

test('malformed dates become null instead of Invalid Date', () => {
  const [row] = parseHackTrack({
    data: [{ id: '4', name: 'Bad Date', url: 'https://x.test', date_start: 'not-a-date' }],
  })
  assert.equal(row.starts_at, null)
})
