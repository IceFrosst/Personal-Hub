import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCandidateWindow,
  freeDatesFromResponse,
  localMidnight,
} from '../lib/calendarAvailability.ts'

const ZONE = 'Europe/Vilnius'
const CALENDAR = 'target@example.com'

function response(busy) {
  return { calendars: { [CALENDAR]: { busy } } }
}

test('candidate dates begin tomorrow in the configured local timezone', () => {
  const window = buildCandidateWindow(new Date('2025-06-14T21:30:00.000Z'), ZONE, 3)
  assert.deepEqual(window.candidateKeys, ['2025-06-16', '2025-06-17', '2025-06-18'])
})

test('Europe/Vilnius local-day boundaries cover 23- and 25-hour DST days', () => {
  const springHours = (localMidnight('2025-03-31', ZONE).getTime() - localMidnight('2025-03-30', ZONE).getTime()) / 3_600_000
  const autumnHours = (localMidnight('2025-10-27', ZONE).getTime() - localMidnight('2025-10-26', ZONE).getTime()) / 3_600_000
  assert.equal(springHours, 23)
  assert.equal(autumnHours, 25)
})

test('any busy overlap excludes the whole local day', () => {
  const candidates = ['2025-06-15', '2025-06-16']
  const free = freeDatesFromResponse(
    response([{ start: '2025-06-15T09:00:00+03:00', end: '2025-06-15T09:30:00+03:00' }]),
    CALENDAR,
    candidates,
    ZONE
  )
  assert.deepEqual(free, ['2025-06-16'])
})

test('half-open boundaries do not block adjacent days', () => {
  const candidates = ['2025-06-15', '2025-06-16']
  const free = freeDatesFromResponse(
    response([
      { start: '2025-06-14T22:00:00+03:00', end: '2025-06-15T00:00:00+03:00' },
      { start: '2025-06-17T00:00:00+03:00', end: '2025-06-17T01:00:00+03:00' },
    ]),
    CALENDAR,
    candidates,
    ZONE
  )
  assert.deepEqual(free, candidates)
})

test('malformed busy payloads and calendar errors fail closed', () => {
  const candidates = ['2025-06-15']
  const malformed = { calendars: { [CALENDAR]: { busy: [{ start: 'not-a-date', end: '2025-06-15T10:00:00Z' }] } } }
  const calendarError = { calendars: { [CALENDAR]: { errors: [{ reason: 'notFound' }], busy: [] } } }
  assert.equal(freeDatesFromResponse(malformed, CALENDAR, candidates, ZONE), null)
  assert.equal(freeDatesFromResponse(calendarError, CALENDAR, candidates, ZONE), null)
  assert.equal(freeDatesFromResponse({ calendars: {} }, CALENDAR, candidates, ZONE), null)
})
