import assert from 'node:assert/strict'
import test from 'node:test'

import { continentOf, regionKeyOf } from '../lib/continents'
import { coerceFeedPrefs, mergeFeedPrefs } from '../lib/feed-prefs'

type Geo = { country?: string | null; city?: string | null; location_raw?: string | null; title?: string }
const geo = (g: Geo) => ({
  country: g.country ?? null,
  city: g.city ?? null,
  location_raw: g.location_raw ?? null,
  title: g.title ?? 'Some Hackathon',
})

test('country column: every spelling the catalog actually uses', () => {
  // Distinct values seen in hackathon.hackathons on 2026-09-09.
  for (const c of ['USA', 'United States', 'US', 'Canada', 'Mexico', 'México', 'California'])
    assert.equal(continentOf(geo({ country: c })), 'north_america', c)
  for (const c of ['United Kingdom', 'UK', 'England', 'Germany', 'Türkiye', 'Turkey', 'Czechia', 'Lithuania'])
    assert.equal(continentOf(geo({ country: c })), 'europe', c)
  for (const c of ['India', 'Singapore', 'Hong Kong', 'South Korea', '中国', 'United Arab Emirates'])
    assert.equal(continentOf(geo({ country: c })), 'asia', c)
  for (const c of ['Kenya', 'Nigeria', 'Egypt', 'South Africa', 'Malawi'])
    assert.equal(continentOf(geo({ country: c })), 'africa', c)
  for (const c of ['Brazil', 'Colombia', 'Argentina', 'Peru'])
    assert.equal(continentOf(geo({ country: c })), 'south_america', c)
  for (const c of ['Australia', 'New Zealand'])
    assert.equal(continentOf(geo({ country: c })), 'oceania', c)
})

test('location_raw when the country column is empty — the common case', () => {
  const cases: Array<[string, ReturnType<typeof continentOf>]> = [
    ['Philadelphia, PA', 'north_america'],
    ['Austin, TX', 'north_america'],
    ['San Francisco, CA', 'north_america'],
    ['Toronto, ON', 'north_america'],
    ['Burnaby, British Columbia', 'north_america'],
    ['Green Bay, WI', 'north_america'],
    ['Manteca, California, United States', 'north_america'],
    ['Albuquerque, NM, USA', 'north_america'],
    ['Santiago de Querétaro, Mexico', 'north_america'],
    ['Hlavní město Praha, Czechia', 'europe'],
    ['München, Germany', 'europe'],
    ['Beşiktaş, Türkiye', 'europe'],
    ['London, England', 'europe'],
    ['Kupittaa Campus, Turku', 'europe'],
    ['Zürich, Switzerland', 'europe'],
    ['Malmö, Sweden', 'europe'],
    ['København, Denmark', 'europe'],
    ['Europe', 'europe'],
    ['Bengaluru, India', 'asia'],
    ['Mumbai, Maharashtra', 'asia'],
    ['Subang Jaya, Malaysia', 'asia'],
    ['Dubai, United Arab Emirates', 'asia'],
    ['Accra, Ghana', 'africa'],
    ['NCC Digital Park, University of Ibadan', 'africa'],
    ['Charters Towers, Queensland, Australia', 'oceania'],
    ['Shanghai, Shanghai, China', 'asia'],
  ]
  for (const [loc, want] of cases) assert.equal(continentOf(geo({ location_raw: loc })), want, loc)
})

test('Georgia: the US state and the country are told apart', () => {
  assert.equal(continentOf(geo({ location_raw: 'Atlanta, Georgia' })), 'north_america')
  assert.equal(continentOf(geo({ location_raw: 'Tbilisi, Georgia' })), 'europe')
  assert.equal(continentOf(geo({ country: 'Georgia', city: 'Tbilisi' })), 'europe')
  assert.equal(continentOf(geo({ country: 'Georgia', city: 'Atlanta' })), 'north_america')
  // Bare country column = the country (matches travel-for-me.ts); bare
  // free-text "City, Georgia" = the US convention MLH and Devpost use.
  assert.equal(continentOf(geo({ country: 'Georgia' })), 'europe')
  assert.equal(continentOf(geo({ location_raw: 'Macon, Georgia' })), 'north_america')
})

test('title is the last resort, and only city names count there', () => {
  assert.equal(
    continentOf(geo({ title: 'Munich Hub - Hack Nation Global AI Hackathon' })),
    'europe'
  )
  assert.equal(
    continentOf(geo({ title: 'Pittsburgh Hub (Carnegie Mellon) - Hack Nation' })),
    'north_america'
  )
  assert.equal(continentOf(geo({ title: 'Bombay Hub - Hack Nation Global AI Hackathon' })), 'asia')
  // Country words in a title are not a venue.
  assert.equal(continentOf(geo({ title: 'Hack for Ukraine' })), null)
  assert.equal(continentOf(geo({ title: 'Hackathon mit KI' })), null, 'German "mit" is not MIT')
  assert.equal(continentOf(geo({ title: 'New York Hackathon' })), 'north_america', 'not York, UK')
})

test('nothing readable → null, and the filter key is "unknown"', () => {
  for (const g of [
    geo({}),
    geo({ location_raw: 'Mitchell Park Community Center' }),
    geo({ location_raw: 'In-person' }),
    geo({ location_raw: 'Location TBA' }),
    geo({ location_raw: 'Global (local + online)' }),
  ]) {
    assert.equal(continentOf(g), null, g.location_raw ?? '(empty)')
    assert.equal(regionKeyOf(g), 'unknown')
  }
})

test('word boundaries: Niger is not Nigeria, Oman is not Romania, Indiana is not India', () => {
  assert.equal(continentOf(geo({ location_raw: 'Niamey, Niger' })), 'africa')
  assert.equal(continentOf(geo({ location_raw: 'Bucharest, Romania' })), 'europe')
  assert.equal(continentOf(geo({ location_raw: 'Bloomington, Indiana' })), 'north_america')
  assert.equal(continentOf(geo({ location_raw: 'Latin America' })), 'south_america')
})

test('feed prefs: hidden_regions round-trips, junk is dropped, foreign keys survive', () => {
  assert.deepEqual(coerceFeedPrefs(null), { hidden_regions: [] })
  assert.deepEqual(coerceFeedPrefs({ hidden_regions: ['north_america', 'bogus', 'unknown', 'unknown'] }), {
    hidden_regions: ['north_america', 'unknown'],
  })
  const merged = mergeFeedPrefs({ future_key: 1, hidden_regions: ['asia'] }, { hidden_regions: ['europe'] })
  assert.deepEqual(merged, { future_key: 1, hidden_regions: ['europe'] })
})
