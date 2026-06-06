'use client'

import { useCallback, useEffect, useRef } from 'react'
import { IconPlus } from '@tabler/icons-react'
import type { Jar } from '@/lib/types'
import JarVisual from './JarVisual'

// A shelf of jars you swipe through (coverflow): the centered jar is big and
// upright, neighbours rotate away like bottles on a shelf. Tap the centered jar
// to open it; tap a side jar to bring it to the middle. Edge spacers let the
// first/last jar reach dead-centre. Reports the centered index to the parent,
// which renders the name + action buttons + dots beneath.
export default function JarShelf({
  jars,
  counts,
  initialId,
  onActive,
  onOpen,
  onNewJar,
}: {
  jars: Jar[]
  counts: Record<string, number>
  initialId?: string | null
  onActive: (index: number) => void
  onOpen: (jar: Jar) => void
  onNewJar: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const slides = useRef<(HTMLDivElement | null)[]>([])
  const activeRef = useRef(0)
  const raf = useRef<number | null>(null)

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
      el.style.transform = `perspective(1100px) rotateY(${-off * 42}deg) scale(${scale})`
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

  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      className="flex flex-1 snap-x snap-mandatory items-center overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="shrink-0 basis-[13%]" aria-hidden />

      {jars.map((jar, i) => (
        <div
          key={jar.id}
          ref={(el) => { slides.current[i] = el }}
          className="flex shrink-0 basis-[74%] snap-center flex-col items-center justify-center"
          style={{ willChange: 'transform' }}
        >
          <button
            type="button"
            onClick={() => (i === activeRef.current ? onOpen(jar) : center(i))}
            aria-label={`${jar.name}, ${counts[jar.id] ?? 0} cookies`}
            className="w-full max-w-[300px] px-1"
          >
            <JarVisual count={counts[jar.id] ?? 0} seed={jar.id} color={jar.color} size={300} className="h-auto w-full" />
          </button>
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
          className="flex aspect-square w-full max-w-[280px] items-center justify-center rounded-[22%] border-2 border-dashed border-border text-text-low transition-colors active:border-coral active:text-coral"
        >
          <IconPlus size={64} stroke={1.5} />
        </button>
      </div>

      <div className="shrink-0 basis-[13%]" aria-hidden />
    </div>
  )
}
