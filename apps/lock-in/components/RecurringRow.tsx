'use client'

import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconClock, IconFlame, IconInfinity } from '@tabler/icons-react'
import type { RecurringTask } from '@/lib/types'
import { describeRecurrence } from '@/lib/recurring'

type Props = {
  task: RecurringTask
  completed: boolean
  streak: number
  onToggle: (task: RecurringTask) => void
  onLongPress: (task: RecurringTask) => void
}

const LONG_PRESS_MS = 500

export default function RecurringRow({
  task,
  completed,
  streak,
  onToggle,
  onLongPress,
}: Props) {
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

  const timeLabel =
    task.time_mode === 'fixed' && task.fixed_time ? task.fixed_time : 'Flexible'

  return (
    <div
      className={`relative flex items-start gap-3 py-3 pl-5 pr-3 mb-2 rounded-xl overflow-hidden transition-colors ${
        pressing ? 'bg-surface-elevated' : 'bg-surface'
      }`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/70" />

      <button
        type="button"
        onClick={() => {
          if (triggeredRef.current) {
            triggeredRef.current = false
            return
          }
          onToggle(task)
        }}
        aria-label={completed ? 'Mark not done today' : 'Mark done today'}
        className={`mt-0.5 shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors ${
          completed
            ? 'bg-white/10 border-white text-white'
            : 'border-border-focus text-transparent active:border-white'
        }`}
      >
        <IconCheck size={14} stroke={3} />
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-base leading-snug break-words ${
            completed ? 'text-text-low line-through' : 'text-text'
          }`}
        >
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted flex-wrap">
          <span className="flex items-center gap-1">
            <IconInfinity size={13} className="text-white/70" />
            {describeRecurrence(task.weekdays)}
          </span>
          <span className="flex items-center gap-1">
            <IconClock size={12} />
            {timeLabel} · {task.duration_minutes}m
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-0.5 text-gold">
              <IconFlame size={12} />
              {streak}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
