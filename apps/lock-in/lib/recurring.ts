import type { RecurringTask } from './types'

/** Local ISO weekday for a date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(d: Date = new Date()): number {
  const js = d.getDay() // 0 = Sun … 6 = Sat
  return js === 0 ? 7 : js
}

/** 'YYYY-MM-DD' for the local date. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Does this recurring task recur on the given weekday? */
export function isDueOnWeekday(rt: RecurringTask, weekday: number): boolean {
  return rt.is_active && rt.weekdays.includes(weekday)
}

/**
 * Current streak = consecutive due days up to (and including) today that were
 * completed. Walks backwards day by day, skipping non-due days, and stops at
 * the first due day with no completion. If today is due but not yet done, the
 * streak still counts through yesterday (today doesn't break it).
 */
export function currentStreak(
  rt: RecurringTask,
  completedDates: Set<string>,
  today: Date = new Date()
): number {
  let streak = 0
  const cursor = new Date(today)
  // Look back up to ~1 year; personal use never needs more.
  for (let i = 0; i < 366; i++) {
    const wd = isoWeekday(cursor)
    if (rt.weekdays.includes(wd)) {
      const key = localDateKey(cursor)
      const isToday = i === 0
      if (completedDates.has(key)) {
        streak++
      } else if (!isToday) {
        break // a past due day was missed → streak ends
      }
      // today-but-not-done: don't count, don't break
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Human summary of the recurrence, e.g. "Every day", "Mon, Wed, Fri". */
export function describeRecurrence(weekdays: number[]): string {
  if (weekdays.length === 7) return 'Every day'
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weekdaysOnly = [1, 2, 3, 4, 5]
  if (
    weekdays.length === 5 &&
    weekdaysOnly.every((d) => weekdays.includes(d))
  ) {
    return 'Weekdays'
  }
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => names[d - 1])
    .join(', ')
}
