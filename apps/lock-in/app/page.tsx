'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconArchive } from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import AddTaskBar from '@/components/AddTaskBar'
import TaskRow from '@/components/TaskRow'
import LockInLogo from '@/components/LockInLogo'
import { PRIORITY_RANK, type Priority, type Task } from '@/lib/types'

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

export default function HomePage() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetTask, setSheetTask] = useState<Task | null>(null)
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

      const { data } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)

      setTasks((data ?? []) as Task[])
      setLoading(false)
    }

    init()
  }, [supabase])

  const addTask = useCallback(
    async (title: string, priority: Priority, dueDate: string | null) => {
      if (!userId) return
      const { data, error: insertError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .insert({
          user_id: userId,
          title,
          priority,
          due_date: dueDate,
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

  const toggleComplete = useCallback(
    async (task: Task) => {
      setCompletingIds((prev) => {
        if (prev.has(task.id)) return prev
        const next = new Set(prev)
        next.add(task.id)
        return next
      })

      // Run DB write and animation timer in parallel — wait for both.
      // If the write fails we roll back so a refresh doesn't resurface the task.
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
      await supabase.schema('focus_gate').from('tasks').delete().eq('id', task.id)
    },
    [supabase]
  )

  const sorted = useMemo(() => sortTasks(tasks), [tasks])

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
        </header>

        <AddTaskBar onAdd={addTask} disabled={!userId} />

        {error && (
          <p
            role="alert"
            className="text-priority-high text-xs px-2 -mt-2 leading-snug"
          >
            Couldn&apos;t save: {error}
          </p>
        )}

        <section className="mt-2 flex flex-col">
          {loading ? (
            <p className="text-text-low text-sm py-12 text-center">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-text-low text-sm py-12 text-center">
              Nothing on the list. Add something above to lock in.
            </p>
          ) : (
            sorted.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={toggleComplete}
                onLongPress={setSheetTask}
                completing={completingIds.has(t.id)}
              />
            ))
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
              onClick={() => deleteTask(sheetTask)}
              className="w-full min-h-12 rounded-xl bg-priority-high/15 text-priority-high font-medium active:bg-priority-high/25 transition-colors"
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
    </main>
  )
}
