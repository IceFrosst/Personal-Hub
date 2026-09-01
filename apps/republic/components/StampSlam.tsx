'use client'

export function StampSlam({
  text,
  color = 'stamp',
  rotate = -8,
  className = '',
  subtext,
  ghost = true,
}: {
  text: string
  color?: 'stamp' | 'approve' | 'pending'
  rotate?: number
  className?: string
  /** Optional smaller line inside the stamp (e.g. today's issue date). */
  subtext?: string
  /** The faint offset second strike — disable where it reads as clutter. */
  ghost?: boolean
}) {
  const colorClass =
    color === 'stamp'
      ? 'text-stamp border-stamp'
      : color === 'approve'
        ? 'text-approve border-approve'
        : 'text-[#d97706] border-[#d97706]'
  return (
    <div
      className={`relative inline-flex animate-stamp-slam select-none items-center justify-center border-[6px] px-6 py-3 font-stamp text-3xl font-bold uppercase tracking-widest ${colorClass} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-live="polite"
    >
      {/* Ink misregistration ghost — a faint, slightly offset second strike,
          mimicking a real rubber stamp pressed a hair off-alignment. Rides
          along with the parent's own scale/rotate animation for free (it's
          just a child), so no separate animation or reduced-motion handling
          is needed here. aria-hidden + duplicate text so screen readers only
          ever hear the stamp once. */}
      {ghost && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 select-none opacity-25"
          style={{ transform: 'translate(-46%, -54%)' }}
        >
          {text}
        </span>
      )}
      <span className="flex flex-col items-center leading-none">
        <span>{text}</span>
        {subtext && <span className="mt-1 text-[0.58em] tracking-[0.15em]">{subtext}</span>}
      </span>
    </div>
  )
}
