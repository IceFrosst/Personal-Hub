'use client'

import type { Hackathon, UserStatus } from '@/lib/types'
import type { ScoredHackathon } from '@/lib/scoring'
import {
  IconExternalLink,
  IconStar,
  IconSend,
  IconChecks,
  IconEyeOff,
} from '@tabler/icons-react'

const STATUS_META: Array<{ status: UserStatus; label: string; icon: typeof IconStar; active: string }> = [
  { status: 'interested', label: 'Interested', icon: IconStar, active: 'text-blue border-blue/50 bg-blue/10' },
  { status: 'applying', label: 'Applying', icon: IconSend, active: 'text-amber border-amber/50 bg-amber/10' },
  { status: 'applied', label: 'Applied', icon: IconChecks, active: 'text-green border-green/50 bg-green/10' },
  { status: 'hidden', label: 'Hide', icon: IconEyeOff, active: 'text-text-muted border-border-focus bg-surface-elevated' },
]

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

export default function HackathonCard({
  hackathon: h,
  scored,
  status,
  onSetStatus,
}: {
  hackathon: Hackathon
  scored: ScoredHackathon
  status: UserStatus | null
  onSetStatus: (status: UserStatus) => void
}) {
  const dates = formatDates(h)
  const place =
    h.format === 'online'
      ? 'Online'
      : [h.city ?? undefined, h.country ?? undefined].filter(Boolean).join(', ') ||
        h.location_raw ||
        'Location TBA'

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={h.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-1.5 font-medium leading-snug text-text"
          >
            <span className="break-words">{h.title}</span>
            <IconExternalLink size={16} stroke={1.5} className="mt-0.5 shrink-0 text-text-low" />
          </a>
          <p className="mt-1 text-sm text-text-muted">
            {[place, dates, h.prize_pool ?? undefined].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${scoreColor(scored.score)}`}
          title="Match score"
        >
          {scored.score}
        </span>
      </div>

      {scored.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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

      <div className="flex gap-1.5">
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
    </article>
  )
}
