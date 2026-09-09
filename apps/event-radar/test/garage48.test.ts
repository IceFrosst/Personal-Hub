import assert from 'node:assert/strict'
import test from 'node:test'

import { extractUpcomingCards, parseGarage48, parseGarageDate, placeOf } from '../lib/ingest/garage48'

const NOW = new Date('2026-09-09T12:00:00Z')

/** Trimmed from garage48.org/events on 2026-09-09 — Voog markup, verbatim shapes. */
const card = (slug: string, title: string, when: string | null, where: string) => `
            <div class="gr-event">
  <div class="gr-event__image-wrap">
    <div class="gr-event__image gr-lazy" data-bg="url(//media.voog.com/x.png)">
    <a href="/events/${slug}"></a>
    </div>
  </div>
  <div class="gr-event__info">
    <div class="gr-event__title-wrap">
      <a href="/events/${slug}">
        <h4 class="gr-event__title">
          ${title}
        </h4>
      </a>
      <a class="gr-event__register"  href="https://form.typeform.com/to/x"  target="_blank">
        <div class="gr-pink-button-small">register</div>
      </a>
    </div>
    <a  href="/events/${slug}" >
      <div class="gr-event__place">
      ${when ? `<div class="gr-flex">When &nbsp<strong>${when}</strong></div>` : ''}
        <div class="gr-flex">Where &nbsp<strong>${where}</strong></div>
      </div>
    </a>
  </div>
</div>`

const PAGE = `<html><body>
    <div class="gr-site-horizontal-pad-80 gr-future-events"><h3 class="gr-events__header">Upcoming events</h3></div>
    <div class="gr-events gr-site-horizontal-pad-80 gr-future-events" data-search-indexing-allowed="true">
      ${card('garage48marketlabthailand', 'Garage48 Market Lab Thailand Edition', null, 'Bangkok, Thailand')}
      ${card('future-of-wood-2026', 'Future of Wood 2026', '  New date! October 16-18', 'EWERS Tehnomaja (Pärna tee 22, Väimela)')}
      ${card('empoweringwomen', 'kood/Garage48 Empowering Women Hackathon', ' 16 - 18 October 2026', 'Jõhvi, Ida-Viru')}
    </div>
    <div class="gr-past-events"><h3 class="gr-events__header">Past events</h3></div>
    <div class="gr-events gr-past-events" data-search-indexing-allowed="true">
      ${card('arvamusfestival', 'Arvamusfestival: What Happens When People Build Together?', ' 8 August 2026', 'Paide, Estonia')}
      ${card('tech-driven-growth', 'Tech Driven Growth', ' 17 April - 30 June, 2026', 'Online in Ukraine')}
    </div>
</body></html>`

test('reads only the upcoming block, never the past one', () => {
  const { cards, totalCards } = extractUpcomingCards(PAGE)
  assert.equal(totalCards, 5, 'total counts both blocks — that is the drift check')
  assert.deepEqual(
    cards.map((c) => c.slug),
    ['garage48marketlabthailand', 'future-of-wood-2026', 'empoweringwomen']
  )
  assert.equal(cards[1].when, 'New date! October 16-18')
  assert.equal(cards[2].where, 'Jõhvi, Ida-Viru')
})

test('every date shape Garage48 actually uses', () => {
  const dayFirstRange = parseGarageDate('16 - 18 October 2026', NOW)
  assert.deepEqual(dayFirstRange, { starts_at: '2026-10-16T00:00:00.000Z', ends_at: '2026-10-18T23:59:59.000Z' })

  // Month-first, yearless, with the organiser's "New date!" prefix → nearest year.
  assert.deepEqual(parseGarageDate('  New date! October 16-18', NOW), dayFirstRange)

  assert.deepEqual(parseGarageDate('8 August 2026', NOW), {
    starts_at: '2026-08-08T00:00:00.000Z',
    ends_at: '2026-08-08T23:59:59.000Z',
  })
  assert.deepEqual(parseGarageDate('17 April - 30 June, 2026', NOW), {
    starts_at: '2026-04-17T00:00:00.000Z',
    ends_at: '2026-06-30T23:59:59.000Z',
  })
  // Year rollover inside a range.
  assert.deepEqual(parseGarageDate('30 December - 1 January 2026', NOW), {
    starts_at: '2026-12-30T00:00:00.000Z',
    ends_at: '2027-01-01T23:59:59.000Z',
  })
  // A yearless date that already passed this year resolves to next year, not
  // to a fake past — but one within the last 30 days stays in this year.
  assert.equal(parseGarageDate('March 5-7', NOW)?.starts_at, '2027-03-05T00:00:00.000Z')
  assert.equal(parseGarageDate('August 20-22', NOW)?.starts_at, '2026-08-20T00:00:00.000Z')

  assert.equal(parseGarageDate('TBA', NOW), null)
  assert.equal(parseGarageDate('', NOW), null)
})

test('Estonian venues get their country; foreign and online ones are left alone', () => {
  assert.equal(placeOf('Jõhvi, Ida-Viru'), 'Jõhvi, Ida-Viru, Estonia')
  assert.equal(placeOf('EWERS Tehnomaja (Pärna tee 22, Väimela)'), 'EWERS Tehnomaja (Pärna tee 22, Väimela), Estonia')
  assert.equal(placeOf('Paide, Estonia'), 'Paide, Estonia')
  assert.equal(placeOf('Bangkok, Thailand'), 'Bangkok, Thailand')
  assert.equal(placeOf('Online in Ukraine'), 'Online in Ukraine')
  assert.equal(placeOf(null), null)
})

test('rows: dated events carry bounds, undated ones carry null and are left to fail-closed', () => {
  const rows = parseGarage48(PAGE, NOW)
  assert.equal(rows.length, 3)
  const [thai, wood, women] = rows
  assert.equal(thai.starts_at, null, 'no "When" → no start, the feed will drop it')
  assert.equal(thai.location_raw, 'Bangkok, Thailand')
  assert.equal(thai.format, 'in_person')

  assert.equal(wood.url, 'https://garage48.org/events/future-of-wood-2026')
  assert.equal(wood.source_id, 'future-of-wood-2026')
  assert.equal(wood.starts_at, '2026-10-16T00:00:00.000Z')
  assert.equal(wood.ends_at, '2026-10-18T23:59:59.000Z')
  assert.equal(wood.location_raw, 'EWERS Tehnomaja (Pärna tee 22, Väimela), Estonia')

  assert.equal(women.title, 'kood/Garage48 Empowering Women Hackathon')
  assert.equal(women.source, 'garage48')
  assert.deepEqual(women.themes, ['garage48'])
  const hours = (Date.parse(women.ends_at!) - Date.parse(women.starts_at!)) / 3600000
  assert.ok(hours > 24, 'a 3-day hackathon reads as multi-day')
})

test('a page with no cards at all parses to nothing (the fetcher treats that as drift)', () => {
  const { cards, totalCards } = extractUpcomingCards('<html><body>Please enable JavaScript</body></html>')
  assert.equal(totalCards, 0)
  assert.equal(cards.length, 0)
})
