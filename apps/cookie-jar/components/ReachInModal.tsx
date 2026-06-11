'use client'

import { IconX, IconReload, IconMoodSmile } from '@tabler/icons-react'
import type { Cookie } from '@/lib/types'
import { formatEarned } from '@/lib/format'

// A chocolate-chip cookie drawn to read like the real thing (🍪, but ours):
// warm radial base, irregular chips with a glint, crumb speckles.
function CookieGraphic({ size = 104, dim = false }: { size?: number; dim?: boolean }) {
  const chips: [number, number, number, number][] = [
    // x, y, r, rotation
    [31, 33, 6.5, -15],
    [53, 24, 5, 20],
    [67, 39, 6, 8],
    [39, 51, 7, -30],
    [59, 57, 6.5, 14],
    [30, 64, 5, 40],
    [70, 63, 4.5, -10],
    [48, 73, 5, 25],
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" style={dim ? { opacity: 0.45, filter: 'grayscale(0.4)' } : undefined}>
      <defs>
        <radialGradient id="cookie-base" cx="38%" cy="32%" r="78%">
          <stop offset="0" stopColor="#f2b35e" />
          <stop offset="0.6" stopColor="#dd9140" />
          <stop offset="1" stopColor="#bf752c" />
        </radialGradient>
      </defs>
      {/* cookie body — slightly irregular edge via overlapping lobes */}
      <circle cx="48" cy="48" r="43" fill="url(#cookie-base)" />
      <circle cx="40" cy="42" r="40" fill="url(#cookie-base)" opacity="0.6" />
      <circle cx="56" cy="54" r="40" fill="url(#cookie-base)" opacity="0.6" />
      <circle cx="48" cy="48" r="43" fill="none" stroke="#9c5d1d" strokeOpacity="0.5" strokeWidth="2.5" />
      {/* chocolate chips */}
      {chips.map(([x, y, r, rot], i) => (
        <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.82} fill="#4a2a10" />
          <ellipse cx={x - r * 0.3} cy={y - r * 0.35} rx={r * 0.32} ry={r * 0.2} fill="rgba(255,255,255,0.14)" />
        </g>
      ))}
      {/* crumb speckles */}
      <circle cx="44" cy="34" r="1.6" fill="rgba(255,255,255,0.16)" />
      <circle cx="62" cy="48" r="1.4" fill="rgba(255,255,255,0.14)" />
      <circle cx="36" cy="58" r="1.5" fill="rgba(94,52,16,0.5)" />
      <circle cx="52" cy="64" r="1.3" fill="rgba(94,52,16,0.5)" />
      <circle cx="56" cy="38" r="1.4" fill="rgba(94,52,16,0.45)" />
    </svg>
  )
}

export default function ReachInModal({
  cookie,
  drawKey,
  onAgain,
  canDrawAgain,
  onClose,
}: {
  cookie: Cookie | null // null = every cookie already grabbed this session
  drawKey: number
  onAgain: () => void
  canDrawAgain: boolean
  onClose: () => void
}) {
  const earned = cookie ? formatEarned(cookie.earned_on) : null
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg px-6"
      style={{
        paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* warm glow behind the cookie */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-3/5"
        style={{ background: 'radial-gradient(60% 55% at 50% 28%, rgba(221,145,64,0.16), transparent 72%)' }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="z-10 -mr-2 flex min-h-11 min-w-11 items-center justify-center self-end text-text-muted transition-colors active:text-text"
      >
        <IconX size={24} stroke={2} />
      </button>

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto py-2 text-center">
        {cookie ? (
          // key replays the pop animation on every grab
          <div key={drawKey} className="cookie-draw flex flex-col items-center">
            <span
              className="rounded-full"
              style={{ boxShadow: '0 14px 44px -10px rgba(221,145,64,0.5)' }}
            >
              <CookieGraphic />
            </span>
            <h2 className="mt-6 max-w-[330px] text-2xl font-semibold leading-snug text-text">
              {cookie.title}
            </h2>
            {cookie.description && (
              <p className="mt-3 max-w-[340px] whitespace-pre-line text-base leading-relaxed text-text-muted">
                {cookie.description}
              </p>
            )}
            {earned && <p className="mt-3 text-sm text-text-low">{earned}</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <CookieGraphic dim />
            <h2 className="mt-6 max-w-[300px] text-xl font-semibold leading-snug text-text">
              You&apos;ve grabbed every cookie in this jar
            </h2>
            <p className="mt-3 max-w-[300px] text-base leading-relaxed text-text-muted">
              Close the app and open it fresh to dig in again.
            </p>
          </div>
        )}
      </div>

      <div className="z-10 mx-auto flex w-full max-w-[340px] flex-col gap-2">
        {cookie && (
          <>
            <button
              type="button"
              onClick={onAgain}
              disabled={!canDrawAgain}
              className="reach-glow flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-coral text-base font-semibold text-white transition active:scale-[0.98] active:bg-coral-bright disabled:opacity-40 disabled:shadow-none"
            >
              <IconReload size={18} stroke={2} />
              Grab another
            </button>
            {!canDrawAgain && (
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-text-low">
                <IconMoodSmile size={14} stroke={1.5} />
                That&apos;s every cookie — open the app fresh to grab them again
              </p>
            )}
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 rounded-2xl font-medium text-text-muted transition-colors active:text-text"
        >
          Close
        </button>
      </div>
    </div>
  )
}
