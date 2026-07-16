'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconArchive, IconCalendarBolt } from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import AddTaskBar, { type RecurringDraft } from '@/components/AddTaskBar'
import TaskRow from '@/components/TaskRow'
import RecurringRow from '@/components/RecurringRow'
import EditTaskSheet from '@/components/EditTaskSheet'
import EditRecurringSheet, { type RecurringUpdate } from '@/components/EditRecurringSheet'
import LockInLogo from '@/components/LockInLogo'
import {
  PRIORITY_RANK,
  type Priority,
  type RecurringCompletion,
  type RecurringTask,
  type Task,
  type TaskCategory,
} from '@/lib/types'
import { currentStreak, isDueOnWeekday, isoWeekday, localDateKey } from '@/lib/recurring'

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (p !== 0) return p
    if (a.due_date && b.due_date) {
      if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1
    } else if (a.due_date) {
      return -1
    } else if (b.due_date) {
      return 1
    }
    return b.created_at.localeCompare(a.created_at)
  })
}

// Fixed-time routines first (by time), then flexible ones.
function sortRecurring(items: RecurringTask[]): RecurringTask[] {
  return [...items].sort((a, b) => {
    const af = a.time_mode === 'fixed'
    const bf = b.time_mode === 'fixed'
    if (af && bf) return (a.fixed_time ?? '').localeCompare(b.fixed_time ?? '')
    if (af) return -1
    if (bf) return 1
    return a.created_at.localeCompare(b.created_at)
  })
}

