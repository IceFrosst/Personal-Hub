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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 px-6"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 flex min-h-11 min-w-11 items-center justify-center text-text-muted transition-colors active:text-text"
        style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        <IconX size={24} stroke={2} />
      </button>

      {/* key forces the draw animation to replay on every reach-in */}
      <div key={drawKey} className="cookie-draw flex flex-col items-center text-center">
        <span
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{
            background: 'radial-gradient(circle at 38% 32%, #ec5d5e 0%, #e5484d 55%, #aa2429 100%)',
            boxShadow: '0 12px 40px -8px rgba(229,72,77,0.55), 0 0 0 1px rgba(255,255,255,0.1) inset',
          }}
        >
          <IconCookie size={64} stroke={1.5} color="#fff" />
        </span>

        <h2 className="mt-6 max-w-[320px] text-2xl font-semibold leading-snug text-text">
          {cookie.title}
        </h2>
        {cookie.description && (
          <p className="mt-3 max-w-[340px] text-base leading-relaxed text-text-muted">
            {cookie.description}
          </p>
        )}
        {earned && <p className="mt-3 text-sm text-text-low">{earned}</p>}
      </div>

      <div className="mt-10 flex w-full max-w-[340px] flex-col gap-2.5">
        <button
          type="button"
          onClick={onAgain}
          disabled={!canDrawAgain}
          className="reach-glow flex min-h-12 items-center justify-center gap-2 rounded-xl bg-coral font-semibold text-white transition active:scale-[0.98] active:bg-coral-bright disabled:opacity-40 disabled:shadow-none"
        >
          <IconReload size={18} stroke={2} />
          Reach in again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 rounded-xl text-text-muted transition-colors active:text-text"
        >
          Close
        </button>
      </div>
    </div>
  )
}
