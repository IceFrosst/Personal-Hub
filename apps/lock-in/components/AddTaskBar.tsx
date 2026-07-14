'use client'

import { useEffect, useRef, useState } from 'react'
import {
  IconCalendar,
  IconClock,
  IconMicrophone,
  IconMicrophoneFilled,
  IconPlus,
  IconRepeat,
  IconTag,
} from '@tabler/icons-react'
import TimeWheel from '@/components/TimeWheel'
import {
  EVERY_DAY,
  TASK_CATEGORIES,
  WEEKDAY_LABELS,
  type Priority,
  type TaskCategory,
  type TimeMode,
} from '@/lib/types'

export type RecurringDraft = {
  weekdays: number[]
  timeMode: TimeMode
  fixedTime: string | null
  durationMinutes: number
}

type Props = {
  onAdd: (
    title: string,
    priority: Priority,
    dueDate: string | null,
    category: TaskCategory | null
  ) => Promise<void> | void
  onAddRecurring: (title: string, draft: RecurringDraft) => Promise<void> | void
  disabled?: boolean
}

const PRIORITY_OPTIONS: { value: Priority; label: string; dot: string }[] = [
  { value: 'low', label: 'Low', dot: 'bg-prio-low' },
  { value: 'medium', label: 'Med', dot: 'bg-prio-medium' },
  { value: 'high', label: 'High', dot: 'bg-prio-high' },
]

const onlyDigits = (s: string, max = 2) => s.replace(/\D/g, '').slice(0, max)

function formatChip(value: string | null): string {
  if (!value) return 'Date'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = value.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) {
    return target.toLocaleDateString(undefined, { weekday: 'short' })
  }
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type SpeechRecognitionInstance = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