export default function HomePage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [recurring, setRecurring] = useState<RecurringTask[]>([])
  // recurring_id → set of completed 'YYYY-MM-DD'
  const [completions, setCompletions] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [sheetTask, setSheetTask] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [sheetRecurring, setSheetRecurring] = useState<RecurringTask | null>(null)
  const [editRecurring, setEditRecurring] = useState<RecurringTask | null>(null)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/`,
          },
        })
        return
      }

      setUserId(user.id)

      // 120-day lookback is plenty for streaks in personal use.
      const since = new Date()
      since.setDate(since.getDate() - 120)

      const [{ data: taskRows }, { data: recRows }, { data: compRows }] = await Promise.all([
        supabase
          .schema('focus_gate')
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_completed', false),
        supabase
          .schema('lock_in')
          .from('recurring_tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .schema('lock_in')
          .from('recurring_completions')
          .select('recurring_id, completed_date')
          .eq('user_id', user.id)
          .gte('completed_date', localDateKey(since)),
      ])

      setTasks((taskRows ?? []) as Task[])
      setRecurring((recRows ?? []) as RecurringTask[])
      setCompletions(buildCompletionMap((compRows ?? []) as Partial<RecurringCompletion>[]))
      setLoading(false)
    }

    init()
  }, [supabase])

  const addTask = useCallback(
    async (
      title: string,
      priority: Priority,
      dueDate: string | null,
      category: TaskCategory | null
    ) => {
      if (!userId) return
      const { data, error: insertError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .insert({
          user_id: userId,
          title,
          priority,
          due_date: dueDate,
          category,
          is_quick: false,
        })
        .select()
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      if (data) {
        setError(null)
        setTasks((prev) => [...prev, data as Task])
      }
    },
    [supabase, userId]
  )

  const addRecurring = useCallback(
    async (title: string, draft: RecurringDraft) => {
      if (!userId) return
      const { data, error: insertError } = await supabase
        .schema('lock_in')
        .from('recurring_tasks')
        .insert({
          user_id: userId,
          title,
          weekdays: draft.weekdays,
          time_mode: draft.timeMode,
          fixed_time: draft.fixedTime,
          duration_minutes: draft.durationMinutes,
        })
        .select()
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      if (data) {
        setError(null)
        setRecurring((prev) => [...prev, data as RecurringTask])
      }
    },
    [supabase, userId]
  )

  const toggleComplete = useCallback(
    async (task: Task) => {
      setCompletingIds((prev) => {
        if (prev.has(task.id)) return prev
        const next = new Set(prev)
        next.add(task.id)
        return next
      })

      const [{ error }] = await Promise.all([
        supabase
          .schema('focus_gate')
          .from('tasks')
          .update({ is_completed: true })
          .eq('id', task.id),
        new Promise<void>((resolve) => setTimeout(resolve, 480)),
      ])

      if (error) {
        setCompletingIds((prev) => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
        setError(error.message)
        return
      }

      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setCompletingIds((prev) => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    },
    [supabase]
  )

  const deleteTask = useCallback(
    async (task: Task) => {
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setSheetTask(null)
      const { error: deleteError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .delete()
        .eq('id', task.id)
      if (deleteError) {
        setTasks((prev) => [...prev, task])
        setError(deleteError.message)
        return
      }
      // Remove its Game Plan blocks + calendar events (today onward).
      fetch('/api/game-plan/cleanup-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id }),
      }).catch(() => {})
    },
    [supabase]
  )

  const updateTask = useCallback(
    async (
      task: Task,
      updates: {
        title: string
        priority: Priority
        due_date: string | null
        category: TaskCategory | null
      }
    ) => {
      const prevState = task
      // Optimistic update.
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t)))
      setEditTask(null)
      const { error: updateError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .update(updates)
        .eq('id', task.id)
      if (updateError) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? prevState : t)))
        setError(updateError.message)
        return
      }
      // Keep any Game Plan blocks for this task (today onward) in sync.
      if (userId) {
        await supabase
          .schema('lock_in')
          .from('plan_blocks')
          .update({ title: updates.title, priority: updates.priority, category: updates.category })
          .eq('user_id', userId)
          .eq('task_id', task.id)
          .gte('plan_date', localDateKey())
      }
    },
    [supabase, userId]
  )

  const toggleRecurring = useCallback(
    async (task: RecurringTask) => {
      if (!userId) return
      const today = localDateKey()
      const done = completions.get(task.id)?.has(today) ?? false

      // Optimistic toggle.
      setCompletions((prev) => {
        const next = new Map(prev)
        const set = new Set(next.get(task.id) ?? [])
        if (done) set.delete(today)
        else set.add(today)
        next.set(task.id, set)
        return next
      })

      const { error: writeError } = done
        ? await supabase
            .schema('lock_in')
            .from('recurring_completions')
            .delete()
            .eq('recurring_id', task.id)
            .eq('completed_date', today)
        : await supabase
            .schema('lock_in')
            .from('recurring_completions')
            .upsert(
              { user_id: userId, recurring_id: task.id, completed_date: today },
              { onConflict: 'recurring_id,completed_date' }
            )

      if (writeError) {
        // Roll back.
        setCompletions((prev) => {
          const next = new Map(prev)
          const set = new Set(next.get(task.id) ?? [])
          if (done) set.add(today)
          else set.delete(today)
          next.set(task.id, set)
          return next
        })
        setError(writeError.message)
      }
    },
    [supabase, userId, completions]
  )

  const updateRecurring = useCallback(
    async (task: RecurringTask, updates: RecurringUpdate) => {
      const prevState = task
      setRecurring((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t)))
      setEditRecurring(null)
      const { error: updateError } = await supabase
        .schema('lock_in')
        .from('recurring_tasks')
        .update(updates)
        .eq('id', task.id)
      if (updateError) {
        setRecurring((prev) => prev.map((t) => (t.id === task.id ? prevState : t)))
        setError(updateError.message)
        return
      }
      // Sync the title onto any Game Plan blocks (time/duration apply on replan).
      if (userId) {
        await supabase
          .schema('lock_in')
          .from('plan_blocks')
          .update({ title: updates.title })
          .eq('user_id', userId)
          .eq('recurring_id', task.id)
          .gte('plan_date', localDateKey())
      }
    },
    [supabase, userId]
  )

  const deleteRecurring = useCallback(
    async (task: RecurringTask) => {
      setRecurring((prev) => prev.filter((t) => t.id !== task.id))
      setSheetRecurring(null)
      const { error: deleteError } = await supabase
        .schema('lock_in')
        .from('recurring_tasks')
        .delete()
        .eq('id', task.id)
      if (deleteError) {
        setRecurring((prev) => [...prev, task])
        setError(deleteError.message)
        return
      }
      // Remove its Game Plan blocks + calendar events (today onward).
      fetch('/api/game-plan/cleanup-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurringId: task.id }),
      }).catch(() => {})
    },
    [supabase]
  )

  const sorted = useMemo(() => sortTasks(tasks), [tasks])
  const todayWeekday = isoWeekday()
  const dueRecurring = useMemo(
    () => sortRecurring(recurring.filter((r) => isDueOnWeekday(r, todayWeekday))),
    [recurring, todayWeekday]
  )
  const today = localDateKey()
  const isEmpty = sorted.length === 0 && dueRecurring.length === 0

  return (
    <main
      className="flex flex-col items-center px-4 bg-black min-h-[100dvh]"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <header className="flex items-center gap-2.5 pt-2">
          <LockInLogo size={46} />
          <h1 className="text-2xl font-semibold tracking-tight text-text">Lock In</h1>
          <Link
            href="/game-plan"
            aria-label="Game Plan"
            className="ml-auto min-h-11 min-w-11 flex items-center justify-center text-text-muted active:text-gold transition-colors"
          >
            <IconCalendarBolt size={24} stroke={1.5} />
          </Link>
        </header>

        <AddTaskBar onAdd={addTask} onAddRecurring={addRecurring} disabled={!userId} />

        {error && (
          <p role="alert" className="text-priority-high text-xs px-2 -mt-2 leading-snug">
            Couldn&apos;t save: {error}
          </p>
        )}

        <section className="mt-2 flex flex-col">
          {loading ? (
            <p className="text-text-low text-sm py-12 text-center">Loading…</p>
          ) : isEmpty ? (
            <p className="text-text-low text-sm py-12 text-center">
              Nothing on the list. Add something above to lock in.
            </p>
          ) : (
            <>
              {sorted.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={toggleComplete}
                  onLongPress={setSheetTask}
                  completing={completingIds.has(t.id)}
                />
              ))}
              {dueRecurring.map((r) => (
                <RecurringRow
                  key={r.id}
                  task={r}
                  completed={completions.get(r.id)?.has(today) ?? false}
                  streak={currentStreak(r, completions.get(r.id) ?? new Set())}
                  onToggle={toggleRecurring}
                  onLongPress={setSheetRecurring}
                />
              ))}
            </>
          )}
        </section>

        <Link
          href="/archive"
          className="mt-6 self-center flex items-center gap-1.5 text-text-low text-xs active:text-text-muted"
        >
          <IconArchive size={14} />
          Archive
        </Link>
      </div>

      {sheetTask && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          onClick={() => setSheetTask(null)}
        >
          <div
            className="w-full max-w-[420px] bg-surface-elevated rounded-t-3xl border-t border-border p-4 pb-8"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text text-base truncate mb-3 px-1">{sheetTask.title}</p>
            <button
              type="button"
              onClick={() => {
                setEditTask(sheetTask)
                setSheetTask(null)
              }}
              className="w-full min-h-12 rounded-xl bg-surface text-text font-medium active:bg-border/40 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteTask(sheetTask)}
              className="mt-2 w-full min-h-12 rounded-xl bg-priority-high/15 text-priority-high font-medium active:bg-priority-high/25 transition-colors"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSheetTask(null)}
              className="mt-2 w-full min-h-12 rounded-xl text-text-muted active:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sheetRecurring && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          onClick={() => setSheetRecurring(null)}
        >
          <div
            className="w-full max-w-[420px] bg-surface-elevated rounded-t-3xl border-t border-border p-4 pb-8"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text text-base truncate mb-1 px-1">{sheetRecurring.title}</p>
            <p className="text-text-low text-xs mb-3 px-1">Recurring routine</p>
            <button
              type="button"
              onClick={() => {
                setEditRecurring(sheetRecurring)
                setSheetRecurring(null)
              }}
              className="w-full min-h-12 rounded-xl bg-surface text-text font-medium active:bg-border/40 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteRecurring(sheetRecurring)}
              className="mt-2 w-full min-h-12 rounded-xl bg-priority-high/15 text-priority-high font-medium active:bg-priority-high/25 transition-colors"
            >
              Delete routine
            </button>
            <button
              type="button"
              onClick={() => setSheetRecurring(null)}
              className="mt-2 w-full min-h-12 rounded-xl text-text-muted active:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editTask && (
        <EditTaskSheet
          task={editTask}
          onSave={(updates) => updateTask(editTask, updates)}
          onClose={() => setEditTask(null)}
        />
      )}

      {editRecurring && (
        <EditRecurringSheet
          task={editRecurring}
          onSave={(updates) => updateRecurring(editRecurring, updates)}
          onClose={() => setEditRecurring(null)}
        />
      )}
    </main>
  )
}

function buildCompletionMap(rows: Partial<RecurringCompletion>[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.recurring_id || !row.completed_date) continue
    const set = map.get(row.recurring_id) ?? new Set<string>()
    set.add(row.completed_date)
    map.set(row.recurring_id, set)
  }
  return map
}
