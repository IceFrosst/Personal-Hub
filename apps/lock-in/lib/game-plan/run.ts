import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FixedRecurringInput,
  FlexRecurringInput,
  PlanBlock,
  PlanSettings,
  PlannableTask,
} from './types'
import { planDay } from './planner'
import {
  dayBoundsIso,
  isoToLocalHM,
  nowLocalHM,
  todayInTz,
  hmToMinutes,
} from './time'
import {
  deleteEvent,
  getBusyIntervals,
  insertEvent,
  type BusyInterval,
} from '@/lib/google/calendar'

export interface RunResult {
  date: string
  blocks: PlanBlock[]
  scheduledCount: number
  totalTasks: number
}

/**
 * Plan one user's day end to end: read their open tasks, read the calendar,
 * ask the planner to lay out blocks, clear any prior Game Plan for the day
 * (calendar events + rows), write the new events, and persist the blocks.
 *
 * `db` may be a user-scoped (RLS) client for the on-demand path or the
 * service-role client for the cron — both satisfy the same query surface.
 */
export async function runPlanForUser(args: {
  db: SupabaseClient
  userId: string
  accessToken: string
  settings: PlanSettings
  targetDate?: string // 'YYYY-MM-DD'; defaults to today in the user's tz
}): Promise<RunResult> {
  const { db, userId, accessToken, settings } = args
  const tz = settings.timezone
  const today = args.targetDate ?? todayInTz(tz)
  const isToday = today === todayInTz(tz)

  // 1. Open tasks.
  const { data: taskRows } = await db
    .schema('focus_gate')
    .from('tasks')
    .select('id, title, priority, due_date, category')
    .eq('user_id', userId)
    .eq('is_completed', false)

  const tasks: PlannableTask[] = (taskRows ?? []) as PlannableTask[]

  // 1b. Recurring routines due today, minus any already completed today.
  const todayWeekday = isoWeekdayFromDate(today)
  const [{ data: recRows }, { data: doneRows }] = await Promise.all([
    db
      .schema('lock_in')
      .from('recurring_tasks')
      .select('id, title, weekdays, time_mode, fixed_time, duration_minutes')
      .eq('user_id', userId)
      .eq('is_active', true),
    db
      .schema('lock_in')
      .from('recurring_completions')
      .select('recurring_id')
      .eq('user_id', userId)
      .eq('completed_date', today),
  ])
  const doneToday = new Set(
    ((doneRows ?? []) as { recurring_id: string }[]).map((r) => r.recurring_id)
  )
  const dueRecurring = (
    (recRows ?? []) as {
      id: string
      title: string
      weekdays: number[]
      time_mode: string
      fixed_time: string | null
      duration_minutes: number
    }[]
  ).filter((r) => r.weekdays?.includes(todayWeekday) && !doneToday.has(r.id))

  const recurringFixed: FixedRecurringInput[] = dueRecurring
    .filter((r) => r.time_mode === 'fixed' && r.fixed_time)
    .map((r) => ({
      id: r.id,
      title: r.title,
      durationMinutes: r.duration_minutes,
      fixedTime: r.fixed_time as string,
    }))
  const recurringFlex: FlexRecurringInput[] = dueRecurring
    .filter((r) => !(r.time_mode === 'fixed' && r.fixed_time))
    .map((r) => ({ id: r.id, title: r.title, durationMinutes: r.duration_minutes }))

  // 2. Today's busy intervals → local HH:MM.
  const { timeMin, timeMax } = dayBoundsIso(today, tz)
  let busyRaw: BusyInterval[] = []
  try {
    busyRaw = await getBusyIntervals(accessToken, timeMin, timeMax)
  } catch {
    busyRaw = []
  }
  const busy = busyRaw.map((b) => ({
    start: isoToLocalHM(b.start, tz),
    end: isoToLocalHM(b.end, tz),
  }))

  // 3. Don't schedule in the past: start from max(work_start, now rounded up).
  // For today, don't schedule in the past; future days use the full window.
  const now = nowLocalHM(tz)
  const earliestStart =
    isToday && hmToMinutes(now) > hmToMinutes(settings.work_start)
      ? roundUp5(now)
      : settings.work_start

  const proposed = await planDay({
    tasks,
    recurringFixed,
    recurringFlex,
    busy,
    workStart: settings.work_start,
    workEnd: settings.work_end,
    earliestStart,
    today,
  })

  // 4. Clear any existing Game Plan for today (idempotent replan).
  const { data: prior } = await db
    .schema('lock_in')
    .from('plan_blocks')
    .select('id, gcal_event_id')
    .eq('user_id', userId)
    .eq('plan_date', today)

  for (const row of prior ?? []) {
    if (row.gcal_event_id) {
      try {
        await deleteEvent(accessToken, row.gcal_event_id)
      } catch {
        // Event already gone or unreachable — the row delete below still cleans up.
      }
    }
  }
  await db
    .schema('lock_in')
    .from('plan_blocks')
    .delete()
    .eq('user_id', userId)
    .eq('plan_date', today)

  // 5. Write calendar events + collect rows to insert.
  const toInsert = []
  for (const b of proposed) {
    let eventId = ''
    try {
      eventId = await insertEvent(accessToken, {
        summary: b.title,
        date: today,
        startLocal: b.start,
        endLocal: b.end,
        timeZone: tz,
        description: 'Scheduled by Lock In · Game Plan',
      })
    } catch {
      // Keep the block in-app even if the calendar write fails.
      eventId = ''
    }
    toInsert.push({
      user_id: userId,
      task_id: b.task_id,
      recurring_id: b.recurring_id,
      title: b.title,
      plan_date: today,
      start_local: b.start,
      end_local: b.end,
      timezone: tz,
      estimated_minutes: b.estimated_minutes,
      category: b.category,
      gcal_event_id: eventId || null,
      status: 'scheduled' as const,
    })
  }

  let blocks: PlanBlock[] = []
  if (toInsert.length > 0) {
    const { data: inserted } = await db
      .schema('lock_in')
      .from('plan_blocks')
      .insert(toInsert)
      .select('*')
    blocks = (inserted ?? []) as PlanBlock[]
  }

  return {
    date: today,
    blocks: blocks.sort((a, b) => hmToMinutes(a.start_local) - hmToMinutes(b.start_local)),
    scheduledCount: blocks.length,
    totalTasks: tasks.length + dueRecurring.length,
  }
}

function roundUp5(hm: string): string {
  const total = Math.ceil(hmToMinutes(hm) / 5) * 5
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** ISO weekday (1=Mon…7=Sun) for a 'YYYY-MM-DD' date, tz-agnostic. */
function isoWeekdayFromDate(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun
  return js === 0 ? 7 : js
}
