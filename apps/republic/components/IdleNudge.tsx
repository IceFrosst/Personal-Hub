'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { IDLE_NUDGE, IDLE_TIMEOUT_MS } from '@/lib/content'

const EVENTS: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart']

export function IdleNudge() {
  const [visible, setVisible] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setVisible(false)
    let timer: ReturnType<typeof setTimeout>

    function reset() {
      setVisible(false)
      clearTimeout(timer)
      timer = setTimeout(() => setVisible(true), IDLE_TIMEOUT_MS)
    }

    reset()
    EVENTS.forEach((evt) => window.addEventListener(evt, reset, { passive: true }))

    return () => {
      clearTimeout(timer)
      EVENTS.forEach((evt) => window.removeEventListener(evt, reset))
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto mb-[max(env(safe-area-inset-bottom),0.75rem)] w-fit max-w-[92vw] animate-fade-in rounded-sm border-2 border-navy bg-stamp px-4 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-paper shadow-lg"
    >
      {IDLE_NUDGE}
    </div>
  )
}
