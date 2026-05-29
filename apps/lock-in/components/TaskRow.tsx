'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import type { Task } from '@/lib/types'

type Props = {
  task: Task
  onToggle: (task: Task) => void
  onLongPress: (task: Task) => void
  completing?: boolean
}

const PRIORITY_ACCENT: Record<Task['priority'], string> = {
  low: 'bg-prio-low',
  medium: 'bg-prio-medium',
  high: 'bg-prio-high',
}

function formatDueChip(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = due.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const overdue = diff < 0
  let text: string
  if (diff === 0) text = 'Today'
  else if (diff === 1) text = 'Tomorrow'
  else if (diff > 1 && diff < 7) {
    text = target.toLocaleDateString(undefined, { weekday: 'short' })
  } else {
    text = target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return { text: overdue ? `Overdue · ${text}` : text, overdue }
}

const LONG_PRESS_MS = 500

export default function TaskRow({ task, onToggle, onLongPress, completing }: Props) {
  const [pressing, setPressing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggeredRef = useRef(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function startPress() {
    triggeredRef.current = false
    setPressing(true)
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true
      onLongPress(task)
      setPressing(false)
      if (navigator.vibrate) navigator.vibrate(15)
    }, LONG_PRESS_MS)
  }

  function endPress() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPressing(false)
  }

  const due = formatDueChip(task.due_date)
  const checked = task.is_completed || !!completing

  return (
    <div
      className={`relative flex items-start gap-3 py-3 pl-5 pr-3 mb-2 rounded-xl overflow-hidden transition-colors ${
        pressing ? 'bg-surface-elevated' : 'bg-surface'
      } ${completing ? 'lock-in-task-complete' : ''}`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${PRIORITY_ACCENT[task.priority]}`}
      />

      <button
        type="button"
        onClick={() => {
          if (triggeredRef.current) {
            triggeredRef.current = false
            return
          }
          onToggle(task)
        }}
        aria-label={task.is_completed ? 'Mark active' : 'Mark complete'}
        className={`mt-0.5 shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors ${
          checked
            ? 'bg-gold/10 border-gold text-gold'
            : 'border-border-focus text-transparent active:border-gold'
        }`}
      >
        <IconCheck
          size={14}
          stroke={3}
          className={completing ? 'lock-in-check-pop' : ''}
        />
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-base leading-snug break-words ${
            checked ? 'text-text-low line-through' : 'text-text'
          }`}
        >
          {task.title}
        </p>
        {due && (
          <p
            className={`mt-0.5 text-xs ${
              due.overdue ? 'text-priority-high' : 'text-text-muted'
            }`}
          >
            {due.text}
          </p>
        )}
      </div>
    </div>
  )
}
