export type Priority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  user_id: string
  title: string
  is_quick: boolean
  is_completed: boolean
  created_at: string
  last_suggested_at: string | null
  suggestion_count: number
  // Added by Lock In on the shared focus_gate.tasks table (additive — see SCHEMA_RULES.md).
  // Optional here because rows created before these columns existed may not have them.
  priority?: Priority | null
  due_date?: string | null
}

export const PRIORITY_RANK: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export interface Suggestion {
  taskId: string
  taskTitle: string
  reason: string
}
