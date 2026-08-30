'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { getOfficerMood, OFFICER_MOOD_PREFIX, type OfficerMood } from '@/lib/content'

// How many of the 5 pips are filled — drives both the stamp seal's color and
// the coffee cup's fill level from the SAME source (mood.dots), so there's
// no separate "tier" field to keep in sync in lib/content.ts.
function moodLevel(mood: OfficerMood): number {
  return (mood.dots.match(/●/g) ?? []).length
}

function tierColorClass(level: number): string {
  if (level >= 4) return 'text-approve'
  if (level === 3) return 'text-navy'
  return 'text-stamp'
}

// A compact split-flap desk placard: a small rubber-stamped "seal" (colored
// by mood tier) + a split-flap text window (a quick 3D flip when the label
// first appears or changes) + a mirrored coffee cup as a glanceable
// redundancy channel (its fill level also tracks mood tier) — replaces the
// old plain "CURRENT OFFICER MOOD: <dots> <label>" text line entirely. The
// full prefix stays screen-reader-only so sighted users get the compact
// visual instead of a long text line.
export function OfficerMoodBadge() {
  // Server-rendered output can't know the visitor's local hour, and this page
  // is statically prerendered — computing the mood during the initial render
  // (even via a lazy useState initializer) would bake in the build-time hour
  // and then mismatch on every client hydration at a different hour. Render
  // nothing until a client-only effect fills it in.
  const [mood, setMood] = useState<OfficerMood | null>(null)
  const [flip, setFlip] = useState(false)
  const prevLabelRef = useRef<string | null>(null)
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clipId = useId()

  useEffect(() => {
    function tick() {
      const next = getOfficerMood()
      if (prevLabelRef.current !== next.label) {
        prevLabelRef.current = next.label
        setFlip(true)
        if (flipTimerRef.current) clearTimeout(flipTimerRef.current)
        flipTimerRef.current = setTimeout(() => setFlip(false), 450)
      }
      setMood(next)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => {
      clearInterval(id)
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current)
    }
  }, [])

  if (!mood) return null

  const level = moodLevel(mood)
  const tierClass = tierColorClass(level)
  const cupFill = (level / 5) * 10

  return (
    <div className="inline-flex -rotate-1 items-center gap-1.5 rounded-sm border border-navy/40 bg-paper-dark px-1.5 py-1 shadow-[1.5px_1.5px_0_rgba(26,42,74,0.12)]">
      {/* Rubber-stamped mood seal */}
      <svg viewBox="0 0 32 32" className={`h-5 w-5 shrink-0 rotate-[-8deg] ${tierClass}`} aria-hidden>
        <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="3 2" />
        <circle cx="16" cy="16" r="4" fill="currentColor" opacity="0.85" />
      </svg>

      {/* Split-flap label window */}
      <span className="officer-flap-window">
        <span
          className={`officer-flap-text block text-[9px] uppercase tracking-wide text-navy/80 ${flip ? 'animate-officer-flap' : ''}`}
        >
          <span className="sr-only">{OFFICER_MOOD_PREFIX} </span>
          {mood.label}
        </span>
      </span>

      {/* Mirrored coffee cup — glanceable redundancy channel, fill level
          tracks the same tier as the seal, so mood reads at a glance even
          without reading the label. */}
      <span className="flex shrink-0 flex-col items-center" aria-hidden>
        <svg viewBox="0 0 14 16" className={`h-3.5 w-3 ${tierClass}`}>
          <defs>
            <clipPath id={clipId}>
              <rect x="1" y="3" width="10" height="10" rx="1.2" />
            </clipPath>
          </defs>
          <path d="M11 5.5 Q14 5.5 14 8 Q14 10.5 11 10.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <rect x="1" y="3" width="10" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <rect x="1" y={13 - cupFill} width="10" height={cupFill} clipPath={`url(#${clipId})`} fill="currentColor" opacity="0.65" />
        </svg>
        {/* faint upside-down reflection, as if sitting on a glossy desk */}
        <svg viewBox="0 0 14 16" className={`-mt-0.5 h-1.5 w-3 scale-y-[-1] opacity-25 ${tierClass}`}>
          <rect x="1" y="3" width="10" height="10" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </span>
    </div>
  )
}
