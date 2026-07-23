import assert from 'node:assert/strict'
import test from 'node:test'

import {
  matchesHackathon,
  extractDetailDate,
  parseEventDate,
} from '../lib/ingest/startuplithuania'

test('matchesHackathon keeps hackathons and drops other startup events', () => {
  assert.equal(matchesHackathon('Students Hack Vilnius 6.0'), true)
  assert.equal(matchesHackathon('Student Vibecoding Hackathon by ISM x bolt.new'), true)
  assert.equal(matchesHackathon('International Space Innovation Hackathon ActInSpace 2026'), true)
  assert.equal(matchesHackathon('AI Buildathon'), true)
  assert.equal(matchesHackathon('Vilniaus Hakatonas 2026'), true)

  assert.equal(matchesHackathon('Smart City Conference 2026'), false)
  assert.equal(matchesHackathon('Startup Fair'), false)
  assert.equal(matchesHackathon('Founders Hike'), false)
  assert.equal(matchesHackathon('Fundraising Bootcamp'), false)
})

test('extractDetailDate reads the event date from the article title, not related events', () => {
  const html = `
    <div class="col-md-9 post-124265 cpstart_events">
      <h1 class="single-article__title">Space Hackathon 2026
        <div class="listing__date"><div class="listing__date-holder">
          Jan 30, 14:00 - Jan 31, 18:00
        </div></div>
      </h1>
      <div class="related">
        <div class="listing__date"><div class="listing__date-holder">Nov 09, 09:00 - Nov 12, 20:00</div></div>
      </div>
    </div>`
  assert.equal(extractDetailDate(html), 'Jan 30, 14:00 - Jan 31, 18:00')
  assert.equal(extractDetailDate('<div>no date here</div>'), null)
})

test('parseEventDate infers the year from the publish date (single day, two times)', () => {
  // Published Nov 2025, event "Dec 13" -> Dec 2025.
  const d = parseEventDate('Dec 13, 08:00, 23:00', '2025-11-05T00:00:00')
  assert.ok(d)
  assert.equal(d!.starts_at, '2025-12-13T08:00:00.000Z')
  assert.equal(d!.ends_at, '2025-12-13T23:00:00.000Z')
})

test('parseEventDate handles multi-day ranges with times', () => {
  const d = parseEventDate('Nov 24, 10:00 - Nov 28, 16:00', '2025-10-28T00:00:00')
  assert.ok(d)
  assert.equal(d!.starts_at, '2025-11-24T10:00:00.000Z')
  assert.equal(d!.ends_at, '2025-11-28T16:00:00.000Z')
})

test('parseEventDate handles day-only ranges (no times)', () => {
  const d = parseEventDate('May 14 - May 16', '2026-03-03T00:00:00')
  assert.ok(d)
  assert.equal(d!.starts_at, '2026-05-14T00:00:00.000Z')
  assert.equal(d!.ends_at, '2026-05-16T23:59:00.000Z')
})

test('parseEventDate rolls the end year over a Dec -> Jan boundary', () => {
  const d = parseEventDate('Dec 30, 10:00 - Jan 02, 18:00', '2026-11-01T00:00:00')
  assert.ok(d)
  assert.equal(d!.starts_at, '2026-12-30T10:00:00.000Z')
  assert.equal(d!.ends_at, '2027-01-02T18:00:00.000Z')
})

test('parseEventDate picks next year when the date precedes the publish anchor', () => {
  // Published mid-April, event "Apr 24" of the following year would be > publish,
  // but the same-year Apr 24 is only ~10 days after publish -> stays same year.
  const same = parseEventDate('Apr 24, 10:00, 19:00', '2026-04-14T00:00:00')
  assert.equal(same!.starts_at, '2026-04-24T10:00:00.000Z')

  // Published in June, event "Apr 24" -> next April (past the 30d grace).
  const next = parseEventDate('Apr 24, 10:00, 19:00', '2026-06-01T00:00:00')
  assert.equal(next!.starts_at, '2027-04-24T10:00:00.000Z')
})

test('parseEventDate returns null on unparseable input', () => {
  assert.equal(parseEventDate('TBА', '2026-01-01T00:00:00'), null)
  assert.equal(parseEventDate('', '2026-01-01T00:00:00'), null)
})
