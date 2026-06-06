'use client'

import { useCallback, useEffect, useRef } from 'react'
import { IconPlus } from '@tabler/icons-react'
import type { Jar } from '@/lib/types'
import JarVisual from './JarVisual'

// A shelf of jars you swipe through (coverflow): the centered jar is big and
// upright, neighbours rotate away like bottles on a shelf. Gestures on the
// centered jar: short tap → reach in, long-press → jar settings. Tapping a side
// jar brings it to the middle. Edge spacers let the first/last jar centre.
const LONG_PRESS_MS = 450
const MOVE_TOLERANCE = 12 // px of drift before a press becomes a swipe

export default function JarShelf({
  jars,
  counts,
  initialId,
  onActive,
  onTap,
  onLongPress,
  onNewJar,
}: {
  jars: Jar[]
  counts: Record<string, number>
  initialId?: string | null
  onActive: (index: number) => void
  onTap: (jar: Jar) => void
  onLongPress: (jar: Jar) => void
  onNewJar: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const slides = useRef<(HTMLDivElement | null)[]>([])
  const activeRef = useRef(0)
  const raf = useRef<number | null>(null)
  const press = useRef<{ x: number; y: number; i: number; timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null)

  const update = useCallback(() => {
    const sc = scroller.current
    if (!sc) return
    const rect = sc.getBoundingClientRect()
    const mid = rect.left + rect.width / 2
    let nearest = 0
    let best = Infinity
    slides.current.forEach((el, i) => {
      if (!el) return
      const r = el.getBoundingClientRect()
      const off = (r.left + r.width / 2 - mid) / rect.width
      const a = Math.abs(off)
      if (a < best) { best = a; nearest = i }
      const scale = 1 - Math.min(a, 0.6) * 0.42
      el.style.transform = `perspective(1100px) rotateY(${-off * 40}deg) scale(${scale})`
      el.style.opacity = String(1 - Math.min(a, 0.8) * 0.85)
      el.style.zIndex = String(100 - Math.round(a * 100))
    })
    if (nearest !== activeRef.current) { activeRef.current = nearest; onActive(nearest) }
  }, [onActive])

  const onScroll = useCallback(() => {
    if (raf.current) return
    raf.current = requestAnimationFrame(() => { raf.current = null; update() })
  }, [update])

  const center = useCallback((i: number, smooth = true) => {
    const sc = scroller.current
    const el = slides.current[i]
    if (!sc || !el) return
    sc.scrollTo({ left: el.offsetLeft - (sc.clientWidth - el.clientWidth) / 2, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // center the initial jar on mount, then lay out the coverflow
  useEffect(() => {
    const idx = initialId ? jars.findIndex((j) => j.id === initialId) : 0
    activeRef.current = idx > 0 ? idx : 0
    center(activeRef.current, false)
    requestAnimationFrame(update)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // tap = reach in (centred) / center it (side); long-press = settings
  const cancelPress = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null } }

  const down = (e: React.PointerEvent, i: number) => {
    const isActive = i === activeRef.current
    const timer = setTimeout(() => {
      if (press.current) { press.current.fired = true; if (isActive) onLongPress(jars[i]) }
    }, LONG_PRESS_MS)
    press.current = { x: e.clientX, y: e.clientY, i, timer, fired: false }
  }
  const move = (e: React.PointerEvent) => {
    const p = press.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) cancelPress() // it's a swipe
  }
  const up = (e: React.PointerEvent, i: number) => {
    const p = press.current
    if (!p) return
    clearTimeout(p.timer)
    press.current = null
    if (p.fired) return // long-press already handled
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) return
    if (i === activeRef.current) onTap(jars[i])
    else center(i)
  }

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="flex h-full snap-x snap-mandatory items-center overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="shrink-0 basis-[13%]" aria-hidden />

      {jars.map((jar, i) => (
        <div
          key={jar.id}
          ref={(el) => { slides.current[i] = el }}
          className="flex shrink-0 basis-[74%] snap-center flex-col items-center justify-center"
          style={{ willChange: 'transform' }}
        >
          <div
            role="button"
            tabIndex={0}
            aria-label={`${jar.name}, ${counts[jar.id] ?? 0} cookies — tap to reach in, long-press for settings`}
            onPointerDown={(e) => down(e, i)}
            onPointerMove={move}
            onPointerUp={(e) => up(e, i)}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full max-w-[300px] px-1 [touch-action:pan-x] [-webkit-touch-callout:none]"
            style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
          >
            <JarVisual count={counts[jar.id] ?? 0} seed={jar.id} color={jar.color} size={300} className="h-auto w-full" />
          </div>
        </div>
      ))}

      {/* add-a-jar slide */}
      <div
        ref={(el) => { slides.current[jars.length] = el }}
        className="flex shrink-0 basis-[74%] snap-center flex-col items-center justify-center"
        style={{ willChange: 'transform' }}
      >
        <button
          type="button"
          onClick={onNewJar}
          aria-label="New jar"
          className="flex aspect-square w-full max-w-[260px] items-center justify-center rounded-[26%] border-2 border-dashed border-border text-text-low transition-colors active:border-coral active:text-coral"
        >
          <IconPlus size={64} stroke={1.5} />
        </button>
      </div>

      <div className="shrink-0 basis-[13%]" aria-hidden />
    </div>
  )
}
