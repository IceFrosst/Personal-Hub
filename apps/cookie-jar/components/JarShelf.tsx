'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import type { Jar } from '@/lib/types'
import JarVisual from './JarVisual'

// A shelf of jars you swipe through (coverflow): the centered jar is big and
// upright, neighbours rotate away like bottles on a shelf. Tap the centered jar
// to open it; tap a side jar to bring it to the middle.
export default function JarShelf({
  jars,
  counts,
  initialId,
  onOpen,
  onNewJar,
}: {
  jars: Jar[]
  counts: Record<string, number>
  initialId?: string | null
  onOpen: (jar: Jar) => void
  onNewJar: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const slides = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)
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
      el.style.opacity = String(1 - Math.min(a, 0.75) * 0.8)
      el.style.zIndex = String(100 - Math.round(a * 100))
    })
    setActive(nearest)
  }, [])

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
    center(idx > 0 ? idx : 0, false)
    requestAnimationFrame(update)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeJar = jars[active]

  return (
    <div className="flex flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex flex-1 snap-x snap-mandatory items-center overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {jars.map((jar, i) => (
          <div
            key={jar.id}
            ref={(el) => { slides.current[i] = el }}
            className="flex w-[74%] shrink-0 snap-center flex-col items-center justify-center px-2"
            style={{ willChange: 'transform' }}
          >
            <button
              type="button"
              onClick={() => (i === active ? onOpen(jar) : center(i))}
              aria-label={i === active ? `Open ${jar.name}` : `View ${jar.name}`}
              className="w-full max-w-[300px]"
            >
              <JarVisual count={counts[jar.id] ?? 0} seed={jar.id} size={300} className="h-auto w-full" />
            </button>
          </div>
        ))}

        {/* add-a-jar slide */}
        <div
          ref={(el) => { slides.current[jars.length] = el }}
          className="flex w-[74%] shrink-0 snap-center flex-col items-center justify-center px-2"
          style={{ willChange: 'transform' }}
        >
          <button
            type="button"
            onClick={onNewJar}
            aria-label="New jar"
            className="flex aspect-square w-full max-w-[300px] items-center justify-center rounded-[22%] border-2 border-dashed border-border text-text-low transition-colors active:border-coral active:text-coral"
          >
            <IconPlus size={64} stroke={1.5} />
          </button>
        </div>
      </div>

      {/* name + count of the centered jar */}
      <div className="mt-2 min-h-[72px] text-center">
        {active < jars.length && activeJar ? (
          <>
            <h2 className="truncate px-6 text-2xl font-semibold tracking-tight text-text">{activeJar.name}</h2>
            <p className="mt-1 text-sm text-text-muted">
              {(counts[activeJar.id] ?? 0)} {(counts[activeJar.id] ?? 0) === 1 ? 'cookie' : 'cookies'}
              <span className="text-text-low"> · tap to open</span>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold tracking-tight text-text">New jar</h2>
            <p className="mt-1 text-sm text-text-muted">Start a new collection</p>
          </>
        )}
      </div>

      {/* dots */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {jars.map((j, i) => (
          <span
            key={j.id}
            className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-coral' : 'w-1.5 bg-border'}`}
          />
        ))}
        <span className={`h-1.5 rounded-full transition-all ${active === jars.length ? 'w-4 bg-coral' : 'w-1.5 bg-border'}`} />
      </div>
    </div>
  )
}
