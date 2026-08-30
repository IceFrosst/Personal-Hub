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
      className={`inline-block animate-stamp-slam select-none border-[6px] px-6 py-3 font-stamp text-3xl font-bold uppercase tracking-widest ${colorClass} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-live="polite"
    >
      {text}
    </div>
  )
}
