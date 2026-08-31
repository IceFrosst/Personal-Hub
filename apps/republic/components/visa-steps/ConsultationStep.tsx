'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { CONSULTATION, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.consultation

export function ConsultationStep() {
  const router = useRouter()
  const { state, update, selectVisa } = useApplication()
  const [matter, setMatter] = useState(state.consultationMatter)

  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('consultation')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!matter.trim()) return
    playBeep()
    update({ consultationMatter: matter.trim() })
    addStamp('CONSULTATION PERMIT FILED')
    // Navigates straight to /appointment — no intermediate "ruling" screen
    // or confirmation button anymore (owner flow change).
    router.push('/appointment')
  }

  return (
    <StepShell visa={visa}>
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
    </StepShell>
  )
}
