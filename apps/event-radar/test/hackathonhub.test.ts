import assert from 'node:assert/strict'
import test from 'node:test'

import {
  dayBounds,
  hasSupport,
  isEnglish,
  isWanted,
  normaliseUrl,
  placeOf,
  prizeEur,
  prizeLabel,
  queryUrl,
  selectRows,
  toRow,
  type HubEvent,
} from '../lib/ingest/hackathonhub'

const NOW = new Date('2026-09-16T12:00:00Z')

/** Shape of one `events_public` row as served on 2026-09-16 (fields we read). */
const AALTO: HubEvent = {
  id: 'a1',
  slug: 'aaltoai-hackathon-data-sovereignty-responsible-ai-espoo-2026',
  title: 'AaltoAI Hackathon: Data Sovereignty & Responsible AI',
  title_en: 'AaltoAI Hackathon: Data Sovereignty & Responsible AI',
  url: 'https://luma.com/heyq2zch',
  type: 'hackathon',
  location_type: 'onsite',
  city: 'Espoo',
  state: null,
  country: 'FI',
  start_date: '2026-09-18T00:00:00+00:00',
  end_date: '2026-09-20T00:00:00+00:00',
  application_deadline: '2026-09-17T18:00:00+00:00',
  prize_money: 10000,
  prize_money_currency: 'EUR',
  prize_money_eur: 10000,
  language: 'en',
  tags: ['ai', 'data-science', 'cybersecurity'],
  status: 'published',
  level: 'student',
}

test('row mapping: English title, organiser URL on lu.ma, country name, EUR prize, and a real deadline', () => {
  const row = toRow(AALTO)!
  assert.equal(row.source, 'hackathonhub')
  assert.equal(row.url, 'https://lu.ma/heyq2zch')
  assert.equal(row.source_id, AALTO.slug)
  assert.equal(row.location_raw, 'Espoo, Finland')
  assert.equal(row.format, 'in_person')
  assert.equal(row.prize_pool, '€10,000')
  assert.equal(row.registration_deadline, '2026-09-17T18:00:00.000Z', 'the Hub is the one aggregator that states a deadline')
  assert.equal(row.starts_at, '2026-09-18T00:00:00.000Z')
  assert.equal(row.ends_at, '2026-09-20T23:59:59.000Z', 'midnight end means the whole day')
  assert.deepEqual(row.themes, ['ai', 'data-science', 'cybersecurity'])
})

test('English only: the language code must be exactly "en"', () => {
  assert.equal(isEnglish({ language: 'en' }), true)
  assert.equal(isEnglish({ language: 'EN ' }), true)
  assert.equal(isEnglish({ language: 'de' }), false)
  assert.equal(isEnglish({ language: 'mixed' }), false, '"mixed" is not a promise of English')
  assert.equal(isEnglish({ language: null }), false)
  assert.equal(isWanted({ ...AALTO, language: 'de' }), false)
})

test('prize money only: EUR-normalised first, raw amount second, zero and null drop the event', () => {
  assert.equal(prizeEur({ prize_money_eur: 7200, prize_money: 7000 }), 7200)
  assert.equal(prizeEur({ prize_money_eur: null, prize_money: '15000' }), 15000)
  assert.equal(prizeEur({ prize_money_eur: 0, prize_money: 0 }), null)
  assert.equal(prizeEur({ prize_money_eur: null, prize_money: null }), null)
  assert.equal(prizeLabel({ prize_money_eur: 7200, prize_money: 7000, prize_money_currency: 'CHF' }), '€7,200')
  assert.equal(prizeLabel({ prize_money_eur: null, prize_money: 15000, prize_money_currency: 'PLN' }), '15,000 PLN')
  assert.equal(isWanted({ ...AALTO, prize_money: null, prize_money_eur: null }), false)
  assert.equal(isWanted(AALTO), true)
})

