'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { BUSINESS, VISA_BY_SLUG, CONTINUE_TO_APPOINTMENT } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.business

export function BusinessStep() {
  const router = useRouter()
  const { state, update } = useApplication()
  const [pitch, setPitch] = useState(state.businessPitch)
  const [submitted, setSubmitted] = useState(false)

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
    setSubmitted(true)
  }

  return (
    <StepShell visa={visa}>
      {!submitted ? (
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
      ) : (
        <div className="animate-fade-in">
          <p className="text-[12px] uppercase leading-relaxed text-navy">{BUSINESS.receivedNote}</p>
          <button
            type="button"
            onClick={() => router.push('/appointment')}
            className="mt-6 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            {CONTINUE_TO_APPOINTMENT}
          </button>
        </div>
      )}
    </StepShell>
  )
}
