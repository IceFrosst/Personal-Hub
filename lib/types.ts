export interface Task {
  id: string
  user_id: string
  title: string
  is_quick: boolean
  is_completed: boolean
  created_at: string
  last_suggested_at: string | null
  suggestion_count: number
}
