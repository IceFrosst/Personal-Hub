import assert from 'node:assert/strict'
import test from 'node:test'

import { selectNewArrivals } from '../lib/new-arrivals'
import { coerceHackathon } from '../lib/types'

const NOW = new Date('2026-07-30T12:00:00Z')
const never = () => false

function row(over: Record<string, unknown> = {}) {
  return coerceHackathon({
    id: 'r1',
    source: 'luma',
    title: 'Fresh Hack',
    url: 'https://lu.ma/fresh',
    created_at: '2026-07-30T09:00:00Z', // 3h old
    starts_at: '2026-09-01T09:00:00Z',
    format: 'in_person',
    themes: [],
    ...over,
  })
}

// The reason this tab exists: a row ingested minutes ago has no deadline yet,
// and the fail-closed feed hides it. If "New" required eligibility it would be
// empty exactly when you open it after a refresh.
test('keeps a brand-new row that has no registration deadline', () => {
  const out = selectNewArrivals([row({ registration_deadline: null })], never, NOW)
  assert.equal(out.length, 1)
})

test('drops anything older than the New window', () => {
  const stale = row({ id: 'old', created_at: '2026-07-25T09:00:00Z' }) // 5 days
  assert.deepEqual(selectNewArrivals([stale], never, NOW), [])
})

test('drops events that have already started', () => {
  const past = row({ id: 'past', starts_at: '2026-07-01T09:00:00Z' })
  assert.deepEqual(selectNewArrivals([past], never, NOW), [])
})

test('keeps a new row whose start date is still unknown', () => {
  const undated = row({ id: 'undated', starts_at: null })
  assert.equal(selectNewArrivals([undated], never, NOW).length, 1)
})

test('respects rows the user hid', () => {
  const hidden = row({ id: 'hidden-one' })
  assert.deepEqual(
    selectNewArrivals([hidden], (h) => h.id === 'hidden-one', NOW),
    []
  )
})

test('orders by arrival, newest first — not by score', () => {
  const older = row({ id: 'a', created_at: '2026-07-30T06:00:00Z' })
  const newer = row({ id: 'b', created_at: '2026-07-30T11:00:00Z' })
  const out = selectNewArrivals([older, newer], never, NOW)
  assert.deepEqual(
    out.map((h) => h.id),
    ['b', 'a']
  )
})

test('an unparseable created_at is not treated as new', () => {
  // A missing created_at is coerced to "now" on purpose (a synthetic row counts
  // as just-created), so the guard that matters is against garbage timestamps.
  assert.deepEqual(selectNewArrivals([row({ created_at: 'not-a-date' })], never, NOW), [])
})
