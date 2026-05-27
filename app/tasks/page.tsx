'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Task } from '@/lib/types'
import {
  IconPlus,
  IconCheck,
  IconTrash,
  IconBolt,
  IconChevronDown,
  IconChevronRight,
  IconArrowLeft,
} from '@tabler/icons-react'

export default function TasksPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [isQuick, setIsQuick] = useState(false)
  const [adding, setAdding] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/tasks`,
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
        .order('created_at', { ascending: true })

      setTasks((data ?? []) as Task[])
      setLoading(false)
    }

    init()
  }, [supabase])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim() || !userId || adding) return
    setAdding(true)

    const { data, error } = await supabase
      .schema('focus_gate')
      .from('tasks')
      .insert({ user_id: userId, title: newTitle.trim(), is_quick: isQuick })
      .select()
      .single()

    if (!error && data) {
      setTasks(prev => [...prev, data as Task])
      setNewTitle('')
      setIsQuick(false)
    }
    setAdding(false)
  }

  async function completeTask(id: string) {
    const { data } = await supabase
      .schema('focus_gate')
      .from('tasks')
      .update({ is_completed: true })
      .eq('id', id)
      .select()
      .single()

    if (data) setTasks(prev => prev.map(t => (t.id === id ? (data as Task) : t)))
  }

  async function deleteTask(id: string) {
    await supabase.schema('focus_gate').from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const active = tasks.filter(t => !t.is_completed)
  const done = tasks.filter(t => t.is_completed)

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-bg" style={{ minHeight: '100dvh' }}>
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-purple animate-spin" />
      </div>
    )
  }

  return (
    <main
      className="max-w-[400px] mx-auto px-4 bg-bg"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/')}
          className="min-h-11 min-w-11 flex items-center justify-center text-text-muted -ml-2"
        >
          <IconArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <h1 className="text-2xl font-semibold text-text">Tasks</h1>
      </div>

      <form onSubmit={addTask} className="mb-6 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="What do you need to do?"
            className="flex-1 min-h-11 px-3 py-2 bg-surface border border-border rounded-md text-text text-base placeholder:text-text-low focus:outline-none focus:border-border-focus transition-colors duration-150"
          />
          <button
            type="submit"
            disabled={!newTitle.trim() || adding}
            className="min-h-11 w-11 bg-purple rounded-md text-white flex items-center justify-center disabled:opacity-40 transition-colors duration-150 flex-shrink-0"
          >
            <IconPlus size={20} strokeWidth={1.5} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsQuick(q => !q)}
          className={`self-start flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors duration-150 ${
            isQuick
              ? 'bg-surface-elevated text-purple border border-border-focus'
              : 'bg-surface text-text-muted border border-border'
          }`}
        >
          <IconBolt size={14} strokeWidth={1.5} />
          Quick task
        </button>
      </form>

      <div className="space-y-2 mb-4">
        {active.length === 0 && (
          <p className="text-text-low text-sm py-8 text-center">No tasks yet. Add something above.</p>
        )}
        {active.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={() => completeTask(task.id)}
            onDelete={() => deleteTask(task.id)}
          />
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <button
            onClick={() => setDoneOpen(o => !o)}
            className="flex items-center gap-2 text-text-muted text-sm min-h-11 mb-1"
          >
            {doneOpen ? (
              <IconChevronDown size={16} strokeWidth={1.5} />
            ) : (
              <IconChevronRight size={16} strokeWidth={1.5} />
            )}
            Done ({done.length})
          </button>
          {doneOpen && (
            <div className="space-y-2 opacity-60">
              {done.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => {}}
                  onDelete={() => deleteTask(task.id)}
                  completed
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

function TaskRow({
  task,
  onComplete,
  onDelete,
  completed = false,
}: {
  task: Task
  onComplete: () => void
  onDelete: () => void
  completed?: boolean
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-surface rounded-2xl border border-border min-h-[3.25rem]">
      <button
        onClick={completed ? undefined : onComplete}
        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors duration-150 ${
          completed
            ? 'bg-green/20 border-green/40'
            : 'border-border-focus hover:border-green hover:bg-green/10'
        }`}
      >
        {completed && <IconCheck size={12} strokeWidth={2} className="text-green" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-base ${
          completed ? 'line-through text-text-muted' : 'text-text'
        }`}>
          {task.title}
        </p>
        {task.is_quick && !completed && (
          <span className="flex items-center gap-1 text-xs text-text-low">
            <IconBolt size={10} strokeWidth={1.5} />
            Quick
          </span>
        )}
      </div>
      <button
        onClick={onDelete}
        className="flex-shrink-0 min-w-[2.75rem] min-h-11 flex items-center justify-center text-text-low hover:text-coral transition-colors duration-150"
      >
        <IconTrash size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
