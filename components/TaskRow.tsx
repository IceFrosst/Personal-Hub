'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import type { Task } from '@/lib/types'

type Props = {
  task: Task
  onToggle: (task: Task) => void
  onLongPress: (task: Task) => void
}

const PRIORITY_DOT: Record<Task['priority'], string> = {
  low: 'bg-priority-low',
  medium: 'bg-priority-medium',
  high: 'bg-priority-high',
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

export default function TaskRow({ task, onToggle, onLongPress }: Props) {
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

  return (
    <div
      className={`flex items-start gap-3 py-2.5 px-2 rounded-xl transition-colors ${
        pressing ? 'bg-surface-elevated' : ''
      }`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
    >
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
        className={`mt-0.5 shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.is_completed
            ? 'bg-gold border-gold text-black'
            : 'border-border-focus text-transparent active:border-gold'
        }`}
      >
        <IconCheck size={14} stroke={3} />
      </button>

      <span
        className={`mt-2 shrink-0 h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`}
      />

      <div className="flex-1 min-w-0">
        <p
          className={`text-base leading-snug break-words ${
            task.is_completed ? 'text-text-low line-through' : 'text-text'
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
