// Server-only Google Calendar availability client. Republic does not keep a
// second Google credential: it calls Lock In's private server-to-server bridge,
// which reuses the durable refresh token already stored by Lock In.
//
// The shared secret and endpoint URL stay server-only. The bridge returns date
// keys only—never tokens, event details, or busy intervals—and Republic still
// fails closed if configuration or the upstream lookup is unavailable.

import 'server-only'
import { addLocalDays, buildCandidateWindow, localMidnight } from './calendarAvailability'

const WINDOW_DAYS = 30

export interface FreeDatesResult {
  ok: true
  dates: string[]
}

export interface FreeDatesError {
  ok: false
  error: string
}

export async function getFreeDates(): Promise<FreeDatesResult | FreeDatesError> {
  const endpoint = process.env.LOCK_IN_CALENDAR_API_URL
  const secret = process.env.REPUBLIC_CALENDAR_API_SECRET
  const timeZone = process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Europe/Vilnius'
  if (!endpoint || !secret) return { ok: false, error: 'not_configured' }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
  } catch {
    return { ok: false, error: 'invalid_timezone' }
  }

  const { candidateKeys } = buildCandidateWindow(new Date(), timeZone, WINDOW_DAYS)
  const candidates = candidateKeys.map((date) => ({
    date,
    start: localMidnight(date, timeZone).toISOString(),
    end: localMidnight(addLocalDays(date, 1), timeZone).toISOString(),
  }))

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ candidates }),
      cache: 'no-store',
    })
    if (!response.ok) return { ok: false, error: 'lock_in_unavailable' }
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return { ok: false, error: 'invalid_response' }
    const dates = (body as Record<string, unknown>).dates
    if (!Array.isArray(dates)) return { ok: false, error: 'invalid_response' }
    const allowed = new Set(candidateKeys)
    const validDates = dates.filter(
      (date): date is string => typeof date === 'string' && allowed.has(date)
    )
    if (validDates.length !== dates.length) return { ok: false, error: 'invalid_response' }
    return { ok: true, dates: validDates }
  } catch {
    return { ok: false, error: 'network_error' }
  }
}
