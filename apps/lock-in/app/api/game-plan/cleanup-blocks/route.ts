import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { deleteEvent, hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'
import { todayInTz } from '@/lib/game-plan/time'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Remove Game Plan blocks + their Google Calendar events. Two modes:
 *   • `blockId` — remove exactly ONE block from the plan (used by the Game Plan
 *     "Remove from plan" action; the underlying task/routine is kept, so a
 *     replan can re-add it).
 *   • `taskId` / `recurringId` — remove all of a task's/routine's blocks from
 *     today onward (used when the task/routine itself is deleted from the list).
 * Calendar cleanup is best-effort (a missing token or event is swallowed); the
 * rows are always removed so the timeline stays in sync.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let taskId: string | undefined
  let recurringId: string | undefined
  let blockId: string | undefined
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as {
      taskId?: string
      recurringId?: string
      blockId?: string
      providerToken?: string
    }
    taskId = body.taskId
    recurringId = body.recurringId
    blockId = body.blockId
    providerToken = body.providerToken
  } catch {
    // validated below
  }
  if (!taskId && !recurringId && !blockId) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  let query = supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('id, gcal_event_id')
    .eq('user_id', user.id)
  if (blockId) {
    query = query.eq('id', blockId)
  } else {
    const settings = await getOrCreateSettings(supabase, user.id)
    const today = todayInTz(settings.timezone)
    query = query.gte('plan_date', today)
    query = taskId ? query.eq('task_id', taskId) : query.eq('recurring_id', recurringId as string)
  }
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
