import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalUrl,
  dayBounds,
  extractLdEvents,
  isHackathonName,
  parseEventbritePage,
} from '../lib/ingest/eventbrite'

/** Shape lifted from a real /d/germany/hackathon/ page (2026-09-09), trimmed. */
function page(events: Array<Record<string, unknown>>): string {
  const list = {
    '@context': 'http://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: { '@type': 'Event', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', ...e },
    })),
  }
  return `<!doctype html><html><head><title>Hackathon events in Germany</title>
<script type="application/ld+json">${JSON.stringify({ '@type': 'Organization', name: 'Eventbrite' })}</script>
<script type="application/ld+json">${JSON.stringify(list)}</script>
</head><body><div id="root"></div></body></html>`
}

const ev = (name: string, over: Record<string, unknown> = {}) => ({
  name,
  url: `https://www.eventbrite.de/e/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tickets-1992649646734?aff=ebdssbdestsearch`,
  startDate: '2026-09-21',
  endDate: '2026-09-22',
  location: {
    '@type': 'Place',
    name: 'Cumulocity GmbH Leipzig',
    address: { '@type': 'PostalAddress', addressLocality: 'Leipzig', addressRegion: 'SN', addressCountry: 'DE' },
  },
  ...over,
})

test('extracts Events nested inside the ItemList, ignoring other JSON-LD blocks', () => {
  const html = page([ev('Cumulocity AIoT Hackathon'), ev('Barcamp Leipzig')])
  const events = extractLdEvents(html)
  assert.equal(events.length, 2)
  assert.equal(events[0].name, 'Cumulocity AIoT Hackathon')
})

test('keeps hackathons, drops the fuzzy fill and the recruiting fairs', () => {
  assert.equal(isHackathonName('Cumulocity AIoT Hackathon'), true)
  assert.equal(isHackathonName('Social Hackathon Bonn'), true)
  assert.equal(isHackathonName('Finnebrogue Hack'), true)
  assert.equal(isHackathonName('Recharge Eindhoven Hackathon'), true)
  // Fuzzy search padding — exactly what page 2 of Germany looks like.
  assert.equal(isHackathonName('KI-Barcamp Jena'), false)
  assert.equal(isHackathonName('LinkedIn Marketing Bootcamp'), false)
  assert.equal(isHackathonName('Munich Tech Job Fair Autumn 2026'), false)
  // Wears the word, is a hiring event: 40 of 95 name matches in the probe.
  assert.equal(isHackathonName('HackerX - Munich - Employer Ticket - 9/24'), false)
  assert.equal(isHackathonName('WomenHack - Tallinn - Employer Ticket - December 15, 2026'), false)
})

test('a page maps to IngestRows with the queried country, clean URL and source id', () => {
  const { rows, total } = parseEventbritePage(
    page([ev('Cumulocity AIoT Hackathon'), ev('Barcamp Leipzig'), ev('HackerX - Berlin - Employer Ticket')]),
    'Germany'
  )
  assert.equal(total, 3, 'total counts every Event, filtered or not')
  assert.equal(rows.length, 1)
  const r = rows[0]
  assert.equal(r.source, 'eventbrite')
  assert.equal(r.title, 'Cumulocity AIoT Hackathon')
  assert.equal(r.url, 'https://www.eventbrite.de/e/cumulocity-aiot-hackathon-tickets-1992649646734')
  assert.equal(r.source_id, '1992649646734')
  assert.equal(r.location_raw, 'Leipzig, Germany')
  assert.equal(r.format, 'in_person')
  assert.equal(r.registration_deadline, undefined, 'no deadline in the payload — enrichment fills it')
})

test('the queried country wins over a noisy card country code', () => {
  // Real cases: a Vienna hackathon tagged "AU", a Berlin one tagged "NL".
  const vienna = ev('Vibecoding Hackathon: Build Your MVP in One Evening', {
    location: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Vienna', addressCountry: 'AU' } },
  })
  const { rows } = parseEventbritePage(page([vienna]), 'Austria')
  assert.equal(rows[0].location_raw, 'Vienna, Austria')
})

test('calendar-day dates become day bounds so Multi-day means what it says', () => {
  const two = dayBounds('2026-09-21', '2026-09-22')
  assert.equal(two.starts_at, '2026-09-21T00:00:00.000Z')
  assert.equal(two.ends_at, '2026-09-22T23:59:59.000Z')
  const hours = (Date.parse(two.ends_at!) - Date.parse(two.starts_at!)) / 3600000
  assert.ok(hours > 24 && hours < 48.01, `two-day event is ~48h, got ${hours}`)

  const one = dayBounds('2026-10-18', '2026-10-18')
  const oneHours = (Date.parse(one.ends_at!) - Date.parse(one.starts_at!)) / 3600000
  assert.ok(oneHours < 24, `one-day event stays under the 24h multi-day bar, got ${oneHours}`)

  // No end → same day. Real instants pass through untouched.
  assert.equal(dayBounds('2026-10-18', null).ends_at, '2026-10-18T23:59:59.000Z')
  assert.equal(dayBounds('2026-10-18T09:00:00Z', '2026-10-18T18:00:00Z').ends_at, '2026-10-18T18:00:00.000Z')
  // End before start is a data error → collapse to the start day.
  assert.equal(dayBounds('2026-10-18', '2026-10-01').ends_at, '2026-10-18T23:59:59.000Z')
})

test('online listings carry no place; mixed mode is hybrid', () => {
  const online = ev('Veeam Community Hackathon', {
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: { '@type': 'VirtualLocation', url: 'https://example.com' },
  })
  const mixed = ev('Slack Hackathon - Virtual or In-Person', {
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
  })
  const { rows } = parseEventbritePage(page([online, mixed]), 'United Kingdom')
  assert.equal(rows[0].format, 'online')
  assert.equal(rows[0].location_raw, null)
  assert.equal(rows[1].format, 'hybrid')
  assert.equal(rows[1].location_raw, 'Leipzig, United Kingdom')
})

test('canonicalUrl strips tracking params and rejects non-Eventbrite hosts', () => {
  assert.equal(
    canonicalUrl('https://www.eventbrite.co.uk/e/x-tickets-123?aff=ebdssbdestsearch&keep-this=no'),
    'https://www.eventbrite.co.uk/e/x-tickets-123'
  )
  assert.equal(canonicalUrl('https://lu.ma/abc'), null)
  assert.equal(canonicalUrl('not a url'), null)
})

test('a 200 with no JSON-LD events parses to total 0 (drift signal, not "no events")', () => {
  const { rows, total } = parseEventbritePage('<html><body>Please enable JavaScript</body></html>', 'Poland')
  assert.equal(total, 0)
  assert.equal(rows.length, 0)
})
