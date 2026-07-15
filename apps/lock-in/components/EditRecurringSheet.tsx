'use client'

import { useState } from 'react'
import { IconClock } from '@tabler/icons-react'
import TimeWheel from '@/components/TimeWheel'
import {
  EVERY_DAY,
  WEEKDAY_LABELS,
  type RecurringTask,
  type TimeMode,
} from '@/lib/types'

export type RecurringUpdate = {
  title: string
  weekdays: number[]
  time_mode: TimeMode
  fixed_time: string | null
  duration_minutes: number
}

type Props = {
  task: RecurringTask
  onSave: (updates: RecurringUpdate) => Promise<void> | void
  onClose: () => void
}

const onlyDigits = (s: string, max = 2) => s.replace(/\D/g, '').slice(0, max)

export default function EditRecurringSheet({ task, onSave, onClose }: Props) {
  const [title, setTitle] = useState(task.title)
  const [dayMode, setDayMode] = useState<'everyday' | 'custom'>(
    task.weekdays.length === 7 ? 'everyday' : 'custom'
  )
  const [weekdays, setWeekdays] = useState<number[]>(task.weekdays)
  const [timeMode, setTimeMode] = useState<TimeMode>(task.time_mode)
  const [fixedTime, setFixedTime] = useState(task.fixed_time ?? '09:00')
  const [durHours, setDurHours] = useState(String(Math.floor(task.duration_minutes / 60)))
  const [durMins, setDurMins] = useState(String(task.duration_minutes % 60))
  const [saving, setSaving] = useState(false)

  const totalDuration = (parseInt(durHours, 10) || 0) * 60 + (parseInt(durMins, 10) || 0)
  const valid =
    title.trim().length > 0 && (dayMode === 'everyday' || weekdays.length > 0) && totalDuration > 0

  function toggleWeekday(iso: number) {
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
    )
  }

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        weekdays: dayMode === 'everyday' ? EVERY_DAY : [...weekdays].sort((a, b) => a - b),
        time_mode: timeMode,
        fixed_time: timeMode === 'fixed' ? fixedTime : null,
        duration_minutes: totalDuration,
      })
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
        <p className="text-xs uppercase tracking-wide text-text-low mb-2 px-1">Edit routine</p>

        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={1}
          autoFocus
          placeholder="Routine name"
          className="w-full py-2.5 px-3 rounded-xl bg-surface border border-border focus:border-border-focus outline-none text-base text-text placeholder:text-text-low transition-colors resize-none leading-snug"
        />

        {/* Time mode + duration */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="flex items-center rounded-lg bg-surface border border-border p-0.5">
            {(['flexible', 'fixed'] as TimeMode[]).map((mode) => {
              const active = timeMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTimeMode(mode)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    active ? 'bg-gold/15 text-gold' : 'text-text-muted'
                  }`}
                >
                  {mode}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 min-h-9 px-2 rounded-lg border bg-surface border-border text-text-muted text-xs">
            <input
              inputMode="numeric"
              value={durHours}
              onChange={(e) => setDurHours(onlyDigits(e.target.value))}
              onBlur={() => setDurHours(String(Math.min(23, parseInt(durHours, 10) || 0)))}
              aria-label="Duration hours"
              className="w-6 bg-transparent text-text text-center tabular-nums outline-none"
            />
            <span>h</span>
            <input
              inputMode="numeric"
              value={durMins}
              onChange={(e) => setDurMins(onlyDigits(e.target.value))}
              onBlur={() => setDurMins(String(Math.min(59, parseInt(durMins, 10) || 0)))}
              aria-label="Duration minutes"
              className="w-6 bg-transparent text-text text-center tabular-nums outline-none"
            />
            <span>m</span>
          </div>
        </div>

        {timeMode === 'fixed' && (
          <div className="flex items-center gap-2 mt-3">
            <IconClock size={16} className="text-text-muted" />
            <TimeWheel value={fixedTime} onChange={setFixedTime} />
          </div>
        )}

        {/* Repeat */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="flex items-center rounded-lg bg-surface border border-border p-0.5">
            {(
              [
                ['everyday', 'Every day'],
                ['custom', 'Custom'],
              ] as const
            ).map(([val, label]) => {
              const active = dayMode === val
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    if (val === 'custom' && dayMode !== 'custom' && weekdays.length === 7) {
                      setWeekdays([])
                    }
                    setDayMode(val)
                  }}
                  className={`px-2 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    active ? 'bg-gold/15 text-gold' : 'text-text-muted'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {dayMode === 'custom' && (
            <div className="flex items-center gap-1 shrink-0">
              {WEEKDAY_LABELS.map(({ iso, label }) => {
                const on = weekdays.includes(iso)
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => toggleWeekday(iso)}
                    aria-pressed={on}
                    className={`h-7 w-7 rounded-full text-[11px] font-medium transition-colors ${
                      on
                        ? 'bg-gold/15 text-gold border border-gold/50'
                        : 'bg-surface text-text-muted border border-border active:bg-surface-elevated'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={!valid || saving}
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
