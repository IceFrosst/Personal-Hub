// Server-only Google Calendar free/busy lookup, via a service account.
//
// SECURITY: this module reads private key material from env vars
// (GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) and must only ever be imported from a
// server-only file — today that's exactly one place,
// app/api/available-dates/route.ts (a Route Handler, which always runs on
// the server). Never import this from a Client Component or anything that
// could end up in a browser bundle.
//
// Deliberately no `googleapis` SDK (heavyweight for one read-only call) —
// builds and signs the service-account JWT with Node's built-in `crypto`,
// exchanges it for an OAuth2 access token, then calls the freeBusy endpoint
// directly. Only busy/free *intervals* are ever read from the response —
// never event titles, descriptions, attendees, or any other detail — and
// this module never writes anything to the calendar (read-only, freeBusy
// only, no events.insert/patch/delete anywhere in this file).
//
// Fails closed everywhere: any missing env var, auth failure, network
// error, or malformed response resolves `{ ok: false }` rather than
// throwing or fabricating a date — see app/api/available-dates/route.ts,
// which turns that into an empty `dates` array for the client. Nothing here
// ever returns a "free" date it isn't actually sure about.

import 'server-only'
import { createSign } from 'crypto'
import { WINDOW_DAYS, buildCandidateWindow, freeDatesFromResponse } from './calendarAvailability'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy'
const SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy'

// Bounded upcoming window — now lives in lib/calendarAvailability.ts so the
// client-side appointment calendar can browse the same span of months the
// server actually queried. Still caps the day-walking loop below at a sane
// size regardless of any malformed interval data.

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
  calendarId: string
  timeZone: string
  clientEmail: string
  privateKey: string
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function readConfig(): CalendarConfig | null {
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  const timeZone = process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Europe/Vilnius'
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!calendarId || calendarId.trim().toLowerCase() === 'primary' || !clientEmail || !rawKey) return null
  try {
    // Validate before any date calculations so a typo also follows the
    // module's fail-closed contract instead of escaping as a RangeError.
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
  } catch {
    return null
  }
  // Vercel/most env-var UIs store multiline PEM keys with literal `\n`
  // escape sequences rather than real newlines — restore them before
  // handing the key to Node's crypto module, which needs the real thing.
  const privateKey = rawKey.includes('\\n') ? rawKey.replace(/\\n/g, '\n') : rawKey
  return { calendarId, timeZone, clientEmail, privateKey }
}

async function fetchAccessToken(clientEmail: string, privateKey: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(claim)))}`

  let signature: string
  try {
    const signer = createSign('RSA-SHA256')
    signer.update(unsigned)
    signer.end()
    signature = base64url(signer.sign(privateKey))
  } catch {
    // Malformed/mismatched private key — never surface details, just fail.
    return null
  }
  const assertion = `${unsigned}.${signature}`

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
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
 * Fetches this window's freeBusy data for the configured calendar and
 * returns the local calendar dates with ZERO busy time — any timed or
 * all-day busy interval that touches a day at all (even partially) removes
 * that whole day from the result, per the "completely empty" requirement.
 */
export async function getFreeDates(): Promise<FreeDatesResult | FreeDatesError> {
  const config = readConfig()
  if (!config) return { ok: false, error: 'not_configured' }

  const accessToken = await fetchAccessToken(config.clientEmail, config.privateKey)
  if (!accessToken) return { ok: false, error: 'auth_failed' }

  // Complete local-day boundaries naturally span 23/25-hour DST days.
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
        items: [{ id: config.calendarId }],
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

  const freeDates = freeDatesFromResponse(body, config.calendarId, candidateKeys, config.timeZone)
  if (freeDates === null) return { ok: false, error: 'invalid_response' }
  return { ok: true, dates: freeDates }
}