export default function AddTaskBar({ onAdd, onAddRecurring, disabled }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [category, setCategory] = useState<TaskCategory | null>(null)
  const [showTagModal, setShowTagModal] = useState(false)
  const [listening, setListening] = useState(false)
  const [adding, setAdding] = useState(false)
  const [speechAvailable, setSpeechAvailable] = useState(false)

  // Recurring mode
  const [recurring, setRecurring] = useState(false)
  const [dayMode, setDayMode] = useState<'everyday' | 'custom'>('everyday')
  const [weekdays, setWeekdays] = useState<number[]>(EVERY_DAY)
  const [timeMode, setTimeMode] = useState<TimeMode>('flexible')
  const [fixedTime, setFixedTime] = useState('09:00')
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [durHours, setDurHours] = useState('0')
  const [durMins, setDurMins] = useState('30')

  const dateRef = useRef<HTMLInputElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [title])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (Ctor) setSpeechAvailable(true)
  }, [])

  function startListening() {
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor
      webkitSpeechRecognition?: SpeechRecognitionCtor
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) return

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }

    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      if (transcript) {
        setTitle((prev) => (prev ? prev + ' ' + transcript : transcript))
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      setListening(false)
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop()
    } catch {}
    setListening(false)
  }

  function toggleWeekday(iso: number) {
    setWeekdays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
    )
  }

  const cat = category ? TASK_CATEGORIES.find((c) => c.value === category) : null
  const totalDuration = (parseInt(durHours, 10) || 0) * 60 + (parseInt(durMins, 10) || 0)
  const recurringValid = recurring
    ? (dayMode === 'everyday' || weekdays.length > 0) && totalDuration > 0
    : true

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    const text = title.trim()
    if (!text || adding || disabled || !recurringValid) return
    setAdding(true)
    try {
      if (recurring) {
        await onAddRecurring(text, {
          weekdays: dayMode === 'everyday' ? EVERY_DAY : [...weekdays].sort((a, b) => a - b),
          timeMode,
          fixedTime: timeMode === 'fixed' ? fixedTime : null,
          durationMinutes: totalDuration,
        })
      } else {
        await onAdd(text, priority, dueDate, category)
        setDueDate(null)
        setPriority('medium')
        setCategory(null)
      }
      setTitle('')
    } finally {
      setAdding(false)
    }
  }

  function openDatePicker() {
    const el = dateRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') el.showPicker()
    else {
      el.focus()
      el.click()
    }
  }

  return (
    <>
    <form onSubmit={submit} className="w-full flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <textarea
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder={recurring ? 'Name your routine…' : 'What do you need to lock in?'}
          className="flex-1 min-w-0 min-h-11 max-h-40 py-2.5 px-3 rounded-xl bg-surface border border-border focus:border-border-focus outline-none text-base text-text placeholder:text-text-low transition-colors resize-none leading-snug"
          disabled={disabled || adding}
        />

        {speechAvailable && (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            aria-label={listening ? 'Stop listening' : 'Voice input'}
            className={`min-h-11 min-w-11 flex items-center justify-center rounded-xl border transition-colors ${
              listening
                ? 'bg-priority-high/15 border-priority-high text-priority-high'
                : 'bg-surface border-border text-text-muted active:bg-surface-elevated'
            }`}
          >
            {listening ? <IconMicrophoneFilled size={20} /> : <IconMicrophone size={20} />}
          </button>
        )}

        <button
          type="submit"
          aria-label="Add task"
          disabled={disabled || adding || !title.trim() || !recurringValid}
          className="lock-in-gold-button min-h-11 min-w-11 flex items-center justify-center rounded-xl text-black active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          <IconPlus size={22} stroke={2.6} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setRecurring((r) => !r)}
          aria-label="Recurring task"
          aria-pressed={recurring}
          className={`min-h-9 min-w-9 flex items-center justify-center rounded-lg border transition-colors ${
            recurring
              ? 'bg-gold/15 border-gold/50 text-gold'
              : 'bg-surface border-border text-text-muted active:bg-surface-elevated'
          }`}
        >
          <IconRepeat size={16} />
        </button>

        {!recurring ? (
          <>
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

            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              className={`flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg border text-xs transition-colors ${
                cat ? '' : 'bg-surface border-border text-text-muted active:bg-surface-elevated'
              }`}
              style={
                cat
                  ? { color: cat.color, borderColor: `${cat.color}66`, backgroundColor: `${cat.color}1a` }
                  : undefined
              }
            >
              <IconTag size={14} />
              {cat ? cat.label : 'Tag'}
            </button>
          </>
        ) : (
          <>
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

            {timeMode === 'fixed' && (
              <button
                type="button"
                onClick={() => setShowTimeModal(true)}
                className="flex items-center gap-1.5 min-h-9 px-2.5 rounded-lg border bg-surface border-border text-text text-xs active:bg-surface-elevated transition-colors"
              >
                <IconClock size={14} className="text-text-muted" />
                <span className="tabular-nums font-medium">{fixedTime}</span>
              </button>
            )}

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
          </>
        )}
      </div>

      {recurring && (
        <div className="flex items-center gap-2 flex-wrap">
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
                    // Entering Custom starts from a clean slate — no days checked.
                    if (val === 'custom' && dayMode !== 'custom') setWeekdays([])
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
      )}
    </form>

    {showTimeModal && (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
        onClick={() => setShowTimeModal(false)}
      >
        <div
          className="w-full max-w-[280px] bg-surface-elevated rounded-2xl border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs uppercase tracking-wide text-text-low text-center mb-3">
            Set time
          </p>
          <div className="flex justify-center">
            <TimeWheel value={fixedTime} onChange={setFixedTime} />
          </div>
          <button
            type="button"
            onClick={() => setShowTimeModal(false)}
            className="lock-in-gold-button mt-4 w-full min-h-11 rounded-xl text-black font-semibold active:scale-[0.99] transition-transform"
          >
            Done
          </button>
        </div>
      </div>
    )}

    {showTagModal && (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-6"
        onClick={() => setShowTagModal(false)}
      >
        <div
          className="w-full max-w-[280px] bg-surface-elevated rounded-2xl border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.5)] p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs uppercase tracking-wide text-text-low text-center mb-3">Tag</p>
          <div className="grid grid-cols-2 gap-2">
            {TASK_CATEGORIES.map((c) => {
              const active = category === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCategory(c.value)
                    setShowTagModal(false)
                  }}
                  className="min-h-11 rounded-xl border text-sm font-medium transition-colors"
                  style={{
                    color: c.color,
                    borderColor: active ? c.color : `${c.color}66`,
                    backgroundColor: active ? `${c.color}26` : `${c.color}12`,
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setCategory(null)
              setShowTagModal(false)
            }}
            className="mt-3 w-full min-h-11 rounded-xl text-text-muted active:text-text transition-colors text-sm"
          >
            No tag
          </button>
        </div>
      </div>
    )}
    </>
  )
}
