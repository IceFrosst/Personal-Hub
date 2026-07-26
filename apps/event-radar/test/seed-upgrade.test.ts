import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSeedPatch, type ExistingRow } from '../lib/ingest/seed-upgrade'
import type { IngestRow } from '../lib/ingest/devpost'

const NOW = new Date('2026-07-26T12:00:00Z')

function existing(over: Partial<ExistingRow> = {}): ExistingRow {
  return {
    id: 'row-1',
    url: 'https://hackthenorth.com/',
    registration_deadline: null,
    format: null,
    location_raw: null,
    ...over,
  }
}

function seed(over: Partial<IngestRow> = {}): IngestRow {
  return {
    source: 'known',
    source_id: 'hack-the-north-2026',
    title: 'Hack the North 2026',
    url: 'https://hackthenorth.com/',
    starts_at: '2026-09-18T12:00:00.000Z',
    ends_at: '2026-09-20T22:00:00.000Z',
    location_raw: 'Waterloo, Canada',
    format: 'in_person',
    prize_pool: null,
    registration_deadline: '2026-08-15T23:59:59.000Z',
    themes: [],
    ...over,
  }
}

test('repairs the real Hack the North case: MLH row with a null deadline', () => {
  const patch = buildSeedPatch(existing(), seed(), NOW)
  assert.deepEqual(patch, {
    registration_deadline: '2026-08-15T23:59:59.000Z',
    format: 'in_person',
    location_raw: 'Waterloo, Canada',
  })
})

test('replaces a stale (already past) deadline — the BigRed//Hacks case', () => {
  const patch = buildSeedPatch(
    existing({ registration_deadline: '2026-03-15T00:00:00Z', format: 'in_person' }),
    seed(),
    NOW
  )
  assert.equal(patch?.registration_deadline, '2026-08-15T23:59:59.000Z')
  assert.equal(patch?.format, undefined) // already set — untouched
})

test('never overwrites a valid future deadline from the real source', () => {
  const patch = buildSeedPatch(
    existing({
      registration_deadline: '2026-08-01T00:00:00Z',
      format: 'in_person',
      location_raw: 'Waterloo',
    }),
    seed(),
    NOW
  )
  assert.equal(patch, null)
})

test('only known/watch seeds may upgrade a row', () => {
  assert.equal(buildSeedPatch(existing(), seed({ source: 'mlh' }), NOW), null)
  assert.equal(buildSeedPatch(existing(), seed({ source: 'luma' }), NOW), null)
  assert.ok(buildSeedPatch(existing(), seed({ source: 'watch' }), NOW))
})

test('a seed with no usable future deadline cannot clear an existing one', () => {
  assert.equal(
    buildSeedPatch(
      existing({ format: 'in_person', location_raw: 'x' }),
      seed({ registration_deadline: null }),
      NOW
    ),
    null
  )
  // Past or unparseable seed deadlines are ignored too.
  assert.equal(
    buildSeedPatch(
      existing({ format: 'in_person', location_raw: 'x' }),
      seed({ registration_deadline: '2026-01-01T00:00:00Z' }),
      NOW
    ),
    null
  )
  assert.equal(
    buildSeedPatch(
      existing({ format: 'in_person', location_raw: 'x' }),
      seed({ registration_deadline: 'not-a-date' }),
      NOW
    ),
    null
  )
})

test('unparseable existing deadline counts as missing', () => {
  const patch = buildSeedPatch(
    existing({ registration_deadline: 'garbage', format: 'in_person', location_raw: 'x' }),
    seed(),
    NOW
  )
  assert.deepEqual(patch, { registration_deadline: '2026-08-15T23:59:59.000Z' })
})
