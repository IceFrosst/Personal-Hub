'use client'

import { useEffect, useState } from 'react'
import { isSoundEnabled, setSoundEnabled, playBeep } from '@/lib/sound'
import { SOUND_TOGGLE_LABEL } from '@/lib/content'

export function SoundToggle() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(isSoundEnabled())
  }, [])

  function toggle() {
    const next = !enabled
    setSoundEnabled(next)
    setEnabled(next)
    if (next) playBeep()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-navy/70 hover:text-navy"
      aria-pressed={enabled}
    >
      <span aria-hidden>{enabled ? '☑' : '☐'}</span>
      {SOUND_TOGGLE_LABEL}
    </button>
  )
}
