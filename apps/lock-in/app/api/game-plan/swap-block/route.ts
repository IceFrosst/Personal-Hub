import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import {
  deleteEvent,
  hasOfflineCredentials,
  insertEvent,
  refreshAccessToken,
} from '@/lib/google/calendar'
import type { PlanBlock } from '@/lib/game-plan/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Calendar colour by priority, matching the timeline (see run.ts). */
function eventColorId(isRecurring: boolean, priority: string | null): string {
  if (isRecurring) return '8' // Graphite
  switch (priority) {
    case 'high':
      return '11' // Tomato
    case 'low':
      return '5' // Banana
    default:
      return '6' // Tangerine
  }
}

/**
 * Swap a different task/routine into an existing block's time slot: the slot
 * (start/end) stays, the old item leaves the plan (its task/routine is untouched
 * on the list), and the chosen item takes its place — old calendar event deleted,
 * new one written. Locked (calendar) blocks can't be replaced.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let blockId = ''
  let newTaskId: string | undefined
  let newRecurringId: string | undefined
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as {
      blockId?: string
      newTaskId?: string
      newRecurringId?: string
      providerToken?: string
    }
    blockId = body.blockId ?? ''
    newTaskId = body.newTaskId
    newRecurringId = body.newRecurringId
    providerToken = body.providerToken
  } catch {
    // validated below
  }
  if (!blockId || (!newTaskId && !newRecurringId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const { data: oldRow } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('id', blockId)
    .eq('user_id', user.id)
    .maybeSingle()
  const oldBlock = oldRow as PlanBlock | null
  if (!oldBlock) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (oldBlock.locked) return NextResponse.json({ error: 'locked' }, { status: 400 })

  // Details of the item swapping in.
  let title = ''
  let category: string | null = null
  let priority: string | null = null
  if (newTaskId) {
    const { data: t } = await supabase
      .schema('focus_gate')
      .from('tasks')
      .select('title, priority, category')
      .eq('id', newTaskId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!t) return NextResponse.json({ error: 'task_not_found' }, { status: 404 })
    title = (t as { title: string }).title
    category = (t as { category: string | null }).category
    priority = (t as { priority: string | null }).priority
  } else {
    const { data: r } = await supabase
      .schema('lock_in')
      .from('recurring_tasks')
      .select('title')
      .eq('id', newRecurringId as string)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!r) return NextResponse.json({ error: 'routine_not_found' }, { status: 404 })
    title = (r as { title: string }).title
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const tz = settings.timezone

  // Access token: durable refresh first, then the live session token.
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

  // Swap the calendar event (delete old, create new in the same slot).
  let newEventId = ''
  if (accessToken) {
    if (oldBlock.gcal_event_id) {
      await deleteEvent(accessToken, oldBlock.gcal_event_id).catch(() => {})
    }
    try {
      newEventId = await insertEvent(accessToken, {
        summary: title,
        date: oldBlock.plan_date,
        startLocal: oldBlock.start_local,
        endLocal: oldBlock.end_local,
        timeZone: tz,
        description: 'Scheduled by Lock In · Game Plan',
        colorId: eventColorId(Boolean(newRecurringId), priority),
      })
    } catch {
      newEventId = ''
    }
  }

  // Swap the rows: remove the old block, insert the replacement in the same slot.
  await supabase.schema('lock_in').from('plan_blocks').delete().eq('id', blockId).eq('user_id', user.id)
  const { data: inserted } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .insert({
      user_id: user.id,
      task_id: newTaskId ?? null,
      recurring_id: newRecurringId ?? null,
      title,
      plan_date: oldBlock.plan_date,
      start_local: oldBlock.start_local,
      end_local: oldBlock.end_local,
      timezone: tz,
      estimated_minutes: oldBlock.estimated_minutes,
      category,
      priority,
      gcal_event_id: newEventId || null,
      locked: false,
      status: 'scheduled' as const,
    })
    .select()
    .single()

  return NextResponse.json({ block: inserted as PlanBlock })
}
