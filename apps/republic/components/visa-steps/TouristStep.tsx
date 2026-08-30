'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { VISA_BY_SLUG, TOURIST_STEP, CONTINUE_TO_APPOINTMENT } from '@/lib/content'
import { addStamp } from '@/lib/passport'

const visa = VISA_BY_SLUG.tourist

export function TouristStep() {
  const router = useRouter()
  const { update } = useApplication()

  useEffect(() => {
    update({ visaType: 'tourist' })
    addStamp('TOURIST VISA SELECTED')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <StepShell visa={visa}>
      <p className="text-center text-[12px] uppercase tracking-wide text-navy">{TOURIST_STEP.notice}</p>
      <p className="mt-2 text-center text-[11px] text-navy/60">{TOURIST_STEP.disclaimer}</p>
      <button
        type="button"
        onClick={() => router.push('/appointment')}
        className="mt-6 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
      >
        {CONTINUE_TO_APPOINTMENT}
      </button>
    </StepShell>
  )
}
