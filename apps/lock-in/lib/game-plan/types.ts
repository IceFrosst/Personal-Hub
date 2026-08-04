// Game Plan — shared types for the AI day-scheduler.

import type { TaskCategory } from '@/lib/types'

export interface CalendarConnection {
  user_id: string
  google_email: string | null
  connected_at: string
  updated_at: string
}

export interface PlanSettings {
  user_id: string
  work_start: string // 'HH:MM' local
  work_end: string // 'HH:MM' local
  timezone: string // IANA tz, e.g. 'Europe/Vilnius'
  auto_plan: boolean
  // Deep Work: how many long focus blocks to reserve, and their length range.
  deep_work_count: number
  deep_work_min_minutes: number
  deep_work_max_minutes: number
  updated_at: string
}

export const DEFAULT_SETTINGS: Omit<PlanSettings, 'user_id' | 'updated_at'> = {
  work_start: '09:00',
  work_end: '18:00',
  timezone: 'Europe/Vilnius',
  auto_plan: true,
  deep_work_count: 2,
  deep_work_min_minutes: 120,
  deep_work_max_minutes: 240,
}

export type PlanBlockStatus = 'scheduled' | 'done' | 'skipped' | 'continued'

export interface PlanBlock {
  id: string
  user_id: string
  task_id: string | null
  recurring_id: string | null
  title: string
  plan_date: string // 'YYYY-MM-DD'
  start_local: string // 'HH:MM'
  end_local: string // 'HH:MM'
  timezone: string
  estimated_minutes: number | null
  gcal_event_id: string | null
  category: TaskCategory | null
  priority: 'low' | 'medium' | 'high' | null
  locked: boolean
  /** 'deep_work' = a reserved focus session. null = task / routine / calendar block. */
  kind: BlockKind
  status: PlanBlockStatus
  created_at: string
}

export type BlockKind = 'deep_work' | null

/** A task the user put inside a Deep Work session (no time of its own). */
export interface DeepWorkItem {
  id: string
  block_id: string
  task_id: string
  position: number
}

// The minimal task shape the planner reasons over.
export interface PlannableTask {
  id: string
  title: string
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  category: TaskCategory | null
}

// Recurring routines due today, split by how they want placing.
export interface FixedRecurringInput {
  id: string
  title: string
  durationMinutes: number
  fixedTime: string // 'HH:MM'
}

export interface FlexRecurringInput {
  id: string
  title: string
  durationMinutes: number
}

// A block as returned by the planner, before it becomes a PlanBlock row.
export interface ProposedBlock {
  task_id: string | null
  recurring_id: string | null
  title: string
  start: string // 'HH:MM'
  end: string // 'HH:MM'
  estimated_minutes: number
  category: TaskCategory | null
  priority: 'low' | 'medium' | 'high' | null
  kind?: BlockKind
}

// Whether the model actually planned, or we fell back (and why).
export type AiStatus = 'ok' | 'fallback' | 'rate_limited'
