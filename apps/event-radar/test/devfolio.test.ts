import assert from 'node:assert/strict'
import test from 'node:test'

import { parseDevfolioHits } from '../lib/ingest/devfolio'

function hit(source: Record<string, unknown>) {
  return { _source: source }
}

test('maps a Devfolio hit onto its slug subdomain and reg deadline', () => {
  const [row] = parseDevfolioHits([
    hit({
      uuid: 'abc123',
      slug: 'hackvsit-7',
      name: 'HackVSIT7.0',
      starts_at: '2026-07-24T03:00:00+00:00',
      ends_at: '2026-07-25T05:30:00+00:00',
      is_online: false,
      city: 'New Delhi',
      country: 'India',
      location: 'VIPS-TC, Delhi',
      hackathon_setting: { reg_ends_at: '2026-07-19T18:29:00+00:00' },
    }),
  ])
  assert.equal(row.source, 'devfolio')
  assert.equal(row.source_id, 'abc123')
  assert.equal(row.url, 'https://hackvsit-7.devfolio.co')
  assert.equal(row.starts_at, '2026-07-24T03:00:00.000Z')
  assert.equal(row.ends_at, '2026-07-25T05:30:00.000Z')
  assert.equal(row.registration_deadline, '2026-07-19T18:29:00.000Z')
  assert.equal(row.format, 'in_person')
  assert.equal(row.location_raw, 'VIPS-TC, Delhi')
})

test('flags online hackathons and falls back to city/country for location', () => {
  const [row] = parseDevfolioHits([
    hit({ slug: 'remote-hack', name: 'Remote Hack', is_online: true, city: 'Remote', country: 'World' }),
  ])
  assert.equal(row.format, 'online')
  assert.equal(row.location_raw, 'Remote, World')
})

test('leaves format unknown when is_online is absent', () => {
  const [row] = parseDevfolioHits([hit({ slug: 's', name: 'n' })])
  assert.equal(row.format, null)
  assert.equal(row.registration_deadline, null)
})

test('skips hits missing a slug or name', () => {
  assert.equal(parseDevfolioHits([hit({ slug: 'only-slug' }), hit({ name: 'only-name' })]).length, 0)
})

test('coerces object and string themes, dropping blanks', () => {
  const [row] = parseDevfolioHits([
    hit({ slug: 's', name: 'n', themes: ['AI', { name: 'Web3' }, '', { name: null }] }),
  ])
  assert.deepEqual(row.themes, ['AI', 'Web3'])
})
