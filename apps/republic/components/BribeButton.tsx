'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordBribe, getBribeCount } from '@/lib/api'
import { BRIBE } from '@/lib/content'
import { playBeep } from '@/lib/sound'

// Offering the bribe is a trap: the attempt is recorded (device counter +
// best-effort backend stub, unchanged), the response line reveals that the
// application is DENIED, and after a beat the visitor is shipped to /denied
// with `?via=bribe` so the denial page can print the bribe-specific reason
// (see app/denied/page.tsx + BRIBE_DENIAL_REASON in lib/content.ts).
export function BribeButton() {
  const router = useRouter()
  const [count, setCount] = useState<number | null>(null)
  const [justOffered, setJustOffered] = useState(false)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  async function handleClick() {
    if (justOffered) return
    playBeep()
    const next = await recordBribe()
    setCount(next)
    setJustOffered(true)
    // Let the applicant read their mistake before the stamp comes down.
    redirectTimerRef.current = setTimeout(() => {
      router.push('/denied?via=bribe')
    }, 1800)
  }

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={justOffered}
        className="rounded-sm border-2 border-navy bg-paper px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-navy transition-colors hover:bg-navy hover:text-paper disabled:pointer-events-none disabled:opacity-70"
      >
        {BRIBE.button}
      </button>
      {justOffered && (
        <p className="max-w-[240px] text-[10px] uppercase leading-snug text-stamp">
          {BRIBE.response} ({count ?? getBribeCount()} {BRIBE.countSuffix})
        </p>
      )}
    </div>
  )
}
