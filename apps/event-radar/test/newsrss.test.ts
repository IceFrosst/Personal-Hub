import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cleanTitle,
  isAnnouncement,
  itemsToRows,
  parseRss,
  queryUrl,
  NEWS_QUERIES,
  MAX_AGE_DAYS,
} from '../lib/ingest/newsrss'

const NOW = new Date('2026-09-15T12:00:00Z')

/** Shape lifted from news.google.com/rss/search?q=hakatonas on 2026-09-15. */
const item = (title: string, pub: string, tokenSuffix: string, publisher = 'Delfi') => `<item>
<title>${title} - ${publisher}</title>
<link>https://news.google.com/rss/articles/CBMiwAFBVV95cUx${tokenSuffix}?oc=5</link>
<guid isPermaLink="false">CBMiwAFBVV95cUx${tokenSuffix}</guid>
<pubDate>${pub}</pubDate>
<description>&lt;a href="https://news.google.com/rss/articles/CBMiwAFBVV95cUx${tokenSuffix}?oc=5"&gt;${title}&lt;/a&gt;</description>
<source url="https://www.delfi.lt">${publisher}</source>
</item>`

const XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>"hakatonas" - Google News</title>
${item('Kibernetiniam atsparumui stiprinti – naujos kartos „Cyber Arena“ šaulių hakatone', 'Wed, 26 Aug 2026 07:00:00 GMT', 'A1')}
${item('Hakatonas policijos bendruomenei: nuo idėjos iki praktinio sprendimo', 'Wed, 10 Jun 2026 09:00:00 GMT', 'A2', 'Lietuvos policija')}
${item('Kaune vykęs hakatonas „Tech_Champ 2026“ subūrė šimtus dalyvių', 'Thu, 02 Apr 2026 10:00:00 GMT', 'A3')}
${item('Vilniuje praūžęs hakatonas parodė naują technologijų kūrimo erą', 'Wed, 03 Sep 2026 10:00:00 GMT', 'A4')}
${item('Google opens applications for Warsaw student AI hackathon', 'Wed, 19 Aug 2026 08:00:00 GMT', 'A5', 'EdTech Innovation Hub')}
${item('Lithuania closes Vilnius airport, NATO summons jets', 'Sun, 13 Sep 2026 06:00:00 GMT', 'A6')}
${item('Šiais metais hakatoną laimėjo komanda iš Kauno', 'Mon, 14 Sep 2026 06:00:00 GMT', 'A7')}
</channel></rss>`

test('parses Google News items with publisher and date', () => {
  const items = parseRss(XML)
  assert.equal(items.length, 7)
  assert.equal(items[0].publisher, 'Delfi')
  assert.equal(items[0].pubDate, 'Wed, 26 Aug 2026 07:00:00 GMT')
  assert.ok(items[0].link.startsWith('https://news.google.com/rss/articles/'))
})

test('announcement filter: the word in any Lithuanian declension, minus recaps', () => {
  assert.equal(isAnnouncement('Hakatonas policijos bendruomenei'), true)
  assert.equal(isAnnouncement('naujos kartos „Cyber Arena“ šaulių hakatone'), true)
  assert.equal(isAnnouncement('Google opens applications for Warsaw student AI hackathon'), true)
  assert.equal(isAnnouncement('Lietuvoje bus surengtas pirmasis ES gynybos hakatonas'), true, '"bus surengtas" is future')
  // Recaps
  assert.equal(isAnnouncement('Kaune vykęs hakatonas „Tech_Champ 2026“'), false)
  assert.equal(isAnnouncement('Vilniuje praūžęs hakatonas parodė naują erą'), false)
  assert.equal(isAnnouncement('Šiais metais hakatoną laimėjo komanda iš Kauno'), false)
  // Present tense is ambiguous ("hosts" can announce or report) and is kept.
  assert.equal(isAnnouncement('Goldman Sachs Hosts the 5th Edition of the Warsaw Hackathon'), true)
  assert.equal(isAnnouncement('Hackathon winners announced'), false)
  // Not a hackathon at all
  assert.equal(isAnnouncement('Lithuania closes Vilnius airport'), false)
})

test('rows: Google link kept as URL (stable, stripped of ?oc), no dates, query prior as location', () => {
  const rows = itemsToRows(parseRss(XML), NEWS_QUERIES[0], NOW)
  assert.deepEqual(
    rows.map((r) => r.title),
    [
      'Kibernetiniam atsparumui stiprinti – naujos kartos „Cyber Arena“ šaulių hakatone — Delfi',
      'Google opens applications for Warsaw student AI hackathon — EdTech Innovation Hub',
    ],
    'police item is older than MAX_AGE_DAYS, recaps and the airport story are dropped'
  )
  const r = rows[0]
  assert.equal(r.source, 'newsrss')
  assert.equal(r.url, 'https://news.google.com/rss/articles/CBMiwAFBVV95cUxA1')
  assert.equal(r.source_id, 'CBMiwAFBVV95cUxA1')
  assert.equal(r.starts_at, null, 'no server-readable article → no dates → New tab only')
  assert.equal(r.location_raw, 'Lithuania')
  assert.equal(r.format, null)
  assert.deepEqual(r.themes, ['news'])
})

test(`items older than ${MAX_AGE_DAYS} days are dropped`, () => {
  const old = `<rss><channel>${item('Hakatonas kviečia registruotis', 'Mon, 01 Jun 2026 08:00:00 GMT', 'B1')}</channel></rss>`
  assert.equal(itemsToRows(parseRss(old), NEWS_QUERIES[0], NOW).length, 0)
  const fresh = `<rss><channel>${item('Hakatonas kviečia registruotis', 'Mon, 14 Sep 2026 08:00:00 GMT', 'B2')}</channel></rss>`
  assert.equal(itemsToRows(parseRss(fresh), NEWS_QUERIES[0], NOW).length, 1)
})

test('cleanTitle swaps Google\'s " - Publisher" suffix for a clear dash', () => {
  assert.equal(cleanTitle('Hakatonas policijai - Delfi', 'Delfi'), 'Hakatonas policijai — Delfi')
  assert.equal(cleanTitle('No suffix here', null), 'No suffix here')
})

test('every configured query is English or Lithuanian, and encodes cleanly', () => {
  for (const q of NEWS_QUERIES) {
    assert.ok(/^[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž() ]+$/.test(q.q.replace(/OR/g, '')), q.q)
    const u = new URL(queryUrl(q))
    assert.equal(u.hostname, 'news.google.com')
    assert.equal(u.searchParams.get('q'), q.q)
  }
})
