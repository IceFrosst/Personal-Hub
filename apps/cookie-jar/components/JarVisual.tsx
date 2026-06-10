'use client'

import { useId, useMemo } from 'react'
import { COLORS, settle, seedFrom, jarHex, hexToRgba, darken } from '@/lib/jar'

// The jar from the app logo (scripts/gen-icons.mjs), filled with one ball per
// cookie: flat rounded-square glass, chunky outline, lid + darker band, glass
// highlight. Transparent background; `color` tints glass + lid. `count` balls
// shrink to fit and gravity-settle; `seed` keeps the pile stable per jar.
export default function JarVisual({
  count,
  seed = 'jar',
  color = 'coral',
  size = 240,
  className,
}: {
  count: number
  seed?: string
  color?: string
  size?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const { balls, r } = useMemo(() => settle(count, seedFrom(seed)), [count, seed])
  const hex = jarHex(color)

  return (
    <svg width={size} height={size} viewBox="126 100 260 320" className={className} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${uid}-sphere`} cx="36%" cy="32%" r="68%">
          <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="0.34" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x="162" y="182" width="188" height="220" rx="36" />
        </clipPath>
      </defs>

      {/* lid + band */}
      <rect x="170" y="120" width="172" height="40" rx="14" fill={hex} />
      <rect x="160" y="152" width="192" height="22" rx="9" fill={darken(hex, 0.4)} />

      {/* glass body */}
      <rect x="156" y="176" width="200" height="232" rx="40" fill={hexToRgba(hex, 0.08)} stroke={hex} strokeWidth="11" />

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
