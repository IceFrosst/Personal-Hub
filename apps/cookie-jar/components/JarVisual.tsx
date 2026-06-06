'use client'

import { useId, useMemo } from 'react'
import { COLORS, JAR, settle, seedFrom, jarHex, hexToRgba, darken } from '@/lib/jar'

// A glass jar filled with one ball per cookie. Transparent background so it
// floats on the page; `color` (a JAR_COLORS name) tints the glass + lid.
// `count` balls shrink to fit and gravity-settle; `seed` keeps the pile stable.
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
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${uid}-sphere`} cx="36%" cy="32%" r="68%">
          <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="0.34" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x={JAR.clip.x} y={JAR.clip.y} width={JAR.clip.w} height={JAR.clip.h} rx={JAR.clip.rx} />
        </clipPath>
      </defs>

      {/* lid */}
      <rect x="170" y="120" width="172" height="40" rx="14" fill={hex} />
      <rect x="160" y="152" width="192" height="22" rx="9" fill={darken(hex, 0.42)} />

      {/* glass body */}
      <rect x="156" y="176" width="200" height="232" rx="40" fill={hexToRgba(hex, 0.07)} stroke={hex} strokeWidth="11" />

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
