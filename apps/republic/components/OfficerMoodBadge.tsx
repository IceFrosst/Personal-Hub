'use client'

import { useEffect, useState } from 'react'
import { getOfficerMood, OFFICER_MOOD_PREFIX, type OfficerMood } from '@/lib/content'

// How many of the 5 pips are filled — drives the meter and its tier color
// from the SAME source (mood.dots), so there's no separate "tier" field to
// keep in sync in lib/content.ts.
function moodLevel(mood: OfficerMood): number {
  return (mood.dots.match(/●/g) ?? []).length
}

function tierTextClass(level: number): string {
  if (level >= 4) return 'text-approve'
  if (level === 3) return 'text-navy'
  return 'text-stamp'
}

function tierFillClass(level: number): string {
  if (level >= 4) return 'bg-approve'
  if (level === 3) return 'bg-navy'
  return 'bg-stamp'
}

// A small, LEGIBLE desk placard: the "CURRENT OFFICER MOOD:" caption is
// visible (not sr-only), followed by a five-pip ink meter and the mood label
// itself in readable stamp type — both colored by tier (green = good,
// navy = neutral, red = bad). This replaced an earlier split-flap widget
// (seal + coffee-cup iconography) that read as decoration rather than
// information — per owner feedback you couldn't actually tell what mood was
// being communicated. No hidden metaphors now: caption, meter, label.
export function OfficerMoodBadge() {
  // Server-rendered output can't know the visitor's local hour, and this page
  // is statically prerendered — computing the mood during the initial render
  // (even via a lazy useState initializer) would bake in the build-time hour
  // and then mismatch on every client hydration at a different hour. Render
  // nothing until a client-only effect fills it in.
  const [mood, setMood] = useState<OfficerMood | null>(null)

  useEffect(() => {
    setMood(getOfficerMood())
    const id = setInterval(() => setMood(getOfficerMood()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!mood) return null

  const level = moodLevel(mood)

  return (
    <div className="inline-flex -rotate-1 flex-col items-center gap-1 border border-navy/40 bg-paper-dark px-3 py-1.5 shadow-[1.5px_1.5px_0_rgba(26,42,74,0.12)]">
      <span className="text-[8px] uppercase tracking-[0.25em] text-navy/60">{OFFICER_MOOD_PREFIX}</span>
      <div className="flex items-center gap-2">
        <span className="flex gap-[3px]" aria-hidden>
          {[1, 2, 3, 4, 5].map((pip) => (
            <span
              key={pip}
              className={`h-2 w-2 ${pip <= level ? tierFillClass(level) : 'border border-navy/40'}`}
            />
          ))}
        </span>
        <span className={`font-stamp text-[10px] uppercase tracking-wide ${tierTextClass(level)}`}>
          {mood.label}
        </span>
      </div>
    </div>
  )
}
