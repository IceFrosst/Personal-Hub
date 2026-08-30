'use client'

import { useEffect, useRef, useState } from 'react'
import { playTypewriterClick } from '@/lib/sound'

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function Typewriter({
  text,
  speedMs = 18,
  className = '',
  onDone,
  delayMs = 0,
}: {
  text: string
  speedMs?: number
  className?: string
  onDone?: () => void
  delayMs?: number
}) {
  // Always start at 0 (matches server-rendered output); a client-only effect
  // below jumps straight to the end if the user prefers reduced motion. Never
  // call prefersReducedMotion() during render — window.matchMedia's result can
  // differ between the server pass (always false) and the client, which would
  // desync the initial hydration render from the static HTML.
  const [shown, setShown] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    setShown(prefersReducedMotion() ? text.length : 0)
    doneRef.current = false

    if (prefersReducedMotion()) {
      onDone?.()
      return
    }

    let i = 0
    let interval: ReturnType<typeof setInterval> | null = null
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1
        setShown(i)
        if (i % 3 === 0) playTypewriterClick()
        if (i >= text.length) {
          if (interval) clearInterval(interval)
          if (!doneRef.current) {
            doneRef.current = true
            onDone?.()
          }
        }
      }, speedMs)
    }, delayMs)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <span className={className}>
      {text.slice(0, shown)}
      {shown < text.length && <span className="animate-blink">▌</span>}
    </span>
  )
}
