import assert from 'node:assert/strict'
import test from 'node:test'

import { genericTravelFaqUrls } from '../lib/ingest/travel-circuits'

test('probes organizer-hosted in-person events on their own origin', () => {
  const urls = genericTravelFaqUrls({ url: 'https://hackzurich.com/2026/apply', format: 'in_person' })
  assert.deepEqual(urls, [
    'https://hackzurich.com/faq',
    'https://hackzurich.com/travel',
    'https://hackzurich.com/logistics',
  ])
})

test('treats unknown format as crawlable (org sites often omit format)', () => {
  const urls = genericTravelFaqUrls({ url: 'https://someuni-hack.org/', format: null })
  assert.equal(urls.length, 3)
  assert.ok(urls[0].startsWith('https://someuni-hack.org/'))
})

test('skips online events — no in-person travel to reimburse', () => {
  assert.deepEqual(genericTravelFaqUrls({ url: 'https://hackxyz.org/', format: 'online' }), [])
})

test('skips aggregator-hosted listings (their page is not the organizer site)', () => {
  for (const url of [
    'https://lu.ma/abc123',
    'https://devpost.com/software/foo',
    'https://www.hackquest.io/hackathon/bar',
    'https://devfolio.co/projects/baz',
  ]) {
    assert.deepEqual(genericTravelFaqUrls({ url, format: 'in_person' }), [], url)
  }
})

test('is fail-safe on a malformed URL', () => {
  assert.deepEqual(genericTravelFaqUrls({ url: 'not a url', format: 'in_person' }), [])
  assert.deepEqual(genericTravelFaqUrls({ url: null, format: 'in_person' }), [])
})
