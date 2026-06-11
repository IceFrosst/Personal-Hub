'use client'

import { IconCookie, IconX, IconReload } from '@tabler/icons-react'
import type { Cookie } from '@/lib/types'
import { formatEarned } from '@/lib/format'

export default function ReachInModal({
  cookie,
  drawKey,
  onAgain,
  canDrawAgain,
  onClose,
}: {
  cookie: Cookie
  drawKey: number
  onAgain: () => void
  canDrawAgain: boolean
  onClose: () => void
}) {
  const earned = formatEarned(cookie.earned_on)
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg px-6"
      style={{
        paddingTop: 'calc(0.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* soft coral glow behind the reveal */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-3/5"
        style={{ background: 'radial-gradient(60% 55% at 50% 28%, rgba(229,72,77,0.20), transparent 72%)' }}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="z-10 -mr-2 flex min-h-11 min-w-11 items-center justify-center self-end text-text-muted transition-colors active:text-text"
      >
        <IconX size={24} stroke={2} />
      </button>

      {/* drawn cookie — key replays the pop animation on every reach-in */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto py-2 text-center">
        <div key={drawKey} className="cookie-draw flex flex-col items-center">
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle at 38% 32%, #ec5d5e 0%, #e5484d 55%, #aa2429 100%)',
              boxShadow: '0 12px 40px -8px rgba(229,72,77,0.55), 0 0 0 1px rgba(255,255,255,0.1) inset',
            }}
          >
            <IconCookie size={56} stroke={1.5} color="#fff" />
          </span>

          <p className="mt-5 text-xs uppercase tracking-wide text-coral">You reached in and pulled out</p>
          <h2 className="mt-2 max-w-[330px] text-2xl font-semibold leading-snug text-text">
            {cookie.title}
          </h2>
          {cookie.description && (
            <p className="mt-3 max-w-[340px] whitespace-pre-line text-base leading-relaxed text-text-muted">
              {cookie.description}
            </p>
          )}
          {earned && <p className="mt-3 text-sm text-text-low">{earned}</p>}
        </div>
      </div>

      <div className="z-10 mx-auto flex w-full max-w-[340px] flex-col gap-2">
        <button
          type="button"
          onClick={onAgain}
          disabled={!canDrawAgain}
          className="reach-glow flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-coral text-base font-semibold text-white transition active:scale-[0.98] active:bg-coral-bright disabled:opacity-40 disabled:shadow-none"
        >
          <IconReload size={18} stroke={2} />
          Reach in again
        </button>
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
