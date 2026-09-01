import { CREST_ARIA_LABEL } from '@/lib/content'

// Emblem of the Dictatorship of Ignas Border Control.
//
// Concept: a round rubber-stamp seal (double navy ring, the ink of an official
// desk stamp) enclosing a checkpoint boom gate — post, hinge, counterweight, and
// a red-and-paper striped barrier arm — standing on a solid navy ground line.
// The arm is neither open nor closed: it hangs at 22°, the border permanently
// "being processed". That is the whole joke, played straight — no shield, no
// eagle, no laurel, no icon collage; one government artifact, big flat shapes.
//
// Geometry is sized to survive the landing's h-10 w-10 (40px) render and the
// favicon: every stroke is ≥2.5 viewBox units (≥1px at 40px) and the stripes are
// 10 units wide. public/favicon.svg carries the exact same paths and viewBox
// (plus an opaque paper square behind them for tab/PWA-icon use) — keep the two
// in lockstep when editing either.
export function Crest({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={CREST_ARIA_LABEL}>
      {/* stamp seal rings */}
      <circle cx="50" cy="50" r="46" fill="#f4f0e8" stroke="#1a2a4a" strokeWidth="4" />
      <circle cx="50" cy="50" r="39" fill="none" stroke="#1a2a4a" strokeWidth="2.5" />
      {/* ground */}
      <path d="M18.4 72 A38.5 38.5 0 0 0 81.6 72 Z" fill="#1a2a4a" />
      {/* gate post */}
      <rect x="24.5" y="40" width="8" height="32" fill="#1a2a4a" />
      {/* barrier arm: counterweight + striped boom, hinged at (28.5, 40) */}
      <g transform="rotate(-22 28.5 40)">
        <rect x="16.5" y="35" width="12" height="10" fill="#1a2a4a" />
        <rect x="28.5" y="35" width="42" height="10" fill="#f4f0e8" />
        <rect x="28.5" y="35" width="10" height="10" fill="#c0392b" />
        <rect x="44.5" y="35" width="10" height="10" fill="#c0392b" />
        <rect x="60.5" y="35" width="10" height="10" fill="#c0392b" />
        <rect x="16.5" y="35" width="54" height="10" fill="none" stroke="#1a2a4a" strokeWidth="2.5" />
      </g>
      {/* hinge */}
      <circle cx="28.5" cy="40" r="5.5" fill="#1a2a4a" />
    </svg>
  )
}
