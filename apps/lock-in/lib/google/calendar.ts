// Google Calendar helpers. All calls run server-side (routes / cron) only.
//
// Two ways to get a usable access token:
//   1. refreshAccessToken(refreshToken) — offline, needs GOOGLE_OAUTH_CLIENT_ID
//      + GOOGLE_OAUTH_CLIENT_SECRET. This is what the cron uses while the user
//      is away, and the durable path for the on-demand button.
//   2. A live provider_token straight from the user's Supabase session — no
//      client secret needed, but expires ~1h after sign-in. Fallback for
//      on-demand planning before the OAuth secrets are provisioned.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_BASE = 'https://www.googleapis.com/calendar/v3'

export function hasOfflineCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  )
}

/** Mint a fresh Google access token from a stored offline refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials are not configured')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google token refresh failed (${res.status}): ${body}`)
  }

  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('Google token refresh returned no access_token')
  return json.access_token
}

export interface BusyInterval {
  start: string // ISO instant
  end: string
}

/** Busy intervals on the user's primary calendar between two ISO instants. */
export async function getBusyIntervals(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<BusyInterval[]> {
  const res = await fetch(`${CAL_BASE}/freeBusy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google freeBusy failed (${res.status}): ${body}`)
  }

  const json = (await res.json()) as {
    calendars?: { primary?: { busy?: BusyInterval[] } }
  }
  return json.calendars?.primary?.busy ?? []
}

export interface EventInput {
  summary: string
  date: string // 'YYYY-MM-DD'
  startLocal: string // 'HH:MM'
  endLocal: string // 'HH:MM'
  timeZone: string
  description?: string
  colorId?: string // Google Calendar event colour (1–11)
}

/**
 * Create a calendar event from local wall-clock times. Google resolves the UTC
 * offset from `timeZone`, so no offset math is needed here. Returns the event id.
 */
export async function insertEvent(
  accessToken: string,
  ev: EventInput
): Promise<string> {
  const res = await fetch(`${CAL_BASE}/calendars/primary/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: ev.summary,
      description: ev.description,
      start: { dateTime: `${ev.date}T${ev.startLocal}:00`, timeZone: ev.timeZone },
      end: { dateTime: `${ev.date}T${ev.endLocal}:00`, timeZone: ev.timeZone },
      ...(ev.colorId ? { colorId: ev.colorId } : {}),
      // Tag so we can find/replace Game Plan's own events without touching others.
      extendedProperties: { private: { lockInGamePlan: 'true' } },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google event insert failed (${res.status}): ${body}`)
  }

  const json = (await res.json()) as { id?: string }
  return json.id ?? ''
}

/** Delete an event by id. Swallows 404/410 (already gone). */
export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${CAL_BASE}/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text()
    throw new Error(`Google event delete failed (${res.status}): ${body}`)
  }
}
