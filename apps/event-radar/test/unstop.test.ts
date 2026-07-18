import assert from 'node:assert/strict'
import test from 'node:test'

import { parseUnstopItems } from '../lib/ingest/unstop'

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 1718550,
    title: 'INNOVIK 6.0 : International Hackathon 2026',
    seo_url: 'https://unstop.com/hackathons/innovik-6',
    region: 'offline',
    regn_open: 1,
    end_date: '2026-08-20T19:00:00+05:30',
    regnRequirements: { end_regn_dt: '2026-08-15T00:00:00+05:30' },
    ...overrides,
  }
}

test('proxies starts_at from the registration deadline and maps offline to in_person', () => {
  const [row] = parseUnstopItems([item()])
  assert.equal(row.source, 'unstop')
  assert.equal(row.source_id, '1718550')
  assert.equal(row.url, 'https://unstop.com/hackathons/innovik-6')
  assert.equal(row.registration_deadline, '2026-08-14T18:30:00.000Z')
  assert.equal(row.starts_at, row.registration_deadline)
  assert.equal(row.ends_at, '2026-08-20T13:30:00.000Z')
  assert.equal(row.format, 'in_person')
})

test('maps region online to the online format', () => {
  const [row] = parseUnstopItems([item({ region: 'online' })])
  assert.equal(row.format, 'online')
})

test('builds a URL from public_url when seo_url is missing', () => {
  const [row] = parseUnstopItems([
    item({ seo_url: null, public_url: 'hackathons/innovik-6' }),
  ])
  assert.equal(row.url, 'https://unstop.com/hackathons/innovik-6')
})

test('leaves start and deadline null when the registration window is absent', () => {
  const [row] = parseUnstopItems([item({ regnRequirements: null })])
  assert.equal(row.starts_at, null)
  assert.equal(row.registration_deadline, null)
})

test('skips items with no title or resolvable URL', () => {
  assert.equal(parseUnstopItems([item({ title: '' }), item({ seo_url: null, public_url: null })]).length, 0)
})
