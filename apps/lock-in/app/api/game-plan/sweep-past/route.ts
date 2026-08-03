import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { sweepStalePastDays } from '@/lib/game-plan/sweep'
import { hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Clean up past days when the app is opened: remove any block you never checked
 * off from days before today, and delete its calendar event. Backstop for the
 * daily cron. Same token strategy as /plan.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  let providerToken: string | undefined
  try {
    const body = (await request.json()) as { providerToken?: string }
    providerToken = body?.providerToken
  } catch {
    // no body — fine
  }

  const { data: connection } = await supabase
    .schema('lock_in')
    .from('calendar_connections')
    .select('google_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  let accessToken: string | undefined
  if (connection?.google_refresh_token && hasOfflineCredentials()) {
    try {
      accessToken = await refreshAccessToken(connection.google_refresh_token)
    } catch {
      accessToken = undefined
    }
  }
  if (!accessToken && providerToken) {
    accessToken = providerToken
  }

  const settings = await getOrCreateSettings(supabase, user.id)

  try {
    const result = await sweepStalePastDays({
      db: supabase,
      userId: user.id,
      accessToken,
      timezone: settings.timezone,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: 'sweep_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
