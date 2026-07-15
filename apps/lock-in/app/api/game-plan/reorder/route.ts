import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { hasOfflineCredentials, patchEvent, refreshAccessToken } from '@/lib/google/calendar'
import { hmToMinutes, nowLocalHM, todayInTz } from '@/lib/game-plan/time'
import type { PlanBlock } from '@/lib/game-plan/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const GAP = 5

function toHM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Reflow the movable (task/routine) blocks of a day into a new order, packing
 * them around the locked calendar-event blocks, then update both the plan rows
 * and their Google Calendar events. Locked blocks never move.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let date = ''
  let orderedIds: string[] = []
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as {
      date?: string
      orderedIds?: string[]
      providerToken?: string
    }
    date = body.date ?? ''
    orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : []
    providerToken = body.providerToken
  } catch {
    // fall through — validated below
  }
  if (!date || orderedIds.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

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
  if (!accessToken) {
    return NextResponse.json({ error: 'reconnect_needed' }, { status: 400 })
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const tz = settings.timezone

  const { data: blockRows } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_date', date)

  const blocks = (blockRows ?? []) as PlanBlock[]
  const locked = blocks.filter((b) => b.locked)
  const movable = blocks.filter((b) => !b.locked)

  // Order movable blocks by the requested id order; append any strays.
  const byId = new Map(movable.map((b) => [b.id, b]))
  const ordered = orderedIds.map((id) => byId.get(id)).filter((b): b is PlanBlock => Boolean(b))
  for (const b of movable) if (!orderedIds.includes(b.id)) ordered.push(b)

  const lockedIntervals = locked
    .map((b) => [hmToMinutes(b.start_local), hmToMinutes(b.end_local)] as [number, number])
    .sort((a, b) => a[0] - b[0])

  const isToday = date === todayInTz(tz)
  const workStart = hmToMinutes(settings.work_start)
  const nowMin = Math.ceil(hmToMinutes(nowLocalHM(tz)) / 5) * 5
  let cursor = isToday && nowMin > workStart ? nowMin : workStart

  const changed: { block: PlanBlock; start: string; end: string }[] = []
  for (const b of ordered) {
    const dur = b.estimated_minutes ?? hmToMinutes(b.end_local) - hmToMinutes(b.start_local)
    let start = cursor
    // Slide past any locked block this would overlap.
    for (let guard = 0; guard < 50; guard++) {
      const conflict = lockedIntervals.find(([ls, le]) => start < le && start + dur > ls)
      if (!conflict) break
      start = conflict[1] + GAP
    }
    const startHM = toHM(start)
    const endHM = toHM(start + dur)
    if (startHM !== b.start_local || endHM !== b.end_local) {
      changed.push({ block: b, start: startHM, end: endHM })
    }
    cursor = start + dur + GAP
  }

  // Apply: update rows + patch calendar events in parallel.
  await Promise.all(
    changed.flatMap(({ block, start, end }) => {
      const ops: PromiseLike<unknown>[] = [
        supabase
          .schema('lock_in')
          .from('plan_blocks')
          .update({ start_local: start, end_local: end })
          .eq('id', block.id),
      ]
      if (block.gcal_event_id) {
        ops.push(
          patchEvent(accessToken as string, block.gcal_event_id, {
            date,
            startLocal: start,
            endLocal: end,
            timeZone: tz,
          }).catch(() => {})
        )
      }
      return ops
    })
  )

  const { data: refreshed } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_date', date)
    .order('start_local', { ascending: true })

  return NextResponse.json({ blocks: (refreshed ?? []) as PlanBlock[] })
}
