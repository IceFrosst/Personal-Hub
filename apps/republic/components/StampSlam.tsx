'use client'

export function StampSlam({
  text,
  color = 'stamp',
  rotate = -8,
  className = '',
}: {
  text: string
  color?: 'stamp' | 'approve'
  rotate?: number
  className?: string
}) {
  const colorClass = color === 'stamp' ? 'text-stamp border-stamp' : 'text-approve border-approve'
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
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 select-none opacity-25"
        style={{ transform: 'translate(-46%, -54%)' }}
      >
        {text}
      </span>
      <span>{text}</span>
    </div>
  )
}
