import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAllHackathonsList, parseListDate } from '../lib/ingest/allhackathons'

// Captured verbatim from the 2026-07-26 open-egress probe of
// https://allhackathons.com/hackathons/ and https://tr.allhackathons.com/hackathons/.
const LIST_HTML = `
<div class="col-12">
<!-- Job -->
<div class="row align-items-center bg-white mb-4 py-5 px-4">
  <div class="col-lg-2"> </div>
  <div class="col-lg-7 mt-4 mt-lg-0">
    <span class="badge bg-success font-weight-bold letter-spacing-lg"> IN-PERSON </span>
    <a href="/hackathon/ai-women-hackathon-2026/" class="h5 text-darkblue d-block mt-3"> AI.WOMEN Hackathon 2026 </a>
    <p>Sept. 12, 2026 - Sept. 13, 2026</p>
    <div>Upcoming</div>
    <p class="text-muted mt-2 mb-0"> AI.WOMEN Hackathon &mdash; 12&ndash;13 September 2026, Hamburg &hellip; </p>
  </div>
  <div class="col-lg-3 text-lg-center mt-4 mt-lg-0">
    <a href="/hackathon/ai-women-hackathon-2026/" class="btn btn-sm btn-pastel-purple">Read more</a>
    <div class="font-size-sm text-muted mt-3">
      <a href="/themes/ai/">ai </a> <span class="mx-2"> &middot; </span>
      <a href="/themes/machine-learning/">machine learning </a> <span class="mx-2"> &middot; </span> Germany
    </div>
  </div>
</div>
<!-- Job -->
<div class="row align-items-center bg-white mb-4 py-5 px-4">
  <div class="col-lg-2"><img class="img-fluid" src="/media/data/c/scrapyard.png" /></div>
  <div class="col-lg-7 mt-4 mt-lg-0">
    <span class="badge bg-success font-weight-bold letter-spacing-lg"> ONLINE </span>
    <a href="/hackathon/zoo-api-makeathon/" class="h5 text-darkblue d-block mt-3"> Zoo API Makeathon </a>
    <p>March 3, 2027 - March 5, 2027</p>
    <div>Upcoming</div>
    <p class="text-muted mt-2 mb-0"> Build with the Zoo API &hellip; </p>
  </div>
  <div class="col-lg-3 text-lg-center mt-4 mt-lg-0">
    <div class="font-size-sm text-muted mt-3">
      <a href="/themes/api/">api </a> <span class="mx-2"> &middot; </span> United States
    </div>
  </div>
</div>
</div>
`

// Turkish subdomain — same template, localised badge and month names.
const TR_HTML = `
<!-- Job -->
<div class="row align-items-center bg-white mb-4 py-5 px-4">
  <div class="col-lg-7 mt-4 mt-lg-0">
    <span class="badge bg-success font-weight-bold letter-spacing-lg"> YÜZ YÜZE </span>
    <a href="/hackathon/scrapyard-istanbul/" class="h5 text-darkblue d-block mt-3"> Scrapyard İstanbul </a>
    <p>15 Mart 2025 - 16 Mart 2025</p>
    <div>Bitti</div>
  </div>
  <div class="col-lg-3 text-lg-center mt-4 mt-lg-0">
    <div class="font-size-sm text-muted mt-3">
      <a href="/themes/games/">oyunlar </a> <span class="mx-2"> &middot; </span> Turkey
    </div>
  </div>
</div>
`

test('parses a listing card into an IngestRow', () => {
  const rows = parseAllHackathonsList(LIST_HTML)
  assert.equal(rows.length, 2)

  const [first] = rows
  assert.equal(first.source, 'allhackathons')
  assert.equal(first.title, 'AI.WOMEN Hackathon 2026')
  assert.equal(first.url, 'https://allhackathons.com/hackathon/ai-women-hackathon-2026/')
  assert.equal(first.source_id, 'ai-women-hackathon-2026')
  assert.equal(first.format, 'in_person')
  assert.equal(first.location_raw, 'Germany')
  assert.equal(first.starts_at, '2026-09-12T08:00:00.000Z')
  assert.equal(first.ends_at, '2026-09-13T23:59:59.000Z')
  assert.deepEqual(first.themes, ['ai', 'machine-learning'])
  // Never invented — the listing states no deadline.
  assert.equal(first.registration_deadline, undefined)
})

test('maps the ONLINE badge and spelled-out months', () => {
  const [, online] = parseAllHackathonsList(LIST_HTML)
  assert.equal(online.format, 'online')
  assert.equal(online.location_raw, 'United States')
  assert.equal(online.starts_at, '2027-03-03T08:00:00.000Z')
})

test('handles the Turkish template — localised badge, country still readable', () => {
  const rows = parseAllHackathonsList(TR_HTML)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, 'Scrapyard İstanbul')
  assert.equal(rows[0].format, 'in_person')
  assert.equal(rows[0].location_raw, 'Turkey')
  // Turkish month names are not parsed — a null start is honest, and the
  // fail-closed feed drops the row rather than inventing a date.
  assert.equal(rows[0].starts_at, null)
})

test('markup with no job blocks yields nothing rather than throwing', () => {
  assert.deepEqual(parseAllHackathonsList('<html><body>nothing here</body></html>'), [])
})

test('parseListDate rejects junk and impossible dates', () => {
  assert.equal(parseListDate('Sept. 12, 2026'), '2026-09-12T08:00:00.000Z')
  assert.equal(parseListDate('July 4, 2026'), '2026-07-04T08:00:00.000Z')
  assert.equal(parseListDate('Feb. 31, 2026'), null)
  assert.equal(parseListDate('Smarch 3, 2026'), null)
  assert.equal(parseListDate('15 Mart 2025'), null)
  assert.equal(parseListDate(''), null)
})
