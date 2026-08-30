'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { CONSULTATION, PRELIMINARY_RULINGS, VISA_BY_SLUG, CONTINUE_TO_APPOINTMENT } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.consultation

export function ConsultationStep() {
  const router = useRouter()
  const { state, update } = useApplication()
  const [matter, setMatter] = useState(state.consultationMatter)
  const [submitted, setSubmitted] = useState(false)
  const ruling = useMemo(() => PRELIMINARY_RULINGS[Math.floor(Math.random() * PRELIMINARY_RULINGS.length)], [])

  useEffect(() => {
    update({ visaType: 'consultation' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!matter.trim()) return
    playBeep()
    update({ consultationMatter: matter.trim() })
    addStamp('CONSULTATION PERMIT FILED')
    setSubmitted(true)
  }

  return (
    <StepShell visa={visa}>
      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="matter" className="text-[11px] uppercase tracking-wide text-navy">
            {CONSULTATION.prompt}
          </label>
          <textarea
            id="matter"
            required
            value={matter}
            onChange={(e) => setMatter(e.target.value)}
            rows={4}
            placeholder={CONSULTATION.placeholder}
            className="ink-border bg-paper p-2 text-[13px] text-navy placeholder:text-navy/40 focus:outline-none"
          />
          <button
            type="submit"
            className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            {CONSULTATION.submit}
          </button>
        </form>
      ) : (
        <div className="animate-fade-in">
          <p className="text-[12px] uppercase leading-relaxed text-navy">{ruling}</p>
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
