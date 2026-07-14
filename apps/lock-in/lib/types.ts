export type Priority = 'low' | 'medium' | 'high'

export type TaskCategory = 'work' | 'hustle' | 'social' | 'other'

// Tag options for one-off tasks. Colors are inline hex (the Lock In theme is
// black + gold and has no per-category palette tokens).
export const TASK_CATEGORIES: { value: TaskCategory; label: string; color: string }[] = [
  { value: 'work', label: 'Work', color: '#0090ff' },
  { value: 'hustle', label: 'Hustle', color: '#8e4ec6' },
  { value: 'social', label: 'Social', color: '#30a46c' },
  { value: 'other', label: 'Other', color: '#9b9ba6' },
]

export interface Task {
  id: string
  user_id: string
  title: string
  is_quick: boolean
  is_completed: boolean
  created_at: string
  last_suggested_at: string | null
  suggestion_count: number
  priority: Priority
  due_date: string | null
  category: TaskCategory | null
}

export const PRIORITY_RANK: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export type TimeMode = 'fixed' | 'flexible'

// ISO weekday: 1 = Monday … 7 = Sunday.
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface RecurringTask {
  id: string
  user_id: string
  title: string
  weekdays: number[] // subset of 1..7
  time_mode: TimeMode
  fixed_time: string | null // 'HH:MM' when time_mode === 'fixed'
  duration_minutes: number
  is_active: boolean
  created_at: string
}

export interface RecurringCompletion {
  id: string
  recurring_id: string
  user_id: string
  completed_date: string // 'YYYY-MM-DD'
  completed_at: string
}

export const EVERY_DAY: number[] = [1, 2, 3, 4, 5, 6, 7]

// Short labels for the weekday chip row, indexed so WEEKDAY_LABELS[iso-1].
export const WEEKDAY_LABELS: { iso: number; label: string }[] = [
  { iso: 1, label: 'M' },
  { iso: 2, label: 'T' },
  { iso: 3, label: 'W' },
  { iso: 4, label: 'T' },
  { iso: 5, label: 'F' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'S' },
]
