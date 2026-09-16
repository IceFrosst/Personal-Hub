import assert from 'node:assert/strict'
import test from 'node:test'

import { feedStartCutoff, fetchAllPages } from '../lib/feed-query'

test('walks pages until a short one and concatenates in order', async () => {
  const data = Array.from({ length: 2345 }, (_, i) => i)
  const calls: Array<[number, number]> = []
  const rows = await fetchAllPages(async (from, to) => {
    calls.push([from, to])
    return data.slice(from, to + 1)
  }, 1000)
  assert.equal(rows.length, 2345)
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]])
  assert.equal(rows[2344], 2344)
})

test('an exact multiple of the page size costs one extra, empty request and no more', async () => {
  const data = Array.from({ length: 2000 }, (_, i) => i)
  let calls = 0
  const rows = await fetchAllPages(async (from, to) => {
    calls++
    return data.slice(from, to + 1)
  }, 1000)
  assert.equal(rows.length, 2000)
  assert.equal(calls, 3)
})

test('the runaway guard stops an endless source', async () => {
  const rows = await fetchAllPages(async () => Array.from({ length: 10 }, () => 'x'), 10, 3)
  assert.equal(rows.length, 30)
})

test('cutoff is the top of the current UTC hour', () => {
  assert.equal(feedStartCutoff(new Date('2026-09-16T13:47:12.345Z')), '2026-09-16T13:00:00.000Z')
})
