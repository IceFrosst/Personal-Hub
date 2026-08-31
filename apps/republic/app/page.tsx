'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crest } from '@/components/Crest'
import { Footer } from '@/components/Footer'
import { OfficerMoodBadge } from '@/components/OfficerMoodBadge'
import { HiddenBribe } from '@/components/HiddenBribe'
import { PageShell } from '@/components/PageShell'
import { Typewriter } from '@/components/Typewriter'
import { addStamp } from '@/lib/passport'
import { getApplicantNumber } from '@/lib/api'
import { clearAnimatedFields } from '@/lib/formProgress'
import { LANDING, SCREENING_QUESTIONS, formatApplicantNumber, type ScreeningQuestion } from '@/lib/content'
import { playStampThunk } from '@/lib/sound'
import { useApplication } from '@/lib/applicationContext'

export default function EntryDeclarationPage() {
  const router = useRouter()
  const { state, update, reset } = useApplication()
  // The applicant number is fetched from a Supabase RPC (or read from a
  // localStorage cache if this browser already has one) — never read/set
  // synchronously during render, since this page is statically prerendered
  // and the server always sees an empty/default environment. It starts
  // `null` and is only ever populated inside the effect below, after mount.
  const [showQuestion, setShowQuestion] = useState(false)
  const [applicantNumber, setApplicantNumber] = useState<number | null>(null)
  // The absurd follow-up drawn after a YES declaration — null until then.
  // Guaranteed for every applicant (owner request: 100% occurrence), one of
  // SCREENING_QUESTIONS at random; the answer prints on the passport via
  // lib/visaAddendum.ts#getScreeningAddenda.
  const [followUp, setFollowUp] = useState<ScreeningQuestion | null>(null)

  useEffect(() => {
    // Landing restarts the funnel on every visit, but identity is preserved
    // across that restart (thematically: your passport doesn't get reset
    // every time you walk up to the counter, only the application does) —
    // capture it before reset(), then re-apply it after.
    const preservedName = state.applicantName
    const preservedHandle = state.instagramHandle
    reset()
    clearAnimatedFields()
    if (preservedName) update({ applicantName: preservedName })
    if (preservedHandle) update({ instagramHandle: preservedHandle })

    addStamp('ENTRY DECLARATION VIEWED')
    // Async: resolves from the localStorage cache instantly if this browser
    // already has a number, otherwise awaits the Supabase RPC. On failure it
    // resolves to null and the placeholder just stays put — no fake number
    // is ever generated locally (see lib/api.ts#getApplicantNumber).
    getApplicantNumber().then(setApplicantNumber)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAnswer(answer: 'yes' | 'no') {
    playStampThunk()
    if (answer === 'no') {
      router.push('/denied')
      return
    }
    // Declaring something triggers immediate follow-up questioning — the
    // officer needs details. Navigation waits for the answer below.
    setFollowUp(SCREENING_QUESTIONS[Math.floor(Math.random() * SCREENING_QUESTIONS.length)])
  }

  function answerFollowUp(option: string) {
    if (!followUp) return
    playStampThunk()
    update({ screeningQuestion: followUp.question, screeningAnswer: option })
    addStamp('FOLLOW-UP QUESTIONING CLEARED')
    router.push('/identity')
  }

  return (
    <PageShell fullHeight>
      <div className="paper-card relative p-4">
        <div
          className="absolute right-2 top-2 rotate-[8deg] border-2 border-stamp px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-stamp"
          aria-hidden
        >
          {LANDING.priorityStamp}
        </div>

        <div className="flex flex-col items-center gap-1">
          <Crest className="h-10 w-10" />
          <h1 className="font-stamp text-lg uppercase tracking-wide text-navy">{LANDING.title}</h1>
          <p className="text-[10px] uppercase tracking-[0.25em] text-navy/70">{LANDING.subtitle}</p>
        </div>

        <div className="my-2 h-px bg-navy/30" />

        <p className="text-center text-[10px] uppercase tracking-wide text-navy/70">{LANDING.formCode}</p>
        <p className="mt-0.5 text-center text-[10px] text-navy/60">
          {LANDING.applicantNumberPrefix}{' '}
          {applicantNumber !== null ? formatApplicantNumber(applicantNumber) : LANDING.applicantNumberPlaceholder}
        </p>

        <div className="barcode mt-2 !h-3" aria-hidden />

        {!followUp ? (
          <>
            <div className="mt-3 min-h-[3rem] text-center">
              <Typewriter
                text={LANDING.question}
                className="font-stamp text-base uppercase tracking-wide text-navy"
                onDone={() => setShowQuestion(true)}
              />
            </div>

            <div
              className={`mt-3 grid grid-cols-2 gap-4 transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              <button
                type="button"
                onClick={() => handleAnswer('yes')}
                className="min-h-11 border-2 border-approve bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-approve transition-all hover:bg-approve hover:text-paper active:scale-[0.97]"
              >
                {LANDING.yes}
              </button>
              <button
                type="button"
                onClick={() => handleAnswer('no')}
                className="min-h-11 border-2 border-stamp bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-stamp transition-all hover:bg-stamp hover:text-paper active:scale-[0.97]"
              >
                {LANDING.no}
              </button>
            </div>
          </>
        ) : (
          <div className="animate-fade-in mt-3">
            <p className="text-center font-stamp text-sm uppercase leading-relaxed tracking-wide text-navy">
              {followUp.question}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {followUp.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => answerFollowUp(option)}
                  className="min-h-11 border-2 border-navy/40 px-3 py-2 text-left text-[12px] uppercase tracking-wide text-navy transition-all hover:border-approve hover:bg-approve hover:text-paper active:scale-[0.97]"
                >
                  <span className="font-stamp">{option}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col items-center">
        <OfficerMoodBadge />
      </div>

      <Footer compact />
      <HiddenBribe />
    </PageShell>
  )
}
