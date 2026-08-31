// Server-only Google Calendar free/busy lookup, reusing the durable Google
// connection already established by Lock In.
//
// Lock In stores Ignas's offline Google refresh token in
// `lock_in.calendar_connections`. This module reads that one token with the
// shared Supabase service-role key, refreshes it with the same Google OAuth
// client used by Lock In, then calls Google's freeBusy endpoint for the
// connected account's primary calendar. Republic therefore does not need a
// second Google authorization or service account.
//
// SECURITY: every credential remains server-only. The public route returns
// date strings only; it never returns the refresh/access token, event titles,
// descriptions, attendees, or busy intervals. This module performs no
// calendar writes and fails closed on every config/auth/network/data error.

import 'server-only'
import { buildCandidateWindow, freeDatesFromResponse } from './calendarAvailability'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy'
const LOCK_IN_SCHEMA = 'lock_in'
const PRIMARY_CALENDAR = 'primary'
const WINDOW_DAYS = 30

export interface FreeDatesResult {
  ok: true
  /** ISO 'YYYY-MM-DD' local calendar dates, ascending, with zero busy time. */
  dates: string[]
}

export interface FreeDatesError {
  ok: false
  error: string
}

interface CalendarConfig {
  supabaseUrl: string
  serviceRoleKey: string
  accountEmail: string
  oauthClientId: string
  oauthClientSecret: string
  timeZone: string
}

function readConfig(): CalendarConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const accountEmail = process.env.GOOGLE_CALENDAR_ACCOUNT_EMAIL
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const timeZone = process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Europe/Vilnius'
  if (!supabaseUrl || !serviceRoleKey || !accountEmail || !oauthClientId || !oauthClientSecret) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
  } catch {
    return null
  }
  return { supabaseUrl, serviceRoleKey, accountEmail, oauthClientId, oauthClientSecret, timeZone }
}

async function readLockInRefreshToken(config: CalendarConfig): Promise<string | null> {
  const url = new URL(`${config.supabaseUrl}/rest/v1/calendar_connections`)
  url.searchParams.set('select', 'google_refresh_token')
  url.searchParams.set('google_email', `eq.${config.accountEmail}`)
  url.searchParams.set('limit', '1')

  try {
    const response = await fetch(url, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        'Accept-Profile': LOCK_IN_SCHEMA,
      },
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (!Array.isArray(body) || body.length !== 1) return null
    const row = body[0]
    if (typeof row !== 'object' || row === null) return null
    const token = (row as Record<string, unknown>).google_refresh_token
    return typeof token === 'string' && token.length > 0 ? token : null
  } catch {
    return null
  }
}

async function refreshAccessToken(config: CalendarConfig, refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.oauthClientId,
        client_secret: config.oauthClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return null
    const token = (body as Record<string, unknown>).access_token
    return typeof token === 'string' && token.length > 0 ? token : null
  } catch {
    return null
  }
}

/**
 * Returns upcoming local dates with zero busy time on the Google account
 * already connected through Lock In. Any timed or all-day interval touching
 * a date excludes that entire date.
 */
export async function getFreeDates(): Promise<FreeDatesResult | FreeDatesError> {
  const config = readConfig()
  if (!config) return { ok: false, error: 'not_configured' }

  const refreshToken = await readLockInRefreshToken(config)
  if (!refreshToken) return { ok: false, error: 'lock_in_connection_missing' }
  const accessToken = await refreshAccessToken(config, refreshToken)
  if (!accessToken) return { ok: false, error: 'auth_failed' }

  const { candidateKeys, timeMin, timeMax } = buildCandidateWindow(new Date(), config.timeZone, WINDOW_DAYS)

  let response: Response
  try {
    response = await fetch(FREEBUSY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: config.timeZone,
        items: [{ id: PRIMARY_CALENDAR }],
      }),
      cache: 'no-store',
    })
  } catch {
    return { ok: false, error: 'network_error' }
  }

  if (!response.ok) return { ok: false, error: 'freebusy_failed' }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, error: 'invalid_response' }
  }

  const freeDates = freeDatesFromResponse(body, PRIMARY_CALENDAR, candidateKeys, config.timeZone)
  if (freeDates === null) return { ok: false, error: 'invalid_response' }
  return { ok: true, dates: freeDates }
}
