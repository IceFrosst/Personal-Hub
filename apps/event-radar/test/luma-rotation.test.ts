import assert from 'node:assert/strict'
import test from 'node:test'

import { selectQueryWindow, rotationSlot, LUMA_WINDOW } from '../lib/ingest/luma-rotation'

const list = Array.from({ length: 154 }, (_, i) => `q${i}`)

test('returns everything when the list fits in one window', () => {
  const small = ['a', 'b', 'c']
  assert.deepEqual(selectQueryWindow(small, 35, 0), small)
  assert.deepEqual(selectQueryWindow(small, 35, 7), small)
})

test('window is the requested size and deterministic per slot', () => {
  const a = selectQueryWindow(list, 35, 3)
  const b = selectQueryWindow(list, 35, 3)
  assert.equal(a.length, 35)
  assert.deepEqual(a, b)
})

// The starvation bug this file exists to prevent: the tail of a 108-query list
// was never reached before the rate limiter cut the sweep off.
test('a handful of runs covers the entire list', () => {
  const seen = new Set<string>()
  const runs = Math.ceil(list.length / 35)
  for (let slot = 0; slot < runs; slot++) {
    for (const q of selectQueryWindow(list, 35, slot)) seen.add(q)
  }
  assert.equal(seen.size, list.length, `expected full coverage in ${runs} runs, got ${seen.size}`)
})

test('consecutive slots do not overlap while the list is longer than the window', () => {
  const first = new Set(selectQueryWindow(list, 35, 0))
  const second = selectQueryWindow(list, 35, 1)
  assert.ok(
    second.every((q) => !first.has(q)),
    'a fresh slot should advance a whole window, not one entry'
  )
})

test('wraps around the end of the list rather than running short', () => {
  const window = selectQueryWindow(list, 35, 4) // 4*35 = 140, wraps at 154
  assert.equal(window.length, 35)
  assert.equal(new Set(window).size, 35, 'wrap must not duplicate inside one window')
  assert.ok(window.includes('q140'))
  assert.ok(window.includes('q0'), 'should continue from the start after wrapping')
})

test('empty list is handled', () => {
  assert.deepEqual(selectQueryWindow([], 35, 0), [])
})

test('rotationSlot advances over time', () => {
  const t1 = rotationSlot(new Date('2026-07-26T00:00:00Z'))
  const t2 = rotationSlot(new Date('2026-07-26T04:00:00Z'))
  assert.ok(t2 > t1)
  assert.equal(rotationSlot(new Date('2026-07-26T00:30:00Z')), t1, 'same slot within the window')
})

test('default window size is exported and sane', () => {
  assert.ok(LUMA_WINDOW > 0 && LUMA_WINDOW < 60)
})
