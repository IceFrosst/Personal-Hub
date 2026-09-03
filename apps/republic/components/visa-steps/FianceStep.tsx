'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import {
  FIANCE_INTRO,
  FIANCE_QUESTIONS,
  FIANCE_SECRET_OPTION,
  FIANCE_SECRET_REMOVED,
  VISA_BY_SLUG,
} from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep, playStampThunk } from '@/lib/sound'

const visa = VISA_BY_SLUG.fiance

export function FianceStep() {
  const router = useRouter()
  const { state, update, selectVisa, hydrated } = useApplication()
  // The withdrawn option: a phantom third answer that disappears when tapped
  // ("OPTION REMOVED. YOUR INTEREST WAS LOGGED.") — the applicant still has
  // to pick A or B. Pure UI; nothing is stored.
  const [secretWithdrawn, setSecretWithdrawn] = useState(false)
  // Sequential interview — answers are mirrored immediately so a refresh can
  // resume rather than re-asking question one.
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    const hydratedAnswers = state.fianceAnswers.slice(0, FIANCE_QUESTIONS.length)
    setAnswers(hydratedAnswers)
    setQuestionIndex(Math.min(hydratedAnswers.length, FIANCE_QUESTIONS.length - 1))
    setRestored(true)
  }, [hydrated, state.fianceAnswers])
  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('fiance')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Forward-lock: a completed interview cannot be retaken (owner rule).
  useEffect(() => {
    if (!hydrated) return
    if (state.fianceInterviewSubmitted || state.fianceAnswers.length >= FIANCE_QUESTIONS.length) router.replace('/appointment')
  }, [hydrated, state.fianceInterviewSubmitted, state.fianceAnswers.length, router])

  function choose(option: string) {
    playBeep()
    const nextAnswers = [...answers, option]
    // Persist each answer so refreshes and abandoned-draft history retain the
    // complete sequence rather than only the final submission.
    update({
      fianceAnswers: nextAnswers,
      fianceInterviewSubmitted: questionIndex >= FIANCE_QUESTIONS.length - 1,
    })
    if (questionIndex < FIANCE_QUESTIONS.length - 1) {
      setAnswers(nextAnswers)
      setQuestionIndex(questionIndex + 1)
      return
    }
    addStamp('FIANC\u00c9 VISA INTERVIEW COMPLETE')
    playStampThunk()
    // Answering the final question completes the interview and navigates
    // immediately — no counter or intermediate confirmation.
    router.push('/appointment')
  }

  const question = FIANCE_QUESTIONS[questionIndex]

  if (!hydrated || !restored || state.fianceInterviewSubmitted || state.fianceAnswers.length >= FIANCE_QUESTIONS.length) return null

  return (
    <StepShell visa={visa}>
      <div key={questionIndex} className={questionIndex > 0 ? 'animate-fade-in' : undefined}>
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
          {/* The phantom option belongs to the FIRST question only. */}
          {questionIndex === 0 && !secretWithdrawn ? (
            <button
              type="button"
              onClick={() => {
                playBeep()
                setSecretWithdrawn(true)
              }}
              className="min-h-11 border-2 border-navy bg-paper px-3 py-2 text-left text-[12px] uppercase tracking-wide text-navy transition-colors hover:bg-navy hover:text-paper"
            >
              {FIANCE_SECRET_OPTION}
            </button>
          ) : questionIndex === 0 && secretWithdrawn ? (
            <p className="animate-fade-in px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-stamp">
              {FIANCE_SECRET_REMOVED}
            </p>
          ) : null}
        </div>
      </div>
    </StepShell>
  )
}
