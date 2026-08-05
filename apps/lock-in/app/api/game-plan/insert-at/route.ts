import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { estimateTaskMinutes } from '@/lib/game-plan/planner'
import { reflowDay } from '@/lib/game-plan/reflow'
import { addDays, hmToMinutes, todayInTz } from '@/lib/game-plan/time'
import {
  hasOfflineCredentials,
  insertEvent,
  refreshAccessToken,
} from '@/lib/google/calendar'
import type { PlanBlock } from '@/lib/game-plan/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Drop a task onto the day **at the spot you released it**, rather than in the
 * first gap that fits. The new block is spliced into the movable order right
 * after `afterBlockId` (or first, when null) and the whole day is reflowed
 * around it — later blocks slide to make room, locked calendar events don't
 * move. Its length is Gemini's estimate from the title.
 *
 * body: { taskId, day, afterBlockId?, providerToken? }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let taskId: string | undefined
  let afterBlockId: string | null = null
  let day: 'today' | 'tomorrow' = 'today'
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as {
      taskId?: string
      afterBlockId?: string | null
      day?: string
      providerToken?: string
    }
    taskId = body.taskId
    afterBlockId = body.afterBlockId ?? null
    providerToken = body.providerToken
    if (body.day === 'tomorrow') day = 'tomorrow'
  } catch {
    // validated below
  }
  if (!taskId) return NextResponse.json({ error: 'missing_task' }, { status: 400 })

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
  if (!accessToken) {
    return NextResponse.json(
      { error: connection ? 'reconnect_needed' : 'not_connected' },
      { status: 400 }
    )
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const tz = settings.timezone
  const date = day === 'tomorrow' ? addDays(todayInTz(tz), 1) : todayInTz(tz)

  const { data: taskRow } = await supabase
    .schema('focus_gate')
    .from('tasks')
    .select('id, title, priority, category, is_completed')
    .eq('user_id', user.id)
    .eq('id', taskId)
    .maybeSingle()
  const task = taskRow as
    | { id: string; title: string; priority: string | null; category: string | null; is_completed: boolean }
    | null
  if (!task || task.is_completed) {
    return NextResponse.json({ error: 'no_task' }, { status: 400 })
  }

  // How long does this actually take? Gemini reads the title; falls back to a
  // priority default when the model is unavailable.
  const priority = ['low', 'medium', 'high'].includes(task.priority ?? '')
    ? (task.priority as 'low' | 'medium' | 'high')
    : null
  const dur = Math.max(5, await estimateTaskMinutes(task.title, priority))

  const { data: existingRows } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_date', date)
    .order('start_local', { ascending: true })
  const existing = (existingRows ?? []) as PlanBlock[]

  // Already on the day? Nothing to insert.
  if (existing.some((b) => b.task_id === taskId)) {
    return NextResponse.json({ blocks: existing, overflowCount: 0, already: true })
  }

  // Provisional times — the reflow assigns the real ones a moment later. Start
  // where the drop landed so the block usually needs no adjustment at all.
  const anchor = afterBlockId ? existing.find((b) => b.id === afterBlockId) : null
  const provisional = anchor
    ? hmToMinutes(anchor.end_local) + 5
    : hmToMinutes(settings.work_start)
  const toHM = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  let eventId = ''
  try {
    eventId = await insertEvent(accessToken, {
      summary: task.title,
      date,
      startLocal: toHM(provisional),
      endLocal: toHM(provisional + dur),
      timeZone: tz,
      description: 'Scheduled by Lock In · Game Plan',
      colorId: task.priority === 'high' ? '11' : task.priority === 'low' ? '5' : '6',
    })
  } catch {
    eventId = ''
  }

  const { data: created } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .insert({
      user_id: user.id,
      task_id: task.id,
      recurring_id: null,
      title: task.title,
      plan_date: date,
      start_local: toHM(provisional),
      end_local: toHM(provisional + dur),
      timezone: tz,
      estimated_minutes: dur,
      category: task.category,
      priority: task.priority,
      gcal_event_id: eventId || null,
      locked: false,
      kind: null,
      status: 'scheduled',
    })
    .select('id')
    .single()

  // Splice the new block into the movable order at the drop point, then let the
  // shared reflow push everything else around it.
  const movable = existing.filter((b) => !b.locked)
  const orderedIds: string[] = []
  if (!afterBlockId) orderedIds.push((created as { id: string }).id)
  for (const b of movable) {
    orderedIds.push(b.id)
    if (b.id === afterBlockId) orderedIds.push((created as { id: string }).id)
  }
  if (!orderedIds.includes((created as { id: string }).id)) {
    orderedIds.push((created as { id: string }).id)
  }

  const result = await reflowDay({
    db: supabase,
    userId: user.id,
    accessToken,
    settings,
    date,
    orderedIds,
  })

  const placed = result.blocks.find((b) => b.task_id === task.id)
  return NextResponse.json({
    ...result,
    inserted: placed
      ? { title: task.title, start: placed.start_local, end: placed.end_local, minutes: dur }
      : null,
  })
}
