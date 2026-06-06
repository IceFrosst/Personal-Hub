// Shared jar rendering: a glass jar (matching the app icon) filled with one ball
// per cookie. Balls shrink to fit so the count is always exact, then settle with
// a small 2D gravity simulation so they pile naturally against the walls/floor.
// All coordinates live in the icon's 512×512 viewBox.

// cookie (ball) colours — the contents of every jar
export const COLORS = ['#e5484d', '#ffb224', '#12a594', '#8e4ec6', '#0090ff', '#d6409f', '#30a46c']

// jar glass/lid colours — what "change the jar colour" picks from. Name → hex,
// stored as the name in jars.color (additive, defaults to 'coral').
export const JAR_COLORS: { name: string; hex: string }[] = [
  { name: 'coral', hex: '#e5484d' },
  { name: 'amber', hex: '#ffb224' },
  { name: 'green', hex: '#30a46c' },
  { name: 'teal', hex: '#12a594' },
  { name: 'blue', hex: '#0090ff' },
  { name: 'purple', hex: '#8e4ec6' },
  { name: 'pink', hex: '#d6409f' },
]

export function jarHex(color: string | null | undefined): string {
  return JAR_COLORS.find((c) => c.name === color)?.hex ?? JAR_COLORS[0].hex
}

export function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

// mix a hex toward black by f (0..1) — used for cylinder side-shading
export function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - f))
  const g = Math.round(((n >> 8) & 255) * (1 - f))
  const b = Math.round((n & 255) * (1 - f))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// mix a hex toward white by f (0..1) — the lit side / lid top
export function lighten(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * f)
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * f)
  const b = Math.round((n & 255) + (255 - (n & 255)) * f)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

// jar interior bounds for the ball settle (a cylinder seen in perspective —
// JarVisual draws the matching glass). cx 256, radius ~98.
export const JAR = { xL: 158, xR: 354, yF: 400, yTop: 202, cr: 44 }
const MAX_BALLS = 120 // perf bound; far beyond any realistic jar

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFrom(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// ball radius so `n` balls fill a pleasant fraction of the jar; capped so a
// single cookie is a chunky marble, not a giant.
export function ballRadius(n: number) {
  if (n <= 0) return 0
  const area = (JAR.xR - JAR.xL) * (JAR.yF - JAR.yTop)
  const r = Math.sqrt((area * 0.6) / (n * Math.PI))
  return Math.max(6, Math.min(26, r))
}

export type Ball = { x: number; y: number; c: number }

// Gravity-settle `count` balls of the fitted radius. Deterministic per seed.
export function settle(count: number, seed: number): { balls: Ball[]; r: number } {
  const n = Math.min(count, MAX_BALLS)
  if (n <= 0) return { balls: [], r: 0 }
  const r = ballRadius(n)
  const { xL, xR, yF, cr } = JAR
  const cxL = xL + cr, cxR = xR - cr, cyF = yF - cr, eff = cr - r
  const rnd = mulberry32(seed || 1)
  const ps = Array.from({ length: n }, () => ({
    x: xL + r + rnd() * (xR - xL - 2 * r),
    y: 120 + rnd() * 220,
    c: Math.floor(rnd() * COLORS.length),
  }))
  const constrain = (p: { x: number; y: number }) => {
    if (p.x < xL + r) p.x = xL + r
    if (p.x > xR - r) p.x = xR - r
    if (p.y > yF - r) p.y = yF - r
    if (p.x < cxL && p.y > cyF) { const dx = p.x - cxL, dy = p.y - cyF, L = Math.hypot(dx, dy); if (L > eff) { p.x = cxL + (dx * eff) / L; p.y = cyF + (dy * eff) / L } }
    if (p.x > cxR && p.y > cyF) { const dx = p.x - cxR, dy = p.y - cyF, L = Math.hypot(dx, dy); if (L > eff) { p.x = cxR + (dx * eff) / L; p.y = cyF + (dy * eff) / L } }
  }
  const iters = n > 60 ? 280 : 420
  for (let it = 0; it < iters; it++) {
    for (const p of ps) p.y += 2.4
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const a = ps[i], b = ps[j]
        let dx = a.x - b.x, dy = a.y - b.y
        const d = Math.hypot(dx, dy) || 0.01
        if (d < 2 * r) { const o = (2 * r - d) / 2; dx /= d; dy /= d; a.x += dx * o; a.y += dy * o; b.x -= dx * o; b.y -= dy * o }
      }
      for (const p of ps) constrain(p)
    }
  }
  return { balls: ps.sort((a, b) => a.y - b.y), r }
}
