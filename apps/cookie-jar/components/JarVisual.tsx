'use client'

import { useId, useMemo } from 'react'
import { COLORS, settle, seedFrom, jarHex, hexToRgba, darken, lighten } from '@/lib/jar'

// A 3D glass jar (a cylinder seen in slight perspective) filled with one ball
// per cookie. Drawn with real volume — elliptical rim/lid, curved base, and
// horizontal cylinder shading — so it still reads as a solid object when the
// shelf rotates it. Transparent background; `color` tints the glass + lid.
//
// Geometry (512 viewBox, cx 256): body radius 98, rim ellipse ry 26 at y202,
// base ellipse ry 22 at y408. The settle bounds in lib/jar.ts match.
const CX = 256, RX = 98
const RIM_Y = 194, RIM_RY = 26
const BASE_Y = 408, BASE_RY = 22
const LX = CX - RX, RXX = CX + RX // 158 .. 354

// closed cylinder silhouette: left side ↓, base front arc, right side ↑, rim back arc
const BODY = `M${LX},${RIM_Y} L${LX},${BASE_Y} A${RX},${BASE_RY} 0 0 0 ${RXX},${BASE_Y} L${RXX},${RIM_Y} A${RX},${RIM_RY} 0 0 1 ${LX},${RIM_Y} Z`

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

  // lid: a short cylinder cap, slightly wider than the body
  const lidRx = RX + 8, lidTop = 152, lidBot = 190, lidRy = 22
  const lidLX = CX - lidRx, lidRXX = CX + lidRx
  const LID = `M${lidLX},${lidTop} L${lidLX},${lidBot} A${lidRx},${lidRy} 0 0 0 ${lidRXX},${lidBot} L${lidRXX},${lidTop} A${lidRx},${lidRy} 0 0 1 ${lidLX},${lidTop} Z`

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/* horizontal cylinder shading: edges saturated, lit on the left */}
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={hexToRgba(hex, 0.26)} />
          <stop offset="0.22" stopColor={hexToRgba(hex, 0.06)} />
          <stop offset="0.5" stopColor={hexToRgba(hex, 0.12)} />
          <stop offset="0.82" stopColor={hexToRgba(hex, 0.05)} />
          <stop offset="1" stopColor={hexToRgba(hex, 0.3)} />
        </linearGradient>
        <linearGradient id={`${uid}-lid`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(hex, 0.34)} />
          <stop offset="0.32" stopColor={hex} />
          <stop offset="0.62" stopColor={darken(hex, 0.1)} />
          <stop offset="1" stopColor={darken(hex, 0.4)} />
        </linearGradient>
        <radialGradient id={`${uid}-sphere`} cx="36%" cy="32%" r="68%">
          <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="0.34" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* base shadow ellipse (grounds the jar) */}
      <ellipse cx={CX} cy={BASE_Y + 6} rx={RX * 0.92} ry={14} fill="rgba(0,0,0,0.35)" />

      {/* glass body — translucent cylinder */}
      <path d={BODY} fill={`url(#${uid}-glass)`} />

      {/* one ball per cookie, clipped to the glass */}
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
