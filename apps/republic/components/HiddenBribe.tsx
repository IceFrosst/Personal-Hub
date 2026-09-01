'use client'

import { useState } from 'react'
import { BribeButton } from './BribeButton'
import { HIDDEN_BRIBE_ARIA_LABEL } from '@/lib/content'

// A hand-drawn pile of banknotes (SVG, no emoji) peeking out from behind the
// right edge of the viewport — as if someone left a stack of cash just past
// the corner of the officer's desk. Most of the pile sits off-screen (clipped
// by the global `overflow-x: hidden` on html/body), only a corner pokes in
// with a slow, quiet bob — the visitor has to SPOT it, so there's no glow or
// shimmer calling attention to it anymore. Tapping it slides a paper card in
// with the real BribeButton; offering the bribe gets the application DENIED
// (see BribeButton — it records the attempt, then routes to /denied).
// Mounted globally from PageShell so the visitor can screw up on any page.
// `prefers-reduced-motion` collapses the bob to a static frame via the
// existing global rule; the pile itself is always drawn, so it stays
// discoverable fully static.
export function HiddenBribe() {
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="fixed bottom-24 right-0 z-40">
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          aria-label={HIDDEN_BRIBE_ARIA_LABEL}
          className="animate-bribe-peek block min-h-11 min-w-11 py-2 pl-3"
        >
          <CashPile className="h-12 w-20 translate-x-8 rotate-[-22deg] drop-shadow-[1px_2px_1px_rgba(26,42,74,0.3)]" />
        </button>
      ) : (
        <div className="paper-card animate-fade-in mr-3 p-3">
          <BribeButton />
        </div>
      )}
    </div>
  )
}

// A small fanned stack of bills with a currency strap — drawn in muted
// "old banknote" greens that sit comfortably on the paper palette.
function CashPile({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 56" className={className} aria-hidden>
      {/* bottom loose bill */}
      <g transform="rotate(-9 40 40)">
        <rect x="8" y="30" width="58" height="20" fill="#7fa873" stroke="#3d5c39" strokeWidth="2" />
      </g>
      {/* middle bill */}
      <g transform="rotate(5 40 28)">
        <rect x="11" y="19" width="58" height="20" fill="#8fb983" stroke="#3d5c39" strokeWidth="2" />
        <rect x="15" y="23" width="50" height="12" fill="none" stroke="#e9f0e2" strokeWidth="1" strokeDasharray="2 2" />
      </g>
      {/* top bill with engraved border, seal, and currency strap */}
      <g transform="rotate(-5 40 18)">
        <rect x="9" y="7" width="58" height="20" fill="#9cc48f" stroke="#3d5c39" strokeWidth="2" />
        <rect x="13" y="11" width="50" height="12" fill="none" stroke="#e9f0e2" strokeWidth="1" />
        <circle cx="49" cy="17" r="5.5" fill="none" stroke="#3d5c39" strokeWidth="1.5" />
        <circle cx="49" cy="17" r="2" fill="#3d5c39" />
        <rect x="24" y="4" width="10" height="26" fill="#d9c98e" stroke="#3d5c39" strokeWidth="1.5" />
      </g>
    </svg>
  )
}
