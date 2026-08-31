export interface BusyInterval {
  start: Date
  end: Date
}

/** Offset (minutes) such that `localWallClock = utcInstant + offset`. */
function utcOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const map: Record<string, string> = {}
  for (const part of parts) map[part.type] = part.value
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  )
  return Math.round((asIfUtc - instant.getTime()) / 60000)
}

/** `YYYY-MM-DD` local calendar date for an instant in a timezone. */
export function localDateKey(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const map: Record<string, string> = {}
  for (const part of parts) map[part.type] = part.value
  return `${map.year}-${map.month}-${map.day}`
}

/** Add calendar days without applying the server's local timezone. */
export function addLocalDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

/** UTC instant corresponding to local midnight at the start of a date. */
export function localMidnight(dateKey: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const wallClockAsUtc = Date.UTC(year, month - 1, day)
  let instant = new Date(wallClockAsUtc)
  for (let i = 0; i < 3; i++) {
    instant = new Date(wallClockAsUtc - utcOffsetMinutes(instant, timeZone) * 60000)
  }
  return instant
}

export function buildCandidateWindow(now: Date, timeZone: string, windowDays: number) {
  const firstCandidateKey = addLocalDays(localDateKey(now, timeZone), 1)
  const candidateKeys = Array.from({ length: windowDays }, (_, index) => addLocalDays(firstCandidateKey, index))
  return {
    candidateKeys,
    timeMin: localMidnight(firstCandidateKey, timeZone),
    timeMax: localMidnight(addLocalDays(firstCandidateKey, windowDays), timeZone),
  }
}

/** Parse only trustworthy Calendar freeBusy intervals; null means fail closed. */
export function extractBusyIntervals(body: unknown, calendarId: string): BusyInterval[] | null {
  if (typeof body !== 'object' || body === null) return null
  const calendars = (body as Record<string, unknown>).calendars
  if (typeof calendars !== 'object' || calendars === null) return null
  const entry = (calendars as Record<string, unknown>)[calendarId]
  if (typeof entry !== 'object' || entry === null) return null
  const errors = (entry as Record<string, unknown>).errors
  if (Array.isArray(errors) && errors.length > 0) return null
  const busy = (entry as Record<string, unknown>).busy
  if (!Array.isArray(busy)) return null

  const intervals: BusyInterval[] = []
  for (const item of busy) {
    if (typeof item !== 'object' || item === null) return null
    const start = (item as Record<string, unknown>).start
    const end = (item as Record<string, unknown>).end
    if (typeof start !== 'string' || typeof end !== 'string') return null
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return null
    intervals.push({ start: startDate, end: endDate })
  }
  return intervals
}

/** Return completely free local days, or null when the payload is untrustworthy. */
export function freeDatesFromResponse(
  body: unknown,
  calendarId: string,
  candidateKeys: string[],
  timeZone: string
): string[] | null {
  const busyIntervals = extractBusyIntervals(body, calendarId)
  if (busyIntervals === null) return null
  return candidateKeys.filter((day) => {
    const dayStart = localMidnight(day, timeZone).getTime()
    const dayEnd = localMidnight(addLocalDays(day, 1), timeZone).getTime()
    return !busyIntervals.some((busy) => busy.start.getTime() < dayEnd && busy.end.getTime() > dayStart)
  })
}
