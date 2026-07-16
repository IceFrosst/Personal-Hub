import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { hasOfflineCredentials, patchEvent, refreshAccessToken } from '@/lib/google/calendar'
import { hmToMinutes, nowLocalHM, todayInTz } from '@/lib/game-plan/time'
import type { PlanBlock } from '@/lib/game-plan/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function toHM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Free intervals inside [winStart, winEnd] given occupied ranges. */
function freeGaps(
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number
): Array<[number, number]> {
  const sorted = [...occupied]
    .filter(([s, e]) => e > winStart && s < winEnd)
    .sort((a, b) => a[0] - b[0])
  const gaps: Array<[number, number]> = []
  let cursor = winStart
  for (const [s, e] of sorted) {
    if (s > cursor) gaps.push([cursor, Math.min(s, winEnd)])
    cursor = Math.max(cursor, e)
  }
  if (cursor < winEnd) gaps.push([cursor, winEnd])
  return gaps
}

/** Nearest free start to `desired` that fits `dur` inside the window, or null. */
function findNearestSlot(
  desired: number,
  dur: number,
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number
): number | null {
  let best: number | null = null
  let bestDist = Infinity
  for (const [gs, ge] of freeGaps(occupied, winStart, winEnd)) {
    if (ge - gs < dur) continue
    const start = Math.max(gs, Math.min(desired, ge - dur))
    const dist = Math.abs(start - desired)
    if (dist < bestDist) {
      bestDist = dist
      best = start
    }
  }
  return best
}

/**
 * Instantly re-place a routine's existing plan blocks (today onward) after its
 * time / duration changed — without a full replan. For each day that has a block
 * for the routine, the block is moved to the nearest free slot around the day's
 * OTHER blocks (locked calendar events + other tasks/routines): a fixed routine
 * targets its clock time, a flexible one keeps its current start; both take the
 * new duration. The row and its Google Calendar event are updated.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let recurringId = ''
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as { recurringId?: string; providerToken?: string }
    recurringId = body.recurringId ?? ''
    providerToken = body.providerToken
  } catch {
    // validated below
  }
  if (!recurringId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { data: routine } = await supabase
    .schema('lock_in')
    .from('recurring_tasks')
    .select('time_mode, fixed_time, duration_minutes')
    .eq('id', recurringId)
    .maybeSingle()
  if (!routine) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const settings = await getOrCreateSettings(supabase, user.id)
  const tz = settings.timezone
  const today = todayInTz(tz)
  const dur = Math.max(5, routine.duration_minutes)

  // All blocks for this routine from today onward, grouped by day.
  const { data: mine } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', user.id)
    .eq('recurring_id', recurringId)
    .gte('plan_date', today)
  const myBlocks = (mine ?? []) as PlanBlock[]
  if (myBlocks.length === 0) return NextResponse.json({ ok: true, adjusted: 0 })

  const dates = Array.from(new Set(myBlocks.map((b) => b.plan_date)))

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

  const workStart = hmToMinutes(settings.work_start)
  const workEnd = hmToMinutes(settings.work_end)

  const ops: PromiseLike<unknown>[] = []
  let adjusted = 0

  for (const date of dates) {
    const { data: dayRows } = await supabase
      .schema('lock_in')
      .from('plan_blocks')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', date)
    const blocks = (dayRows ?? []) as PlanBlock[]
    const target = blocks.find((b) => b.recurring_id === recurringId)
    if (!target) continue

    // Everything else on the day is a fixed obstacle we place around.
    const occupied = blocks
      .filter((b) => b.id !== target.id)
      .map((b) => [hmToMinutes(b.start_local), hmToMinutes(b.end_local)] as [number, number])

    const isToday = date === today
    const earliest = isToday
      ? Math.max(workStart, Math.ceil(hmToMinutes(nowLocalHM(tz)) / 5) * 5)
      : workStart

    const desired =
      routine.time_mode === 'fixed' && routine.fixed_time
        ? Math.max(earliest, hmToMinutes(routine.fixed_time))
        : Math.max(earliest, hmToMinutes(target.start_local))

    const start = findNearestSlot(desired, dur, occupied, earliest, workEnd)
    if (start == null) continue // no room today — leave it; a replan can sort it

    const startHM = toHM(start)
    const endHM = toHM(start + dur)
    if (startHM === target.start_local && endHM === target.end_local) continue

    adjusted += 1
    ops.push(
      supabase
        .schema('lock_in')
        .from('plan_blocks')
        .update({ start_local: startHM, end_local: endHM, estimated_minutes: dur })
        .eq('id', target.id)
    )
    if (accessToken && target.gcal_event_id) {
      ops.push(
        patchEvent(accessToken, target.gcal_event_id, {
          date,
          startLocal: startHM,
          endLocal: endHM,
          timeZone: tz,
        }).catch(() => {})
      )
    }
  }

  await Promise.all(ops)
  return NextResponse.json({ ok: true, adjusted })
}
