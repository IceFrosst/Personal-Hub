'use client'

import { useEffect, useRef, useState } from 'react'
import type { Hackathon, UserStatus } from '@/lib/types'
import type { ScoredHackathon } from '@/lib/scoring'
import {
  IconX,
  IconExternalLink,
  IconStar,
  IconChecks,
  IconEyeOff,
} from '@tabler/icons-react'

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function travelSummary(h: Hackathon): string | null {
  if (h.travel_covered === false || h.travel_scope === 'none') return 'Not covered'
  const parts: string[] = []
  if (h.travel_scope) parts.push(h.travel_scope)
  if (h.travel_regions?.length) parts.push(h.travel_regions.join(', '))
  if (h.travel_cap) parts.push(h.travel_cap)
  if (parts.length > 0) return parts.join(' · ')
  if (h.travel_covered === true) return 'Mentioned (scope unclear)'
  return null
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
  const [notes, setNotes] = useState(initialNotes)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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


  const place =
    h.format === 'online'
      ? 'Online'
      : [h.city ?? undefined, h.country ?? undefined].filter(Boolean).join(', ') ||
        h.location_raw ||
        'Location TBA'

  const interested = status === 'interested'

  const meta: Array<[string, string | null]> = [
    ['Where', place],
    [
      'When',
      h.starts_at
        ? `${fmtDate(h.starts_at)}${h.ends_at && h.ends_at !== h.starts_at ? ` – ${fmtDate(h.ends_at)}` : ''}`
        : null,
    ],
    ['Register by', fmtDate(h.registration_deadline)],
    ['Travel', travelSummary(h)],
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
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onSetStatus('interested')}
              className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-150 ease-out ${
                interested ? 'text-blue' : 'text-text-muted hover:text-text'
              }`}
              aria-label={interested ? 'Remove interested' : 'Mark interested'}
              aria-pressed={interested}
            >
              <IconStar size={22} stroke={1.5} fill={interested ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted transition-colors duration-150 ease-out hover:text-text"
              aria-label="Close"
            >
              <IconX size={22} stroke={1.5} />
            </button>
          </div>
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
            {h.travel_notes && (
              <p className="mt-1 border-t border-border pt-2 text-xs text-text-muted">
                {h.travel_notes}
              </p>
            )}
          </div>

          <div className="mb-4 flex gap-1.5">
            <button
              type="button"
              onClick={() => onSetStatus('applied')}
              className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs transition-colors duration-150 ease-out ${
                status === 'applied'
                  ? 'border-green/50 bg-green/10 text-green'
                  : 'border-border text-text-low hover:border-border-focus'
              }`}
            >
              <IconChecks size={14} stroke={1.5} />
              Applied
            </button>
            <button
              type="button"
              onClick={() => onSetStatus('hidden')}
              className={`flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs transition-colors duration-150 ease-out ${
                status === 'hidden'
                  ? 'border-border-focus bg-surface-elevated text-text-muted'
                  : 'border-border text-text-low hover:border-border-focus'
              }`}
            >
              <IconEyeOff size={14} stroke={1.5} />
              Hide
            </button>
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
