'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Hackathon, UserStatus } from '@/lib/types'
import type { ScoredHackathon } from '@/lib/scoring'
import type { DraftAnswer } from '@/lib/apply-kit'
import {
  IconX,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconSparkles,
  IconStar,
  IconSend,
  IconChecks,
  IconEyeOff,
} from '@tabler/icons-react'
import Link from 'next/link'

const STATUS_META: Array<{ status: UserStatus; label: string; icon: typeof IconStar; active: string }> = [
  { status: 'interested', label: 'Interested', icon: IconStar, active: 'text-blue border-blue/50 bg-blue/10' },
  { status: 'applying', label: 'Applying', icon: IconSend, active: 'text-amber border-amber/50 bg-amber/10' },
  { status: 'applied', label: 'Applied', icon: IconChecks, active: 'text-green border-green/50 bg-green/10' },
  { status: 'hidden', label: 'Hide', icon: IconEyeOff, active: 'text-text-muted border-border-focus bg-surface-elevated' },
]

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // clipboard denied — nothing sensible to do
        }
      }}
      className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs text-text-muted transition-colors duration-150 ease-out hover:border-border-focus"
      aria-label={label}
    >
      {copied ? <IconCheck size={16} stroke={1.5} className="text-green" /> : <IconCopy size={16} stroke={1.5} />}
    </button>
  )
}

