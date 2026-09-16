import assert from 'node:assert/strict'
import test from 'node:test'

import {
  candidateSlugs,
  dayBounds,
  expandLocation,
  frontMatterToRow,
  isWanted,
  normaliseUrl,
  parseFrontMatter,
  slugsFromSitemap,
} from '../lib/ingest/hackathonhub'

/** Verbatim shape of hackathonhub.eu/events/<slug>.md on 2026-09-16. */
const MD = `---
title: "AaltoAI Hackathon: Data Sovereignty & Responsible AI"
date: 2026-09-18T00:00:00+00:00
end_date: 2026-09-20T00:00:00+00:00
location: "Espoo, FI"
format: onsite
type: hackathon
level: student
prize: €10,000.00
tags: "ai, data-science, cybersecurity, fintech, social-impact"
url: "https://luma.com/heyq2zch"
canonical: "https://hackathonhub.eu/events/aaltoai-hackathon-data-sovereignty-responsible-ai-espoo-2026"
---

# AaltoAI Hackathon: Data Sovereignty & Responsible AI

**Date:** 2026-09-18 — 2026-09-20
`

test('front matter parses flat key: value lines, unquoting and treating N/A as null', () => {
  const fm = parseFrontMatter(MD)!
  assert.equal(fm.title, 'AaltoAI Hackathon: Data Sovereignty & Responsible AI')
  assert.equal(fm.location, 'Espoo, FI')
  assert.equal(fm.type, 'hackathon')
  assert.equal(fm.prize, '€10,000.00')
  assert.equal(fm.url, 'https://luma.com/heyq2zch')
  assert.equal(parseFrontMatter(MD.replace('prize: €10,000.00', 'prize: N/A'))!.prize, null)
  assert.equal(parseFrontMatter('# no front matter'), null)
})

test('row: organiser URL normalised to lu.ma so it collides with the Luma source row', () => {
  const row = frontMatterToRow(parseFrontMatter(MD)!, 'aaltoai-hackathon-data-sovereignty-responsible-ai-espoo-2026')!
  assert.equal(row.source, 'hackathonhub')
  assert.equal(row.url, 'https://lu.ma/heyq2zch')
  assert.equal(row.source_id, 'aaltoai-hackathon-data-sovereignty-responsible-ai-espoo-2026')
  assert.equal(row.location_raw, 'Espoo, Finland', 'ISO code expanded — downstream checks are substring tests')
  assert.equal(row.format, 'in_person')
  assert.equal(row.prize_pool, '€10,000.00')
  assert.deepEqual(row.themes, ['ai', 'data-science', 'cybersecurity', 'fintech', 'social-impact'])
  assert.equal(row.starts_at, '2026-09-18T00:00:00.000Z')
  assert.equal(row.ends_at, '2026-09-20T23:59:59.000Z', 'midnight end means the whole day')
})

test('day bounds: same-day event stays under 24h, two-day reads as multi-day, explicit times pass through', () => {
  const one = dayBounds('2026-09-17T00:00:00+00:00', '2026-09-17T00:00:00+00:00')
  assert.equal(one.ends_at, '2026-09-17T23:59:59.000Z')
  const hours = (Date.parse(one.ends_at!) - Date.parse(one.starts_at!)) / 3600000
  assert.ok(hours < 24)
  const timed = dayBounds('2026-09-11T00:00:00+00:00', '2026-09-13T23:59:00+00:00')
  assert.equal(timed.ends_at, '2026-09-13T23:59:00.000Z')
  assert.equal(dayBounds('2026-10-01T00:00:00+00:00', '2026-09-01T00:00:00+00:00').ends_at, '2026-10-01T23:59:59.000Z', 'end before start collapses to start day')
  assert.equal(dayBounds(null, null).starts_at, null)
})

test('type filter: hackathons and game jams stay; a hack-titled "competition" stays; accelerators go', () => {
  const fm = parseFrontMatter(MD)!
  assert.equal(isWanted(fm), true)
  assert.equal(isWanted({ ...fm, type: 'gamejam' }), true)
  assert.equal(isWanted({ ...fm, type: 'competition', title: 'Hackathon Future Smart City 2026' }), true)
  assert.equal(isWanted({ ...fm, type: 'competition', title: 'AI Pitch Competition' }), false)
  assert.equal(isWanted({ ...fm, type: 'challenge', title: 'MassChallenge Switzerland Accelerator 2026' }), false)
})

test('location expansion and URL normalisation edge cases', () => {
  assert.equal(expandLocation('Stubach, Salzburg, AT'), 'Stubach, Salzburg, Austria')
  assert.equal(expandLocation('Berlin, DE'), 'Berlin, Germany')
  assert.equal(expandLocation('Brabant region, NL'), 'Brabant region, Netherlands')
  assert.equal(expandLocation('Online'), 'Online')
  assert.equal(expandLocation(null), null)
  assert.equal(normaliseUrl('https://www.luma.com/abc?utm_source=hub#x', null), 'https://lu.ma/abc')
  assert.equal(normaliseUrl('https://www.eventbrite.com/e/x-tickets-123', null), 'https://www.eventbrite.com/e/x-tickets-123')
  assert.equal(normaliseUrl(null, 'https://hackathonhub.eu/events/some-slug-2026'), 'https://hackathonhub.eu/events/some-slug-2026', 'falls back to the Hub page when the organiser link is missing')
  assert.equal(normaliseUrl('not a url', null), null)
})

test('sitemap: slugs extracted, and past-year editions pre-filtered before any detail fetch', () => {
  const xml = `<urlset><url><loc>https://hackathonhub.eu/events/music-ai-hackathon-stubach-2026</loc><lastmod>2026-09-16</lastmod></url>
<url><loc>https://hackathonhub.eu/events/hackzurich-2024</loc></url>
<url><loc>https://hackathonhub.eu/events/hackaburg-2027</loc></url>
<url><loc>https://hackathonhub.eu/events/evergreen-series</loc></url>
<url><loc>https://hackathonhub.eu/about</loc></url></urlset>`
  const slugs = slugsFromSitemap(xml)
  assert.deepEqual(slugs, ['music-ai-hackathon-stubach-2026', 'hackzurich-2024', 'hackaburg-2027', 'evergreen-series'])
  assert.deepEqual(candidateSlugs(slugs, new Date('2026-09-16T00:00:00Z')), [
    'music-ai-hackathon-stubach-2026',
    'hackaburg-2027',
    'evergreen-series',
  ])
})
