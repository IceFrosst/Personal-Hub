'use client'

import { useRef, useState } from 'react'
import { IconCalendar } from '@tabler/icons-react'
import { TASK_CATEGORIES, type Priority, type Task, type TaskCategory } from '@/lib/types'

type Props = {
  task: Task
  onSave: (updates: {
    title: string
    priority: Priority
    due_date: string | null
    category: TaskCategory | null
  }) => Promise<void> | void
  onClose: () => void
}

const PRIORITY_OPTIONS: { value: Priority; label: string; dot: string }[] = [
  { value: 'low', label: 'Low', dot: 'bg-prio-low' },
  { value: 'medium', label: 'Med', dot: 'bg-prio-medium' },
  { value: 'high', label: 'High', dot: 'bg-prio-high' },
]

function formatChip(value: string | null): string {
  if (!value) return 'Date'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = value.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return target.toLocaleDateString(undefined, { weekday: 'short' })
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function EditTaskSheet({ task, onSave, onClose }: Props) {
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [dueDate, setDueDate] = useState<string | null>(task.due_date)
  const [category, setCategory] = useState<TaskCategory | null>(task.category)
  const [saving, setSaving] = useState(false)
  const dateRef = useRef<HTMLInputElement | null>(null)

  function openDatePicker() {
    const el = dateRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') el.showPicker()
    else {
      el.focus()
      el.click()
    }
  }

  async function save() {
    const text = title.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      await onSave({ title: text, priority, due_date: dueDate, category })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-surface-elevated rounded-t-3xl border-t border-border p-4 pb-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-wide text-text-low mb-2 px-1">Edit task</p>

        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          autoFocus
          className="w-full py-2.5 px-3 rounded-xl bg-surface border border-border focus:border-border-focus outline-none text-base text-text placeholder:text-text-low transition-colors resize-none leading-snug"
          placeholder="Task title"
        />

        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center rounded-lg bg-surface border border-border p-0.5">
            {PRIORITY_OPTIONS.map((opt) => {
              const active = priority === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    active ? 'bg-gold/15 text-gold' : 'text-text-muted'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                  {opt.label}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={openDatePicker}
            className={`relative flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg border text-xs transition-colors ${
              dueDate
                ? 'bg-gold/10 border-gold/40 text-gold'
                : 'bg-surface border-border text-text-muted active:bg-surface-elevated'
            }`}
          >
            <IconCalendar size={14} />
            {formatChip(dueDate)}
            <input
              ref={dateRef}
              type="date"
              value={dueDate ?? ''}
              onChange={(e) => setDueDate(e.target.value || null)}
              className="absolute inset-0 opacity-0 pointer-events-none"
              tabIndex={-1}
            />
          </button>

          {dueDate && (
            <button
              type="button"
              onClick={() => setDueDate(null)}
              className="text-xs text-text-low active:text-text-muted px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {TASK_CATEGORIES.map((c) => {
            const active = category === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(active ? null : c.value)}
                className="min-h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors"
                style={{
                  color: c.color,
                  borderColor: active ? c.color : `${c.color}59`,
                  backgroundColor: active ? `${c.color}26` : 'transparent',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!title.trim() || saving}
          className="lock-in-gold-button mt-4 w-full min-h-12 rounded-xl text-black font-semibold active:scale-[0.99] transition-transform disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full min-h-12 rounded-xl text-text-muted active:text-text transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
