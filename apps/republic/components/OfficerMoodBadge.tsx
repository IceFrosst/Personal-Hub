'use client'

import { useEffect, useState } from 'react'
import { getOfficerMood, OFFICER_MOOD_PREFIX, type OfficerMood } from '@/lib/content'

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

  return (
    <div className="inline-flex items-center gap-1.5 rounded-sm border border-navy/30 bg-paper px-2 py-1 text-[10px] uppercase tracking-wide text-navy/80">
      <span aria-hidden className="tracking-tighter">{mood.dots}</span>
      <span>{OFFICER_MOOD_PREFIX} {mood.label}</span>
    </div>
  )
}
