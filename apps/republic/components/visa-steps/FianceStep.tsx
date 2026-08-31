'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { FIANCE_INTRO, FIANCE_QUESTIONS, FIANCE_HIGH_RISK, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep, playStampThunk } from '@/lib/sound'

const visa = VISA_BY_SLUG.fiance

export function FianceStep() {
  const router = useRouter()
  const { update, selectVisa } = useApplication()
  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('fiance')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function choose(option: string) {
    playBeep()
    update({ fianceAnswers: [option] })
    addStamp('FIANC\u00c9 VISA INTERVIEW COMPLETE')
    playStampThunk()
    // This visa is exactly one question, so choosing either answer completes
    // it and navigates immediately — no counter or intermediate confirmation.
    router.push('/appointment')
  }

  const question = FIANCE_QUESTIONS[0]

  return (
    <StepShell visa={visa}>
      <span className="mx-auto -mt-1 mb-3 block w-fit rotate-[6deg] border-2 border-stamp px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-stamp">
        {FIANCE_HIGH_RISK}
      </span>

      <div>
        <p className="text-center text-[11px] uppercase tracking-wide text-navy/70">{FIANCE_INTRO}</p>
        <p className="mt-4 text-center font-stamp text-base uppercase tracking-wide text-navy">
          {question.question}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className="min-h-11 border-2 border-navy bg-paper px-3 py-2 text-left text-[12px] uppercase tracking-wide text-navy transition-colors hover:bg-navy hover:text-paper"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </StepShell>
  )
}
