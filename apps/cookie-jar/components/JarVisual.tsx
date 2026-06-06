'use client'

import { useId, useMemo } from 'react'
import { COLORS, JAR, settle, seedFrom } from '@/lib/jar'

// A glass jar filled with one ball per cookie. `count` balls shrink to fit and
// settle naturally; `seed` (the jar id) keeps each jar's pile stable + distinct.
export default function JarVisual({
  count,
  seed = 'jar',
  size = 240,
  className,
}: {
  count: number
  seed?: string
  size?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const { balls, r } = useMemo(() => settle(count, seedFrom(seed)), [count, seed])

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="38%" r="75%">
          <stop offset="0" stopColor="#242427" />
          <stop offset="1" stopColor="#161618" />
        </radialGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="rgba(229,72,77,0.30)" />
          <stop offset="1" stopColor="rgba(229,72,77,0)" />
        </radialGradient>
        <radialGradient id={`${uid}-sphere`} cx="36%" cy="32%" r="68%">
          <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="0.34" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x={JAR.clip.x} y={JAR.clip.y} width={JAR.clip.w} height={JAR.clip.h} rx={JAR.clip.rx} />
        </clipPath>
      </defs>

      <rect width="512" height="512" rx="112" fill={`url(#${uid}-bg)`} />
      <circle cx="256" cy="300" r="190" fill={`url(#${uid}-glow)`} />

      {/* lid */}
      <rect x="170" y="120" width="172" height="40" rx="14" fill="#e5484d" />
      <rect x="160" y="152" width="192" height="22" rx="9" fill="#aa2429" />

      {/* glass body */}
      <rect x="156" y="176" width="200" height="232" rx="40" fill="rgba(229,72,77,0.08)" stroke="#e5484d" strokeWidth="11" />

      {/* one ball per cookie */}
      <g clipPath={`url(#${uid}-clip)`}>
        {balls.map((b, i) => (
          <g key={i}>
            <circle cx={b.x} cy={b.y} r={r} fill={COLORS[b.c]} />
            <circle cx={b.x} cy={b.y} r={r} fill={`url(#${uid}-sphere)`} />
          </g>
        ))}
      </g>

      {/* glass highlight */}
      <rect x="180" y="200" width="20" height="150" rx="10" fill="rgba(255,255,255,0.10)" />
    </svg>
  )
}
