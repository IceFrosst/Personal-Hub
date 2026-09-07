'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GroupPhotoQuestion } from './GroupPhotoQuestion'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { BUSINESS, GROUP_PHOTO_QUESTION, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.business

export function BusinessStep() {
  const router = useRouter()
  const { state, update, selectVisa, hydrated } = useApplication()
  // Seeded from context AFTER hydration — same latent pre-hydration bug the
  // review found in TouristStep/SpecialStep existed here too: initializing
  // from context during the first render reads EMPTY_STATE on a refresh.
  const [pitch, setPitch] = useState('')
  const [stage, setStage] = useState<'proposal' | 'photo'>('proposal')
  const seededRef = useRef(false)

  useEffect(() => {
    if (!hydrated || seededRef.current) return
    seededRef.current = true
    const photoAnswered = state.screeningQuestion === GROUP_PHOTO_QUESTION.question && Boolean(state.screeningAnswer)
    // Forward-lock only after both the proposal and path-specific question
    // are complete. A refresh between them resumes at the photo question.
    if (state.businessPitchSubmitted && photoAnswered) {
      router.replace('/appointment')
      return
    }
    setPitch((prev) => prev || state.businessPitch)
    if (state.businessPitchSubmitted) setStage('photo')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.businessPitch, state.businessPitchSubmitted, state.screeningQuestion, state.screeningAnswer])

  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('business')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pitch.trim()) return
    playBeep()
    update({ businessPitch: pitch.trim(), businessPitchSubmitted: true })
    addStamp('BUSINESS VISA PITCH FILED')
    setStage('photo')
  }

  function answerPhotoQuestion(answer: string) {
    playBeep()
    update({ screeningQuestion: GROUP_PHOTO_QUESTION.question, screeningAnswer: answer })
    addStamp('GROUP PHOTO QUESTION CLEARED')
    router.push('/appointment')
  }

  const photoAnswered = state.screeningQuestion === GROUP_PHOTO_QUESTION.question && Boolean(state.screeningAnswer)
  if (!hydrated || (state.businessPitchSubmitted && photoAnswered)) return null

  return (
    <StepShell visa={visa}>
      {stage === 'photo' ? (
        <GroupPhotoQuestion onAnswer={answerPhotoQuestion} />
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="pitch" className="text-[11px] uppercase tracking-wide text-navy">
          {BUSINESS.prompt}
        </label>
        <textarea
          id="pitch"
          required
          value={pitch}
          onChange={(e) => {
            const next = e.target.value
            setPitch(next)
            update({ businessPitch: next })
          }}
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
      )}
    </StepShell>
  )
}
