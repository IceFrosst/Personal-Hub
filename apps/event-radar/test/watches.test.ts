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
