'use client'

import { useId, useMemo } from 'react'
import { COLORS, settle, seedFrom, jarHex, hexToRgba, darken, lighten } from '@/lib/jar'

// A 3D rounded-square jar (matches the app-icon shape) filled with one ball per
// cookie. Depth comes from an extruded back face offset up-right, so the top +
// right walls show as darker edges — it reads as a solid object, including when
// the shelf rotates it. Transparent background; `color` tints glass + lid.
//
// Geometry (512 viewBox, cx 256). Front glass face + a back copy offset by D.
const CX = 256
const BX = 148, BW = 200, B_TOP = 212, B_BOT = 412, BRX = 46 // front glass face
const DX = 17, DY = -17 // extrusion offset toward the back/upper-right
const LX = 152, LW = 192, L_TOP = 158, L_H = 50, LRX = 18 // lid front face

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
    <svg width={size} height={size} viewBox="92 126 320 320" className={className} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={hexToRgba(hex, 0.22)} />
          <stop offset="0.2" stopColor={hexToRgba(hex, 0.05)} />
          <stop offset="0.5" stopColor={hexToRgba(hex, 0.1)} />
          <stop offset="0.8" stopColor={hexToRgba(hex, 0.05)} />
          <stop offset="1" stopColor={hexToRgba(hex, 0.2)} />
        </linearGradient>
        <linearGradient id={`${uid}-lid`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(hex, 0.3)} />
          <stop offset="0.32" stopColor={hex} />
          <stop offset="0.7" stopColor={darken(hex, 0.12)} />
          <stop offset="1" stopColor={darken(hex, 0.38)} />
        </linearGradient>
        <radialGradient id={`${uid}-sphere`} cx="36%" cy="32%" r="68%">
          <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="0.34" stopColor="rgba(255,255,255,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.30)" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x={BX} y={B_TOP} width={BW} height={B_BOT - B_TOP} rx={BRX} />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx={CX + 4} cy={B_BOT + 8} rx={BW * 0.46} ry={13} fill="rgba(0,0,0,0.35)" />

      {/* extruded back of the body → the top + right glass walls */}
      <rect x={BX + DX} y={B_TOP + DY} width={BW} height={B_BOT - B_TOP} rx={BRX} fill={darken(hex, 0.52)} />

      {/* glass front face */}
      <rect x={BX} y={B_TOP} width={BW} height={B_BOT - B_TOP} rx={BRX} fill={`url(#${uid}-glass)`} />

      {/* one ball per cookie */}
      <g clipPath={`url(#${uid}-clip)`}>
        {balls.map((b, i) => (
          <g key={i}>
            <circle cx={b.x} cy={b.y} r={r} fill={COLORS[b.c]} />
            <circle cx={b.x} cy={b.y} r={r} fill={`url(#${uid}-sphere)`} />
          </g>
        ))}
        <rect x={BX} y={B_TOP} width={BW} height={B_BOT - B_TOP} rx={BRX} fill={`url(#${uid}-glass)`} opacity="0.45" />
      </g>

      {/* glass outline + left highlight */}
      <rect x={BX} y={B_TOP} width={BW} height={B_BOT - B_TOP} rx={BRX} fill="none" stroke={hex} strokeWidth="8" />
      <path d={`M${BX + 20},${B_TOP + 26} L${BX + 20},${B_BOT - 30}`} stroke="rgba(255,255,255,0.16)" strokeWidth="9" strokeLinecap="round" />

      {/* 3D lid: extruded back (top face) + front face */}
      <rect x={LX + DX} y={L_TOP + DY} width={LW} height={L_H} rx={LRX} fill={lighten(hex, 0.12)} />
      <rect x={LX} y={L_TOP} width={LW} height={L_H} rx={LRX} fill={`url(#${uid}-lid)`} />
      <rect x={LX + 18} y={L_TOP + 8} width={LW * 0.5} height={11} rx={5.5} fill="rgba(255,255,255,0.28)" />
    </svg>
  )
}
