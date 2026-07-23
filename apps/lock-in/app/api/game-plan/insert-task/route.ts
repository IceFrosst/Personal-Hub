import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { insertTaskIntoPlan } from '@/lib/game-plan/insert'
import { addDays, todayInTz } from '@/lib/game-plan/time'
import { hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * "Fit it in" — slot ONE just-added task into the existing planned day without
 * disturbing the blocks already there. Same token strategy as /plan.
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
  let taskId: string | undefined
  try {
    const body = (await request.json()) as { providerToken?: string; day?: string; taskId?: string }
    providerToken = body?.providerToken
    taskId = body?.taskId
    if (body?.day === 'tomorrow') day = 'tomorrow'
  } catch {
    // no body — fine
  }

  if (!taskId) {
    return NextResponse.json({ error: 'missing_task' }, { status: 400 })
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
    return NextResponse.json(
      { error: connection ? 'reconnect_needed' : 'not_connected' },
      { status: 400 }
    )
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const todayStr = todayInTz(settings.timezone)
  const targetDate = day === 'tomorrow' ? addDays(todayStr, 1) : todayStr

  try {
    const result = await insertTaskIntoPlan({
      db: supabase,
      userId: user.id,
      accessToken,
      settings,
      taskId,
      targetDate,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: 'insert_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
