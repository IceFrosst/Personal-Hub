import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanBlock, PlanSettings } from './types'
import { hmToMinutes, nowLocalHM, todayInTz } from './time'
import { patchEvent } from '@/lib/google/calendar'

const GAP = 5

function toHM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Re-lay a day's **movable** blocks into `orderedIds`, packing them around the
 * locked calendar-event blocks (which never move), then write the new times to
 * both the plan rows and their Google Calendar events.
 *
 * **Nothing is ever removed.** Blocks are allowed to run past `work_end` — a day
 * that overruns is the user's problem to look at, not ours to silently delete
 * work from. Packing is bounded only by the end of the day itself (23:59); in
 * the impossible case that a block still doesn't fit, it keeps the time it
 * already had rather than being dropped.
 *
 * Shared by drag-to-reorder and drop-a-task-into-the-day, so both produce
 * exactly the same layout rules.
 */
export async function reflowDay(args: {
  db: SupabaseClient
  userId: string
  accessToken: string
  settings: PlanSettings
  date: string
  orderedIds: string[]
}): Promise<{ blocks: PlanBlock[]; overflowCount: number }> {
  const { db, userId, accessToken, settings, date, orderedIds } = args
  const tz = settings.timezone

  const { data: blockRows } = await db
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', userId)
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
  const dayEnd = 23 * 60 + 59
  const nowMin = Math.ceil(hmToMinutes(nowLocalHM(tz)) / 5) * 5
  let cursor = isToday && nowMin > workStart ? nowMin : workStart

  const changed: { block: PlanBlock; start: string; end: string }[] = []
  let overflow = 0
  for (const b of ordered) {
    const dur = b.estimated_minutes ?? hmToMinutes(b.end_local) - hmToMinutes(b.start_local)
    let start = cursor
    for (let guard = 0; guard < 50; guard++) {
      const conflict = lockedIntervals.find(([ls, le]) => start < le && start + dur > ls)
      if (!conflict) break
      start = conflict[1] + GAP
    }
    if (start + dur > dayEnd) {
      // Runs past midnight, which the schema can't express (times are HH:MM
      // within one plan_date). Squeeze it into whatever is left of the day
      // instead of deleting it — a shortened block you can see and fix beats
      // work silently disappearing. Only if there isn't even five minutes left
      // does it keep the time it already had.
      overflow += 1
      const room = dayEnd - start
      if (room < 5) continue
      const startHM = toHM(start)
      const endHM = toHM(dayEnd)
      if (startHM !== b.start_local || endHM !== b.end_local) {
        changed.push({ block: b, start: startHM, end: endHM })
      }
      cursor = dayEnd
      continue
    }
    const startHM = toHM(start)
    const endHM = toHM(start + dur)
    if (startHM !== b.start_local || endHM !== b.end_local) {
      changed.push({ block: b, start: startHM, end: endHM })
    }
    cursor = start + dur + GAP
  }

  await Promise.all([
    ...changed.flatMap(({ block, start, end }) => {
      const ops: PromiseLike<unknown>[] = [
        db
          .schema('lock_in')
          .from('plan_blocks')
          .update({ start_local: start, end_local: end })
          .eq('id', block.id),
      ]
      if (block.gcal_event_id) {
        ops.push(
          patchEvent(accessToken, block.gcal_event_id, {
            date,
            startLocal: start,
            endLocal: end,
            timeZone: tz,
          }).catch(() => {})
        )
      }
      return ops
    }),
  ])

  const { data: refreshed } = await db
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', date)
    .order('start_local', { ascending: true })

  return { blocks: (refreshed ?? []) as PlanBlock[], overflowCount: overflow }
}
