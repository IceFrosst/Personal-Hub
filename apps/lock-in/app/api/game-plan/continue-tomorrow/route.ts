import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import {
  deleteEvent,
  hasOfflineCredentials,
  patchEvent,
  refreshAccessToken,
} from '@/lib/google/calendar'
import { addDays, hmToMinutes, nowLocalHM, todayInTz } from '@/lib/game-plan/time'
import type { PlanBlock } from '@/lib/game-plan/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function toHM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * "Continue tomorrow" for a task block: the task stays open but is snoozed to
 * the next day (snoozed_until + due_date), so today's replans skip it and the
 * next day's plan schedules it with a fresh AI duration estimate. Today's block:
 *   • already started → kept as progress (status 'continued', trimmed to end at
 *     now if you're mid-block, calendar event patched to match);
 *   • not started yet (or a future day's block) → removed (row + calendar event),
 *     since there's no progress to show.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let blockId = ''
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as { blockId?: string; providerToken?: string }
    blockId = body.blockId ?? ''
    providerToken = body.providerToken
  } catch {
    // validated below
  }
  if (!blockId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { data: row } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('id', blockId)
    .eq('user_id', user.id)
    .maybeSingle()
  const block = row as PlanBlock | null
  if (!block) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (block.locked || !block.task_id) {
    return NextResponse.json({ error: 'not_a_task_block' }, { status: 400 })
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const tz = settings.timezone
  const today = todayInTz(tz)
  const nextDay = addDays(block.plan_date, 1)

  // Snooze the task to the next day: excluded from this day's replans, picked up
  // by the next day's plan (morning cron or manual), duration re-estimated fresh.
  await supabase
    .schema('focus_gate')
    .from('tasks')
    .update({ snoozed_until: nextDay, due_date: nextDay })
    .eq('id', block.task_id)

  // Access token (best-effort — calendar sync degrades gracefully without it).
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

  const nowMin = hmToMinutes(nowLocalHM(tz))
  const started = block.plan_date === today && hmToMinutes(block.start_local) <= nowMin

  if (started) {
    // Keep today's block as progress. If we're mid-block, it ends now.
    const endMin = Math.min(
      hmToMinutes(block.end_local),
      Math.max(nowMin, hmToMinutes(block.start_local) + 5)
    )
    const endHM = toHM(endMin)
    await supabase
      .schema('lock_in')
      .from('plan_blocks')
      .update({ status: 'continued', end_local: endHM })
      .eq('id', block.id)
    if (accessToken && block.gcal_event_id && endHM !== block.end_local) {
      await patchEvent(accessToken, block.gcal_event_id, {
        date: block.plan_date,
        startLocal: block.start_local,
        endLocal: endHM,
        timeZone: tz,
      }).catch(() => {})
    }
    return NextResponse.json({ ok: true, kept: true, end_local: endHM })
  }

  // Not started → no progress to show; drop the block (and its event) entirely.
  if (accessToken && block.gcal_event_id) {
    await deleteEvent(accessToken, block.gcal_event_id).catch(() => {})
  }
  await supabase.schema('lock_in').from('plan_blocks').delete().eq('id', block.id)
  return NextResponse.json({ ok: true, kept: false })
}
