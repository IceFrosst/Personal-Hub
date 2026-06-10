'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconArrowLeft, IconArchive } from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import TaskRow from '@/components/TaskRow'
import { normalizeTask, type Task, type TaskRowFromDb } from '@/lib/types'

export default function ArchivePage() {
  const supabase = useMemo(() => createClient(), [])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetTask, setSheetTask] = useState<Task | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/archive`,
          },
        })
        return
      }

      const { data, error: fetchError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('created_at', { ascending: false })

      // A failed fetch is not an empty archive — surface it and leave tasks alone.
      if (fetchError || !data) {
        setError(`Couldn't load archive: ${fetchError?.message ?? 'no data returned'}`)
        setLoading(false)
        return
      }

      setError(null)
      setTasks((data as TaskRowFromDb[]).map(normalizeTask))
      setLoading(false)
    }

    init()
  }, [supabase])

  const restoreTask = useCallback(
    async (task: Task) => {
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      setSheetTask(null)
      const { error: restoreError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .update({ is_completed: false })
        .eq('id', task.id)
      if (restoreError) {
        setTasks((prev) => [...prev, task])
        setError(`Couldn't restore: ${restoreError.message}`)
      }
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
        setError(`Couldn't delete: ${deleteError.message}`)
      }
    },
    [supabase]
  )

  return (
    <main
      className="flex flex-col items-center px-4 bg-black min-h-[100dvh]"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <header className="flex items-center gap-2 pt-2">
          <Link
            href="/"
            aria-label="Back"
            className="min-h-9 min-w-9 -ml-1 flex items-center justify-center text-text-muted active:text-text"
          >
            <IconArrowLeft size={22} />
          </Link>
          <IconArchive size={22} className="text-text-muted" />
          <h1 className="text-2xl font-semibold tracking-tight text-text">Archive</h1>
        </header>

        {error && (
          <p role="alert" className="text-priority-high text-xs px-2 leading-snug">
            {error}
          </p>
        )}

        <section className="mt-2 flex flex-col">
          {loading ? (
            <p className="text-text-low text-sm py-12 text-center">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-text-low text-sm py-12 text-center">
              Nothing archived yet.
            </p>
          ) : (
            tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={restoreTask}
                onLongPress={setSheetTask}
              />
            ))
          )}
        </section>
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
              onClick={() => restoreTask(sheetTask)}
              className="w-full min-h-12 rounded-xl bg-gold/15 text-gold font-medium active:bg-gold/25 transition-colors"
            >
              Restore
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
    </main>
  )
}
