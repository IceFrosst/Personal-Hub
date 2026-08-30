'use client'

import { useState } from 'react'
import { BribeButton } from './BribeButton'
import { HIDDEN_BRIBE_ARIA_LABEL } from '@/lib/content'

// A 💵 tab peeking in from the right edge — collapsed, it sits mostly off
// the fixed viewport (only its left half is ever on-screen) with a slow
// bob, a golden glow, AND a moving highlight sweep (`.bribe-shimmer-sweep`,
// animated via `animate-bribe-shimmer`) layered on top, to catch the eye
// without stealing taps from anything else (it's parked away from primary
// CTAs, near the header/crest zone). Tapping it slides the whole tab into
// view and swaps in the real BribeButton (same component used elsewhere, so
// the interaction/copy/device counter are a single source of truth).
// `prefers-reduced-motion` is handled globally (app/globals.css collapses
// every animation here — bob, glow, and the shimmer sweep — to a single
// static frame) — the glow's own 0%/100% frame is non-zero and the solid
// bordered circle + emoji are always there regardless, so it stays visible
// and discoverable even fully static.
export function HiddenBribe() {
  const [revealed, setRevealed] = useState(false)

  return (
    <div
      className={`fixed top-24 z-40 transition-[right] duration-500 ease-out ${
        revealed ? 'right-3' : 'right-[-22px]'
      }`}
    >
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          aria-label={HIDDEN_BRIBE_ARIA_LABEL}
          className="animate-bribe-peek relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-navy bg-paper text-2xl"
        >
          <span className="bribe-shimmer-sweep animate-bribe-shimmer" aria-hidden />
          <span className="relative" aria-hidden>
            💵
          </span>
        </button>
      ) : (
        <div className="paper-card animate-fade-in p-3">
          <BribeButton />
        </div>
      )}
    </div>
  )
}