test('no prize but travel or accommodation support still qualifies, and the booleans ride into the row', () => {
  const noPrize = { ...AALTO, prize_money: null, prize_money_eur: null }
  assert.equal(hasSupport(noPrize), false)
  assert.equal(isWanted({ ...noPrize, travel_costs_covered: true }), true, 'travel covered = the Hub\'s own filter')
  assert.equal(isWanted({ ...noPrize, accommodation_provided: true }), true)
  assert.equal(isWanted({ ...noPrize, accommodation_costs_covered: true }), true)
  assert.equal(isWanted({ ...noPrize, travel_costs_covered: false, accommodation_provided: null }), false)

  const row = toRow({ ...noPrize, travel_costs_covered: true, accommodation_provided: true })!
  assert.equal(row.prize_pool, null)
  assert.equal(row.travel_covered, true)
  assert.equal(row.accommodation_covered, true)

  // A stated "false" is NOT written: enrichment may still find reimbursement
  // wording on the organiser page, and null is what lets it run.
  const plain = toRow(AALTO)!
  assert.equal(plain.travel_covered, null)
  assert.equal(plain.accommodation_covered, null)
})

test('hackathon shape: type hackathon/gamejam, or a hack-titled challenge; accelerators and pitch competitions go', () => {
  assert.equal(isWanted({ ...AALTO, type: 'gamejam' }), true)
  assert.equal(isWanted({ ...AALTO, type: 'challenge', title_en: 'Hackathon Future Smart City 2026' }), true)
  assert.equal(isWanted({ ...AALTO, type: 'competition', title_en: 'AI Pitch Competition' }), false)
  assert.equal(isWanted({ ...AALTO, type: 'challenge', title_en: 'MassChallenge Switzerland Accelerator 2026' }), false)
})

test('selectRows: unpublished, past and duplicate-URL events drop; the rest pass in order', () => {
  const rows = selectRows(
    [
      AALTO,
      { ...AALTO, id: 'a2', slug: 'dup', url: 'https://www.luma.com/heyq2zch?utm_source=x' },
      { ...AALTO, id: 'a3', slug: 'past', url: 'https://example.org/past', start_date: '2026-09-01T00:00:00+00:00' },
      { ...AALTO, id: 'a4', slug: 'draft', url: 'https://example.org/draft', status: 'draft' },
      { ...AALTO, id: 'a5', slug: 'de', url: 'https://example.org/de', language: 'de' },
      { ...AALTO, id: 'a6', slug: 'free', url: 'https://example.org/free', prize_money: null, prize_money_eur: null },
    ],
    NOW
  )
  assert.deepEqual(rows.map((r) => r.url), ['https://lu.ma/heyq2zch'])
})

test('a row filed as onsite with city "Online" is online, not "Online, Austria"', () => {
  const row = toRow({ ...AALTO, city: 'Online', state: null, country: 'AT', location_type: 'onsite' })!
  assert.equal(row.format, 'online')
  assert.equal(row.location_raw, null)
})

test('place and URL helpers', () => {
  assert.equal(placeOf({ city: 'Stubach', state: 'Salzburg', country: 'AT' }), 'Stubach, Salzburg, Austria')
  assert.equal(placeOf({ city: 'Berlin', state: 'Berlin', country: 'DE' }), 'Berlin, Germany', 'state repeating the city is dropped')
  assert.equal(placeOf({ city: null, state: null, country: 'LT' }), 'Lithuania')
  assert.equal(placeOf({ city: null, state: null, country: null }), null)
  assert.equal(normaliseUrl(null, 'some-slug-2026'), 'https://hackathonhub.eu/events/some-slug-2026', 'falls back to the Hub page')
  assert.equal(normaliseUrl('not a url', null), null)
  assert.equal(dayBounds('2026-10-01T00:00:00+00:00', '2026-09-01T00:00:00+00:00').ends_at, '2026-10-01T23:59:59.000Z')
})

test('query asks the public view for published, future events only', () => {
  const u = new URL(queryUrl(NOW, 0))
  assert.equal(u.pathname, '/rest/v1/events_public')
  assert.equal(u.searchParams.get('status'), 'eq.published')
  assert.equal(u.searchParams.get('start_date'), 'gte.2026-09-16T12:00:00.000Z')
  assert.equal(u.searchParams.get('limit'), '1000')
  assert.equal(new URL(queryUrl(NOW, 2)).searchParams.get('offset'), '2000')
})
