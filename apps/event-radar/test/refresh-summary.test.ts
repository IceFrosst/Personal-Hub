import assert from 'node:assert/strict'
import test from 'node:test'

import { formatRefreshSummary } from '../lib/refresh-summary'

test('summarizes a successful source refresh', () => {
  assert.deepEqual(
    formatRefreshSummary({
      sources: { devpost: 3, mlh: 2, ethglobal: 1, hackerearth: 0, hackclub: 4 },
      inserted: 3,
      enriched: 2,
    }),
    {
      tone: 'success',
      message: 'Refresh complete — 5 sources checked, 3 new, 2 enriched.',
      details: 'Devpost 3 · MLH 2 · ETHGlobal 1 · HackerEarth 0 · Hack Club 4',
    }
  )
})

test('names partial source failures without hiding successful work', () => {
  assert.deepEqual(
    formatRefreshSummary({
      sources: { devpost: 3, hackerearth: 'error: blocked' },
      inserted: 1,
      enriched: 4,
    }),
    {
      tone: 'warning',
      message: 'Refresh finished with errors: HackerEarth. 1 new, 4 enriched.',
      details: 'Devpost 3 · HackerEarth error',
    }
  )
})

test('surfaces a database write failure as a warning without exposing its details', () => {
  assert.deepEqual(
    formatRefreshSummary({
      sources: { devpost: 3 },
      inserted: 0,
      enriched: 1,
      insert_error: 'sensitive database detail',
    }),
    {
      tone: 'warning',
      message: 'Refresh finished with errors: database update. 0 new, 1 enriched.',
      details: 'Devpost 3',
    }
  )
})

test('surfaces a database read failure as a warning without exposing its details', () => {
  assert.deepEqual(
    formatRefreshSummary({
      sources: { mlh: 2 },
      inserted: 0,
      enriched: 0,
      gather_error: 'sensitive database detail',
    }),
    {
      tone: 'warning',
      message: 'Refresh finished with errors: database update. 0 new, 0 enriched.',
      details: 'MLH 2',
    }
  )
})

test('fails closed on a malformed successful response', () => {
  assert.deepEqual(formatRefreshSummary({ inserted: 2, enriched: 1 }), {
    tone: 'warning',
    message: 'Refresh response was incomplete — try again.',
  })
})