export default function DetailSheet({
  hackathon: h,
  scored,
  status,
  notes: initialNotes,
  onSetStatus,
  onSaveNotes,
  onClose,
}: {
  hackathon: Hackathon
  scored: ScoredHackathon
  status: UserStatus | null
  notes: string
  onSetStatus: (status: UserStatus) => void
  onSaveNotes: (notes: string) => void
  onClose: () => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [notes, setNotes] = useState(initialNotes)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [questionsText, setQuestionsText] = useState('')
  const [answers, setAnswers] = useState<DraftAnswer[]>([])
  const [draftState, setDraftState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [draftError, setDraftError] = useState<string | null>(null)

  // Restore the last saved draft for this hackathon, if any.
  useEffect(() => {
    let cancelled = false
    supabase
      .schema('hackathon')
      .from('application_drafts')
      .select('questions, answers')
      .eq('hackathon_id', h.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          setQuestionsText((prev) => prev || (data.questions as string[]).join('\n'))
        }
        if (Array.isArray(data.answers)) {
          setAnswers(data.answers as DraftAnswer[])
        }
      })
    return () => {
      cancelled = true
    }
  }, [supabase, h.id])

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const updateNotes = (value: string) => {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => onSaveNotes(value), 700)
  }

  const draft = async () => {
    const questions = questionsText
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean)
    if (questions.length === 0) return
    setDraftState('loading')
    setDraftError(null)
    try {
      const res = await fetch('/api/apply-kit/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hackathon_id: h.id, questions }),
      })
      const body = await res.json()
      if (!res.ok) {
        setDraftState('error')
        setDraftError(
          body.error === 'profile_empty'
            ? 'profile_empty'
            : body.error === 'drafting_unavailable'
              ? 'The drafting models are unavailable right now — try again in a minute.'
              : `Drafting failed (${body.error ?? res.status}).`
        )
        return
      }
      setAnswers(body.answers as DraftAnswer[])
      setDraftState('idle')
    } catch {
      setDraftState('error')
      setDraftError('Network error — try again.')
    }
  }

  const place =
    h.format === 'online'
      ? 'Online'
      : [h.city ?? undefined, h.country ?? undefined].filter(Boolean).join(', ') ||
        h.location_raw ||
        'Location TBA'

  const meta: Array<[string, string | null]> = [
    ['Where', place],
    ['When', h.starts_at ? `${fmtDate(h.starts_at)}${h.ends_at && h.ends_at !== h.starts_at ? ` – ${fmtDate(h.ends_at)}` : ''}` : null],
    ['Register by', fmtDate(h.registration_deadline)],
    ['Prize pool', h.prize_pool],
    ['Source', h.source],
  ]

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={h.title}>
      <button
        className="absolute inset-0 h-full w-full bg-black/60"
        onClick={onClose}
        aria-label="Close"
        tabIndex={-1}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
          <div className="min-w-0">
            <h2 className="text-lg font-medium leading-snug">{h.title}</h2>
            <p className="mt-0.5 text-sm text-text-muted">
              Match score <span className="font-semibold text-text">{scored.score}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors duration-150 ease-out hover:text-text"
            aria-label="Close"
          >
            <IconX size={22} stroke={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 safe-b">
          <a
            href={h.url}
            target="_blank"
            rel="noreferrer"
            className="mb-4 flex min-h-11 items-center justify-center gap-2 rounded-md bg-purple px-4 font-medium text-white transition-colors duration-150 ease-out hover:bg-purple/90"
          >
            Open site
            <IconExternalLink size={18} stroke={1.5} />
          </a>

          <div className="mb-4 flex flex-col gap-1.5 rounded-2xl bg-surface-elevated p-3">
            {meta
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-sm">
                  <span className="text-text-muted">{k}</span>
                  <span className="text-right text-text">{v}</span>
                </div>
              ))}
          </div>

          {scored.reasons.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {scored.reasons.map((r) => (
                <span
                  key={r.label}
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    r.pts < 0 ? 'bg-coral/15 text-coral' : 'bg-surface-elevated text-text-muted'
                  }`}
                >
                  {r.label} {r.pts > 0 ? `+${r.pts}` : r.pts}
                </span>
              ))}
            </div>
          )}

          <div className="mb-4 flex gap-1.5">
            {STATUS_META.map(({ status: s, label, icon: Icon, active }) => (
              <button
                key={s}
                onClick={() => onSetStatus(s)}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md border px-1 text-xs transition-colors duration-150 ease-out ${
                  status === s ? active : 'border-border text-text-low hover:border-border-focus'
                }`}
              >
                <Icon size={16} stroke={1.5} />
                {label}
              </button>
            ))}
          </div>

          <label className="mb-4 flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => updateNotes(e.target.value)}
              placeholder="Deadlines, teammates, travel plans…"
              rows={2}
              className="rounded-md border border-border bg-bg px-3 py-2.5 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
            />
          </label>

          <section className="mb-4 rounded-2xl border border-purple/30 bg-purple/5 p-3">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-purple">
              <IconSparkles size={16} stroke={1.5} />
              Apply Kit
            </h3>
            <p className="mb-2 text-xs text-text-muted">
              Paste the application questions (one per line) — answers are drafted from your{' '}
              <Link href="/profile" className="text-purple underline">
                profile
              </Link>
              .
            </p>
            <textarea
              value={questionsText}
              onChange={(e) => setQuestionsText(e.target.value)}
              placeholder={'Why do you want to attend?\nTell us about a project you built.'}
              rows={3}
              className="mb-2 w-full rounded-md border border-border bg-bg px-3 py-2.5 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
            />
            <button
              onClick={draft}
              disabled={draftState === 'loading' || questionsText.trim() === ''}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-purple px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-purple/90 disabled:opacity-50"
            >
              <IconSparkles size={16} stroke={1.5} />
              {draftState === 'loading' ? 'Drafting…' : answers.length > 0 ? 'Redraft answers' : 'Draft answers'}
            </button>

            {draftError === 'profile_empty' ? (
              <p className="mt-2 text-xs text-amber">
                Your Apply Kit profile is empty —{' '}
                <Link href="/profile" className="underline">
                  fill it in first
                </Link>
                .
              </p>
            ) : draftError ? (
              <p className="mt-2 text-xs text-coral">{draftError}</p>
            ) : null}

            {answers.length > 0 && (
              <div className="mt-3 flex flex-col gap-3">
                {answers.map((a, i) => (
                  <div key={i} className="rounded-md bg-bg p-3">
                    {a.question && <p className="mb-1.5 text-xs text-text-muted">{a.question}</p>}
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap text-sm text-text">{a.answer}</p>
                      <CopyButton text={a.answer} label={`Copy answer ${i + 1}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {h.raw_description && (
            <section>
              <h3 className="mb-1 text-xs uppercase tracking-wide text-text-muted">
                About (auto-extracted)
              </h3>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-muted">
                {h.raw_description.slice(0, 2500)}
                {h.raw_description.length > 2500 ? '…' : ''}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
