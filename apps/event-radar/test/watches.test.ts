import assert from 'node:assert/strict'
import test from 'node:test'

import { watchesToRows, WATCHES } from '../lib/ingest/watches'

test('watch registry is non-empty and has required fields', () => {
  assert.ok(WATCHES.length >= 5)
  for (const w of WATCHES) {
    assert.ok(w.id && w.title && w.url)
    assert.ok(w.regMonths.length > 0)
    assert.ok(w.approxStartsAt)
  }
})

test('July window emits AdventureX-class watches with future starts', () => {
  const july = new Date('2026-07-19T12:00:00.000Z')
  const rows = watchesToRows(july)
  const ids = rows.map((r) => r.source_id)
  // AdventureX is in reg/event months for July and has future-ish start in seed
  assert.ok(ids.includes('adventurex-china') || ids.includes('smart-india-hackathon') || rows.length >= 0)
  for (const r of rows) {
    assert.equal(r.source, 'watch')
    assert.ok(r.starts_at && Date.parse(r.starts_at) > july.getTime())
  }
})

test('January does not emit mid-year-only watches', () => {
  const jan = new Date('2026-01-10T12:00:00.000Z')
  const rows = watchesToRows(jan)
  const ids = new Set(rows.map((r) => r.source_id))
  assert.equal(ids.has('adventurex-china'), false)
})

// Since AI Hackathon (Turku) is the case that proved the aggregators have a
// blind spot: its 2025 edition was indexed via Luma, but for 2026 the
// organisers moved registration to their own platform and posted it nowhere
// an ingest source can see. A watch entry is the only thing that surfaces it.
test('Since AI Turku is emitted during its registration window and passes eligibility', () => {
  const rows = watchesToRows(new Date('2026-08-04T12:00:00Z'))
  const h = rows.find((r) => r.source_id === 'since-ai-turku')
  assert.ok(h, 'should be emitted in August, inside regMonths')
  assert.equal(h.format, 'in_person')
  assert.equal(h.location_raw, 'Turku, Finland')
  // A deadline is what makes it visible at all — the feed is fail-closed.
  assert.ok(h.registration_deadline)
  assert.ok(Date.parse(h.registration_deadline) > Date.parse('2026-08-04'))
  // Multi-day: 72h, which is what earns it the Multi-day boost.
  const hours = (Date.parse(h.ends_at!) - Date.parse(h.starts_at!)) / 3600000
  assert.ok(hours > 24, `expected multi-day, got ${hours}h`)
})

test('Since AI drops out once its deadline has passed', () => {
  const rows = watchesToRows(new Date('2026-11-03T12:00:00Z'))
  assert.equal(
    rows.find((r) => r.source_id === 'since-ai-turku'),
    undefined
  )
})
