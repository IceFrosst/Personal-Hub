import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AiStatus,
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
  insertEvent,
  listDayEvents,
  listGamePlanEventIds,
  patchEvent,
  type DayEvent,
} from '@/lib/google/calendar'

export interface RunResult {
  date: string
  blocks: PlanBlock[]
  scheduledCount: number
  totalTasks: number
  ai: AiStatus
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

  // 1a. Existing plan for the day → on TODAY, KEEP ONLY WHAT YOU FINISHED, CUT AT
  // NOW. The cutoff is now (rounded to the 5-min grid, never before work_start).
  // The day effectively (re)starts when you replan:
  //   • a block you marked DONE before the cutoff stays as history (a done block
  //     that runs past the cutoff — finished early — is trimmed to end at now);
  //   • a block that was NOT done and sits before the cutoff is DROPPED, and its
  //     task/routine goes back into the pool to be re-planned from now — so if you
  //     wake up and replan at 10:00, the untouched 09:00 blocks don't linger as
  //     "missed"; they just get rescheduled into your real day.
  // New work starts at the cutoff. (Marking a block done is what preserves it.)
  const now = nowLocalHM(tz)
  const cutoff =
    isToday && hmToMinutes(now) > hmToMinutes(settings.work_start)
      ? roundUp5(now)
      : settings.work_start
  const cutoffMin = hmToMinutes(cutoff)

  const { data: existingRows } = await db
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', today)
  const existing = (existingRows ?? []) as PlanBlock[]
  const truncated: PlanBlock[] = []
  const kept = existing
    .filter(
      (b) => !b.locked && isToday && b.status === 'done' && hmToMinutes(b.start_local) < cutoffMin
    )
    .map((b) => {
      if (hmToMinutes(b.end_local) > cutoffMin) {
        const t = { ...b, end_local: cutoff }
        truncated.push(t)
        return t
      }
      return b
    })
  const keptIds = kept.map((b) => b.id)
  const keptEventIds = new Set(
    kept.map((b) => b.gcal_event_id).filter((id): id is string => Boolean(id))
  )
  const keptTaskIds = new Set(
    kept.map((b) => b.task_id).filter((id): id is string => Boolean(id))
  )
  const keptRecurringIds = new Set(
    kept.map((b) => b.recurring_id).filter((id): id is string => Boolean(id))
  )
  const keptBusy = kept.map((b) => ({ start: b.start_local, end: b.end_local }))

