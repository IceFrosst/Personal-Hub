'use client'

import { useEffect, useRef, useState } from 'react'
import {
  IconCalendar,
  IconMicrophone,
  IconMicrophoneFilled,
  IconPlus,
} from '@tabler/icons-react'
import type { Priority } from '@/lib/types'

type Props = {
  onAdd: (title: string, priority: Priority, dueDate: string | null) => Promise<void> | void
  disabled?: boolean
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

export default function AddTaskBar({ onAdd, disabled }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [adding, setAdding] = useState(false)
  const [speechAvailable, setSpeechAvailable] = useState(false)

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

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    const text = title.trim()
    if (!text || adding || disabled) return
    setAdding(true)
    try {
      await onAdd(text, priority, dueDate)
      setTitle('')
      setDueDate(null)
      setPriority('medium')
    } finally {
      setAdding(false)
    }
  }

  function openDatePicker() {
    const el = dateRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      el.showPicker()
    } else {
      el.focus()
      el.click()
    }
  }

  return (
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
          placeholder="What do you need to lock in?"
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
            {listening ? (
              <IconMicrophoneFilled size={20} />
            ) : (
              <IconMicrophone size={20} />
            )}
          </button>
        )}

        <button
          type="submit"
          aria-label="Add task"
          disabled={disabled || adding || !title.trim()}
          className="lock-in-gold-button min-h-11 min-w-11 flex items-center justify-center rounded-xl text-black active:scale-[0.97] transition-transform disabled:opacity-50"
        >
          <IconPlus size={22} stroke={2.6} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-lg bg-surface border border-border p-0.5">
          {PRIORITY_OPTIONS.map((opt) => {
            const active = priority === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-surface-elevated text-text' : 'text-text-muted'
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
    </form>
  )
}
