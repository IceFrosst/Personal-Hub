'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { BUSINESS, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.business

export function BusinessStep() {
  const router = useRouter()
  const { state, update } = useApplication()
  const [pitch, setPitch] = useState(state.businessPitch)

  useEffect(() => {
    update({ visaType: 'business' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pitch.trim()) return
    playBeep()
    update({ businessPitch: pitch.trim() })
    addStamp('BUSINESS VISA PITCH FILED')
    // Navigates straight to /appointment — no intermediate "received" screen
    // or confirmation button anymore (owner flow change).
    router.push('/appointment')
  }

  return (
    <StepShell visa={visa}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="pitch" className="text-[11px] uppercase tracking-wide text-navy">
          {BUSINESS.prompt}
        </label>
        <textarea
          id="pitch"
          required
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={4}
          placeholder={BUSINESS.placeholder}
          className="ink-border bg-paper p-2 text-[13px] text-navy placeholder:text-navy/40 focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
        >
          {BUSINESS.submit}
        </button>
      </form>
    </StepShell>
  )
}
