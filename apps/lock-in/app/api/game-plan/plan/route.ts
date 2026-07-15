import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { runPlanForUser } from '@/lib/game-plan/run'
import { addDays, todayInTz } from '@/lib/game-plan/time'
import { hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * On-demand "Plan my day" for the signed-in user.
 *
 * Token strategy, in order:
 *   1. Stored offline refresh token + configured Google OAuth client → durable.
 *   2. A live provider_token the client passes from its current session →
 *      works within ~1h of connecting, before the OAuth secrets are provisioned.
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
  let day: 'today' | 'tomorrow' = 'today'
  try {
    const body = (await request.json()) as { providerToken?: string; day?: string }
    providerToken = body?.providerToken
    if (body?.day === 'tomorrow') day = 'tomorrow'
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

  if (!accessToken) {
    // Either not connected, or the token expired and offline refresh isn't set up.
    return NextResponse.json(
      { error: connection ? 'reconnect_needed' : 'not_connected' },
      { status: 400 }
    )
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const todayStr = todayInTz(settings.timezone)
  const targetDate = day === 'tomorrow' ? addDays(todayStr, 1) : todayStr

  try {
    const result = await runPlanForUser({
      db: supabase,
      userId: user.id,
      accessToken,
      settings,
      targetDate,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: 'plan_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
