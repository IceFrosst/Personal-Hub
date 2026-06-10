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
  priority: Priority
  due_date: string | null
}

export const PRIORITY_RANK: Record<Priority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

// The DB column is nullable (additive migration with a default); rows written by
// other apps can carry null. Normalize once at the Supabase boundary so the rest
// of the app can treat `priority` as non-null.
export type TaskRowFromDb = Omit<Task, 'priority'> & { priority: Priority | null }

export function normalizeTask(row: TaskRowFromDb): Task {
  return { ...row, priority: row.priority ?? 'medium' }
}
