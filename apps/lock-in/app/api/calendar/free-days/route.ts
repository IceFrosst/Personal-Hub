import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBusyIntervals, hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'

type Candidate = { date: string; start: string; end: string }

function parseCandidates(body: unknown): Candidate[] | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = (body as Record<string, unknown>).candidates
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 31) return null
  const candidates: Candidate[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null
    const { date, start, end } = item as Record<string, unknown>
    if (
      typeof date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof start !== 'string' ||
      typeof end !== 'string'
    )
      return null
    const startMs = Date.parse(start)
    const endMs = Date.parse(end)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
    candidates.push({ date, start, end })
  }
  return candidates
}

/**
 * Private server-to-server availability bridge for Republic. It reuses the
 * offline Google refresh token already stored by Lock In and returns only
 * completely free date keys—never tokens, event details, or busy intervals.
 */
export async function POST(request: Request) {
  const secret = process.env.REPUBLIC_CALENDAR_API_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const candidates = parseCandidates(body)
  if (!candidates || !hasOfflineCredentials()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const { data: connection, error } = await admin
    .schema('lock_in')
    .from('calendar_connections')
    .select('google_refresh_token')
    .limit(1)
    .maybeSingle()
  if (error || !connection?.google_refresh_token) {
    return NextResponse.json({ error: 'calendar_not_connected' }, { status: 503 })
  }

  try {
    const accessToken = await refreshAccessToken(connection.google_refresh_token)
    const timeMin = candidates[0].start
    const timeMax = candidates[candidates.length - 1].end
    const busy = await getBusyIntervals(accessToken, timeMin, timeMax)
    const dates = candidates
      .filter((candidate) => {
        const start = Date.parse(candidate.start)
        const end = Date.parse(candidate.end)
        return !busy.some((interval) => Date.parse(interval.start) < end && Date.parse(interval.end) > start)
      })
      .map((candidate) => candidate.date)

    return NextResponse.json(
      { dates },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (err) {
    console.error('[calendar/free-days] availability lookup failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'calendar_unavailable' }, { status: 503 })
  }
}