  // 1b. Recurring routines due today, minus any already completed today or
  // already kept from an earlier plan.
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
  ).filter(
    (r) =>
      r.weekdays?.includes(todayWeekday) && !doneToday.has(r.id) && !keptRecurringIds.has(r.id)
  )

  // Tasks still to schedule (drop the ones already kept from an earlier plan).
  const plannableTasks = tasks.filter((t) => !keptTaskIds.has(t.id))

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

  const { timeMin, timeMax } = dayBoundsIso(today, tz)

  // 2. Clear any existing Game Plan for the day FIRST (events + rows) — before
  // reading the calendar, so our own old events aren't read back as "real"
  // events. Deletes every tagged event in the window (sweeps orphans too).
  let priorEventIds: string[] = []
  try {
    priorEventIds = await listGamePlanEventIds(accessToken, timeMin, timeMax)
  } catch {
    const { data: prior } = await db
      .schema('lock_in')
      .from('plan_blocks')
      .select('gcal_event_id')
      .eq('user_id', userId)
      .eq('plan_date', today)
    priorEventIds = ((prior ?? []) as { gcal_event_id: string | null }[])
      .map((r) => r.gcal_event_id)
      .filter((id): id is string => Boolean(id))
  }
  // Delete our tagged events EXCEPT the kept blocks' events, and the rows EXCEPT
  // the kept ones.
  await Promise.all(
    priorEventIds
      .filter((id) => !keptEventIds.has(id))
      .map((id) => deleteEvent(accessToken, id).catch(() => {}))
  )
  let del = db.schema('lock_in').from('plan_blocks').delete().eq('user_id', userId).eq('plan_date', today)
  if (keptIds.length > 0) del = del.not('id', 'in', `(${keptIds.join(',')})`)
  await del

  // Trim the block(s) that cross the cutoff so they end at now — both our row and
  // the calendar event (you stopped there, so that's the real end).
  await Promise.all(
    truncated.flatMap((b) => {
      const ops: PromiseLike<unknown>[] = [
        db
          .schema('lock_in')
          .from('plan_blocks')
          .update({ end_local: b.end_local })
          .eq('id', b.id),
      ]
      if (b.gcal_event_id) {
        ops.push(
          patchEvent(accessToken, b.gcal_event_id, {
            date: today,
            startLocal: b.start_local,
            endLocal: b.end_local,
            timeZone: tz,
          }).catch(() => {})
        )
      }
      return ops
    })
  )

  // 3. The user's real calendar events → busy (for the planner) + locked blocks.
  let dayEvents: DayEvent[] = []
  try {
    dayEvents = await listDayEvents(accessToken, timeMin, timeMax)
  } catch {
    dayEvents = []
  }
  // Busy = real calendar events + the kept blocks (so nothing lands on them).
  const busy = [
    ...dayEvents.map((e) => ({ start: isoToLocalHM(e.start, tz), end: isoToLocalHM(e.end, tz) })),
    ...keptBusy,
  ]

  // 4. New work starts at the cutoff (now on today, work_start earlier / future
  // days). Kept blocks are all trimmed to end at or before it, so nothing overlaps.
  const earliestStart = cutoff

  const { blocks: proposed, ai } = await planDay({
    tasks: plannableTasks,
    recurringFixed,
    recurringFlex,
    busy,
    workStart: settings.work_start,
    workEnd: settings.work_end,
    earliestStart,
    today,
  })

  // 5. Write a calendar event per planned block (parallel, to beat the timeout).
  const plannedRows = await Promise.all(
    proposed.map(async (b) => {
      let eventId = ''
      try {
        eventId = await insertEvent(accessToken, {
          summary: b.title,
          date: today,
          startLocal: b.start,
          endLocal: b.end,
          timeZone: tz,
          description: 'Scheduled by Lock In · Game Plan',
          colorId: eventColorId(b.recurring_id != null, b.priority),
        })
      } catch {
        eventId = ''
      }
      return {
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
        priority: b.priority,
        gcal_event_id: eventId || null,
        locked: false,
        status: 'scheduled' as const,
      }
    })
  )

  // Locked rows mirror the user's real events (no calendar write — they exist).
  const lockedRows = dayEvents.map((e) => ({
    user_id: userId,
    task_id: null,
    recurring_id: null,
    title: e.summary,
    plan_date: today,
    start_local: isoToLocalHM(e.start, tz),
    end_local: isoToLocalHM(e.end, tz),
    timezone: tz,
    estimated_minutes: null,
    category: null,
    priority: null,
    gcal_event_id: e.id,
    locked: true,
    status: 'scheduled' as const,
  }))

  const toInsert = [...plannedRows, ...lockedRows]
  if (toInsert.length > 0) {
    await db.schema('lock_in').from('plan_blocks').insert(toInsert)
  }

  // Re-read the whole day so the result includes the kept blocks + the new ones.
  const { data: allRows } = await db
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', today)
    .order('start_local', { ascending: true })

  return {
    date: today,
    blocks: (allRows ?? []) as PlanBlock[],
    scheduledCount: plannedRows.length, // newly planned blocks only
    totalTasks: plannableTasks.length + dueRecurring.length,
    ai,
  }
}

function roundUp5(hm: string): string {
  const total = Math.ceil(hmToMinutes(hm) / 5) * 5
  return minutesToHm(total)
}

function minutesToHm(total: number): string {
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

/**
 * Google Calendar event colour by priority, matching the in-app timeline:
 * high = tomato (red), medium = tangerine (orange), low = banana (yellow),
 * recurring routines = graphite (grey, Google has no white).
 */
function eventColorId(isRecurring: boolean, priority: string | null): string {
  if (isRecurring) return '8' // Graphite
  switch (priority) {
    case 'high':
      return '11' // Tomato
    case 'low':
      return '5' // Banana
    default:
      return '6' // Tangerine (medium)
  }
}
