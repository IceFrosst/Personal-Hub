'use client'

import type { Hackathon, UserStatus } from '@/lib/types'
import type { ScoredHackathon } from '@/lib/scoring'
import { durationHours } from '@/lib/scoring'
import { IconExternalLink, IconStar, IconChecks, IconEyeOff } from '@tabler/icons-react'

function formatDates(h: Hackathon): string | null {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  if (h.starts_at && h.ends_at && h.starts_at !== h.ends_at)
    return `${fmt(h.starts_at)} – ${fmt(h.ends_at)}`
  if (h.starts_at) return fmt(h.starts_at)
  return null
}

function scoreColor(score: number): string {
  if (score >= 60) return 'bg-purple text-white'
  if (score >= 30) return 'bg-purple/25 text-purple'
  return 'bg-surface-elevated text-text-muted'
}

function featureTags(h: Hackathon): string[] {
  const tags: string[] = []
  if (h.travel_covered === true) tags.push('Travel')
  if (h.accommodation_covered === true) tags.push('Accommodation')
  const hours = durationHours(h)
  if (hours !== null && hours > 24) tags.push('Multi-day')
  return tags
}

export default function HackathonCard({
  hackathon: h,
  scored,
  status,
  onSetStatus,
  onOpen,
}: {
  hackathon: Hackathon
  scored: ScoredHackathon
  status: UserStatus | null
  onSetStatus: (status: UserStatus) => void
  onOpen: () => void
}) {
  const dates = formatDates(h)
  const place =
    h.format === 'online'
      ? 'Online'
      : [h.city ?? undefined, h.country ?? undefined].filter(Boolean).join(', ') ||
        h.location_raw ||
        'Location TBA'
  const interested = status === 'interested'
  const tags = featureTags(h)

  return (
    <article className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="break-words font-medium leading-snug text-text">{h.title}</span>
          <span className="mt-1 block text-sm text-text-muted">
            {[place, dates, h.prize_pool ?? undefined].filter(Boolean).join(' · ')}
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${scoreColor(scored.score)}`}
            title="Match score"
          >
            {scored.score}
          </span>
          <a
            href={h.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-7 w-7 items-center justify-center text-text-low transition-colors duration-150 ease-out hover:text-text"
            aria-label={`Open ${h.title} site`}
          >
            <IconExternalLink size={16} stroke={1.5} />
          </a>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSetStatus('applied')}
          className={`flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors duration-150 ease-out ${
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
          className={`flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors duration-150 ease-out ${
            status === 'hidden'
              ? 'border-border-focus bg-surface-elevated text-text-muted'
              : 'border-border text-text-low hover:border-border-focus'
          }`}
        >
          <IconEyeOff size={14} stroke={1.5} />
          Hide
        </button>

        {/* Interested star — bottom-right of action row, away from score */}
        <button
          type="button"
          onClick={() => onSetStatus('interested')}
          className={`ml-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 ease-out ${
            interested
              ? 'bg-blue/15 text-blue'
              : 'text-text-low hover:bg-surface-elevated hover:text-text-muted'
          }`}
          aria-label={interested ? 'Remove interested' : 'Mark interested'}
          aria-pressed={interested}
        >
          <IconStar size={18} stroke={1.5} fill={interested ? 'currentColor' : 'none'} />
        </button>
      </div>
    </article>
  )
}
