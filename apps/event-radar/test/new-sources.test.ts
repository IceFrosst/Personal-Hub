import assert from 'node:assert/strict'
import test from 'node:test'

import { parseUnstop } from '../lib/ingest/unstop'
import { parseDevfolio } from '../lib/ingest/devfolio'
import { parseDoraHacks } from '../lib/ingest/dorahacks'

// Fixtures mirror the real API shapes captured from each platform's public
// JSON endpoint. They guard the field mapping (the part that silently rots when
// a provider renames a key), not the network fetch.

test('parseUnstop maps the nested opportunity payload', () => {
  const rows = parseUnstop([
    {
      id: 12345,
      title: 'Global AI Hackathon',
      seo_url: 'https://unstop.com/hackathons/global-ai-hackathon-12345',
      start_date: '2026-08-01T00:00:00+05:30',
      end_date: '2026-08-03T00:00:00+05:30',
      region: 'online',
      regnRequirements: {
        start_regn_dt: '2026-07-01T00:00:00+05:30',
        end_regn_dt: '2026-07-28T23:59:59+05:30',
        reg_status: 'YET_TO_START',
      },
      prizes: [{ rank: '1', cash: '100000', currency: 'fa-rupee-sign' }],
      address_with_country_logo: {
        city: 'Bengaluru',
        state: 'Karnataka',
        country: { name: 'India' },
      },
      filters: [
        { type: 'category', name: 'Machine Learning' },
        { type: 'eligible', name: 'Undergrad' },
      ],
    },
  ])

  assert.equal(rows.length, 1)
  const row = rows[0]
  assert.equal(row.source, 'unstop')
  assert.equal(row.source_id, '12345')
  assert.equal(row.url, 'https://unstop.com/hackathons/global-ai-hackathon-12345')
  assert.equal(row.format, 'online')
  assert.equal(row.starts_at, new Date('2026-08-01T00:00:00+05:30').toISOString())
  assert.equal(
    row.registration_deadline,
    new Date('2026-07-28T23:59:59+05:30').toISOString()
  )
  assert.equal(row.location_raw, 'Bengaluru, Karnataka, India')
  assert.equal(row.prize_pool, '₹100000')
  assert.deepEqual(row.themes, ['Machine Learning'])
})

test('parseUnstop falls back to the registration window for missing dates and prefixes relative urls', () => {
  const rows = parseUnstop([
    {
      title: 'Relative Url Hack',
      seo_url: 'hackathons/relative-url-hack',
      region: 'offline',
      regnRequirements: {
        start_regn_dt: '2026-09-01T00:00:00+05:30',
        end_regn_dt: '2026-09-15T00:00:00+05:30',
      },
    },
    { title: 'No Url' }, // dropped: no seo_url
  ])

  assert.equal(rows.length, 1)
  assert.equal(rows[0].url, 'https://unstop.com/hackathons/relative-url-hack')
  assert.equal(rows[0].format, 'in_person')
  assert.equal(rows[0].starts_at, new Date('2026-09-01T00:00:00+05:30').toISOString())
  assert.equal(rows[0].ends_at, new Date('2026-09-15T00:00:00+05:30').toISOString())
})

test('parseDevfolio builds the subdomain url and reads the online flag', () => {
  const rows = parseDevfolio([
    {
      name: 'ETHIndia',
      slug: 'ethindia2026',
      starts_at: '2026-12-05T00:00:00.000Z',
      ends_at: '2026-12-07T00:00:00.000Z',
      location: 'Bengaluru, India',
      is_online: false,
    },
    {
      name: 'Online Only',
      slug: 'online-only',
      starts_at: '2026-10-01T00:00:00.000Z',
      ends_at: '2026-10-02T00:00:00.000Z',
      is_online: true,
    },
    { slug: 'no-name' }, // dropped: no name
  ])

  assert.equal(rows.length, 2)
  assert.equal(rows[0].url, 'https://ethindia2026.devfolio.co/')
  assert.equal(rows[0].format, 'in_person')
  assert.equal(rows[0].location_raw, 'Bengaluru, India')
  assert.equal(rows[0].source_id, 'ethindia2026')
  assert.equal(rows[1].format, 'online')
  assert.equal(rows[1].location_raw, null)
})

test('parseDoraHacks converts epoch seconds and dedupes by uname', () => {
  const rows = parseDoraHacks([
    {
      id: 7,
      title: 'Web3 Global',
      uname: 'web3-global',
      start_time: 1785110400, // 2026-07-27T12:00:00Z
      end_time: 1785283200,
      participation_form: 'Virtual',
      field: ['DeFi', 'Infra'],
    },
    {
      id: 7,
      title: 'Web3 Global (dupe)',
      uname: 'web3-global',
      start_time: 1785110400,
    },
    {
      title: 'In Person Hack',
      uname: 'in-person-hack',
      start_time: 1785110400,
      venue_name: 'Lisbon',
      participation_form: 'In-Person',
      field: 'Gaming',
    },
  ])

  assert.equal(rows.length, 2)
  assert.equal(rows[0].url, 'https://dorahacks.io/hackathon/web3-global/detail')
  assert.equal(rows[0].starts_at, new Date(1785110400 * 1000).toISOString())
  assert.equal(rows[0].format, 'online')
  assert.deepEqual(rows[0].themes, ['DeFi', 'Infra'])
  assert.equal(rows[1].format, 'in_person')
  assert.equal(rows[1].location_raw, 'Lisbon')
  assert.deepEqual(rows[1].themes, ['Gaming'])
})
