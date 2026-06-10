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
        {/* inner curvature shading over the contents */}
        <path d={BODY} fill={`url(#${uid}-glass)`} opacity="0.5" />
      </g>

      {/* glass outline + rim */}
      <path d={BODY} fill="none" stroke={hex} strokeWidth="8" />
      <ellipse cx={CX} cy={RIM_Y} rx={RX} ry={RIM_RY} fill="none" stroke={hex} strokeWidth="8" />
      {/* left highlight streak */}
      <path d={`M${LX + 16},${RIM_Y + 18} L${LX + 16},${BASE_Y - 26}`} stroke="rgba(255,255,255,0.16)" strokeWidth="9" strokeLinecap="round" />

      {/* 3D lid */}
      <path d={LID} fill={`url(#${uid}-lid)`} />
      <ellipse cx={CX} cy={lidTop} rx={lidRx} ry={lidRy} fill={lighten(hex, 0.18)} />
      <ellipse cx={CX} cy={lidTop} rx={lidRx} ry={lidRy} fill="none" stroke={darken(hex, 0.15)} strokeWidth="2" />
      <ellipse cx={CX - lidRx * 0.4} cy={lidTop - 3} rx={lidRx * 0.3} ry={lidRy * 0.4} fill="rgba(255,255,255,0.22)" />
    </svg>
  )
}
