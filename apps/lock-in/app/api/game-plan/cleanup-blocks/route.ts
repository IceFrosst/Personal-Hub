import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { deleteEvent, hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'
import { todayInTz } from '@/lib/game-plan/time'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * After a task or routine is deleted, remove its Game Plan blocks from today
 * onward — both the `plan_blocks` rows and their Google Calendar events. Past
 * blocks are left as history. Calendar cleanup is best-effort (a missing token
 * or event is swallowed); the rows are always removed so the timeline stays in
 * sync even when the calendar can't be reached.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let taskId: string | undefined
  let recurringId: string | undefined
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as {
      taskId?: string
      recurringId?: string
      providerToken?: string
    }
    taskId = body.taskId
    recurringId = body.recurringId
    providerToken = body.providerToken
  } catch {
    // validated below
  }
  if (!taskId && !recurringId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const today = todayInTz(settings.timezone)

  let query = supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('id, gcal_event_id')
    .eq('user_id', user.id)
    .gte('plan_date', today)
  query = taskId ? query.eq('task_id', taskId) : query.eq('recurring_id', recurringId as string)
  const { data: rows } = await query
  const blocks = (rows ?? []) as { id: string; gcal_event_id: string | null }[]
  if (blocks.length === 0) return NextResponse.json({ ok: true, removed: 0 })

  // Access token: stored offline refresh (durable) or the live session token.
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
  if (!accessToken && providerToken) accessToken = providerToken

  if (accessToken) {
    await Promise.all(
      blocks
        .map((b) => b.gcal_event_id)
        .filter((id): id is string => Boolean(id))
        .map((id) => deleteEvent(accessToken as string, id).catch(() => {}))
    )
  }

  const ids = blocks.map((b) => b.id)
  await supabase.schema('lock_in').from('plan_blocks').delete().in('id', ids)

  return NextResponse.json({ ok: true, removed: ids.length })
}
