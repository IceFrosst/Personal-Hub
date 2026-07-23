import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanBlock, PlanSettings } from './types'
import { estimateTaskMinutes, freeGaps } from './planner'
import { dayBoundsIso, hmToMinutes, isoToLocalHM, nowLocalHM, todayInTz } from './time'
import { insertEvent, listDayEvents } from '@/lib/google/calendar'

export interface InsertResult {
  blocks: PlanBlock[]
  inserted: { title: string; start: string; end: string } | null
  pastHours: boolean
  reason?: 'already_scheduled' | 'no_task'
}

const GAP = 5

/**
 * Non-destructive "fit it in": drop ONE task into the existing planned day
 * without moving anything already there. Places it in the earliest free gap
 * (after now, inside the work window); if nothing fits, appends it after the
 * last block — even a little past work_end — so it still lands on the day.
 * Existing blocks + their calendar events are never touched.
 */
export async function insertTaskIntoPlan(args: {
  db: SupabaseClient
  userId: string
  accessToken: string
  settings: PlanSettings
  taskId: string
  targetDate?: string // 'YYYY-MM-DD'; defaults to today in the user's tz
}): Promise<InsertResult> {
  const { db, userId, accessToken, settings, taskId } = args
  const tz = settings.timezone
  const today = args.targetDate ?? todayInTz(tz)
  const isToday = today === todayInTz(tz)

  // 1. The task to fit in.
  const { data: taskRow } = await db
    .schema('focus_gate')
    .from('tasks')
    .select('id, title, priority, category, is_completed')
    .eq('user_id', userId)
    .eq('id', taskId)
    .maybeSingle()
  const task = taskRow as
    | { id: string; title: string; priority: string | null; category: string | null; is_completed: boolean }
    | null
  if (!task || task.is_completed) {
    return { blocks: await readDay(db, userId, today), inserted: null, pastHours: false, reason: 'no_task' }
  }

  // 2. Existing plan for the day (planned + locked blocks = busy).
  const existing = await readDay(db, userId, today)
  if (existing.some((b) => b.task_id === taskId)) {
    // Already scheduled today — don't create a duplicate.
    return { blocks: existing, inserted: null, pastHours: false, reason: 'already_scheduled' }
  }

  const blockBusy = existing
    .map((b) => [hmToMinutes(b.start_local), hmToMinutes(b.end_local)] as [number, number])
    .filter(([s, e]) => e > s)

  // Also fold in the user's real calendar (covers a day that was never planned,
  // so we don't drop the task on top of a real meeting).
  let calBusy: [number, number][] = []
  try {
    const { timeMin, timeMax } = dayBoundsIso(today, tz)
    const events = await listDayEvents(accessToken, timeMin, timeMax)
    calBusy = events
      .map(
        (e) =>
          [hmToMinutes(isoToLocalHM(e.start, tz)), hmToMinutes(isoToLocalHM(e.end, tz))] as [number, number]
      )
      .filter(([s, e]) => e > s)
  } catch {
    // no calendar read — the stored blocks still cover the planned day
  }
  const occupied = [...blockBusy, ...calBusy]

  // 3. Window + earliest start (now on today, work_start on earlier/future days).
  const winStart = hmToMinutes(settings.work_start)
  const winEnd = hmToMinutes(settings.work_end)
  const now = nowLocalHM(tz)
  const earliest = isToday && hmToMinutes(now) > winStart ? roundUp5(hmToMinutes(now)) : winStart

  // 4. Duration estimate (Gemini from the title, priority default fallback).
  const dur = Math.max(5, await estimateTaskMinutes(task.title, priorityOf(task.priority)))

  // 5. Earliest free gap that fits; otherwise append after the last block.
  let startMin: number | null = null
  let pastHours = false
  for (const [gs, ge] of freeGaps(occupied, earliest, winEnd)) {
    if (ge - gs >= dur) {
      startMin = gs
      break
    }
  }
  if (startMin == null) {
    const lastEnd = occupied.length ? Math.max(...occupied.map(([, e]) => e)) : earliest
    startMin = Math.max(earliest, lastEnd + GAP)
    pastHours = startMin + dur > winEnd
  }
  const start = minutesToHm(startMin)
  const end = minutesToHm(startMin + dur)

  // 6. Write the calendar event + the block row. Nothing else changes.
  let eventId = ''
  try {
    eventId = await insertEvent(accessToken, {
      summary: task.title,
      date: today,
      startLocal: start,
      endLocal: end,
      timeZone: tz,
      description: 'Scheduled by Lock In · Game Plan',
      colorId: eventColorId(task.priority),
    })
  } catch {
    eventId = ''
  }

  await db.schema('lock_in').from('plan_blocks').insert({
    user_id: userId,
    task_id: task.id,
    recurring_id: null,
    title: task.title,
    plan_date: today,
    start_local: start,
    end_local: end,
    timezone: tz,
    estimated_minutes: dur,
    category: task.category,
    priority: task.priority,
    gcal_event_id: eventId || null,
    locked: false,
    status: 'scheduled',
  })

  return { blocks: await readDay(db, userId, today), inserted: { title: task.title, start, end }, pastHours }
}

async function readDay(db: SupabaseClient, userId: string, today: string): Promise<PlanBlock[]> {
  const { data } = await db
    .schema('lock_in')
    .from('plan_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_date', today)
    .order('start_local', { ascending: true })
  return (data ?? []) as PlanBlock[]
}

function priorityOf(p: string | null): 'low' | 'medium' | 'high' | null {
  return p === 'low' || p === 'medium' || p === 'high' ? p : null
}

function minutesToHm(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function roundUp5(mins: number): number {
  return Math.ceil(mins / 5) * 5
}

/** Google Calendar colour by priority, matching run.ts / the in-app timeline. */
function eventColorId(priority: string | null): string {
  switch (priority) {
    case 'high':
      return '11' // Tomato
    case 'low':
      return '5' // Banana
    default:
      return '6' // Tangerine (medium)
  }
}
