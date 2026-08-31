'use client'

// Secondary screening — the guaranteed absurd-question step between identity
// verification (/biometric) and /processing. Every applicant gets exactly one
// question from the SCREENING_QUESTIONS rotation (drawn once per session,
// persisted so a refresh doesn't re-roll it) plus the always-shown IQ
// self-assessment: the bell-curve meme with a slider. Both answers land on
// the progress card and final document via lib/visaAddendum.ts.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { SCREENING, SCREENING_QUESTIONS, iqFaceFor } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep, playStampThunk } from '@/lib/sound'

const optionButtonClass =
  'min-h-11 border-2 px-3 py-2 text-left text-[12px] uppercase tracking-wide transition-all active:scale-[0.97]'

export default function ScreeningPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [answer, setAnswer] = useState<string | null>(null)
  const [iq, setIq] = useState<number>(SCREENING.iqDefault)

  useEffect(() => {
    // Same hydration-race guard as every other funnel page — never redirect
    // off the transient empty state.
    if (!hydrated) return
    // Already finalized (back-navigation after issuance) — resume forward.
    if (state.referenceCode) {
      router.replace('/visa-issued')
      return
    }
    // Requires everything /biometric requires PLUS the submitted selfie —
    // this page sits directly after it in the funnel.
    if (!state.visaType || !state.serial || !state.slot || !state.issuedDate || !state.selfieCaptured) {
      router.replace('/visa')
      return
    }
    // Draw the session's question exactly once and persist it, so a refresh
    // mid-screening keeps the same question instead of re-rolling.
    if (!state.screeningQuestion) {
      const drawn = SCREENING_QUESTIONS[Math.floor(Math.random() * SCREENING_QUESTIONS.length)]
      update({ screeningQuestion: drawn.question })
    }
  }, [hydrated, state, router, update])

  if (!hydrated || !state.visaType || !state.selfieCaptured) return null

  const question =
    SCREENING_QUESTIONS.find((q) => q.question === state.screeningQuestion) ?? SCREENING_QUESTIONS[0]

  const face = iqFaceFor(iq)
  const fillPercent = Math.round(((iq - SCREENING.iqMin) / (SCREENING.iqMax - SCREENING.iqMin)) * 100)

  function pickAnswer(option: string) {
    playBeep()
    setAnswer(option)
  }

  function submit() {
    if (!answer) return
    playStampThunk()
    update({ screeningAnswer: answer, declaredIq: iq })
    addStamp('SECONDARY SCREENING CLEARED')
    router.push('/processing')
  }

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{SCREENING.heading}</h1>
        <p className="mt-1 text-center text-[10px] uppercase leading-relaxed text-navy/60">{SCREENING.sub}</p>

        <p className="mt-5 font-stamp text-sm uppercase leading-relaxed tracking-wide text-navy">
          {question.question}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pickAnswer(option)}
              className={`${optionButtonClass} ${
                answer === option
                  ? 'border-approve bg-approve text-paper'
                  : 'border-navy/40 text-navy hover:border-navy'
              }`}
            >
              <span className="font-stamp">{option}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 border-t-2 border-dashed border-navy/30 pt-4">
          <h2 className="text-center font-stamp text-sm uppercase tracking-wide text-navy">{SCREENING.iqHeading}</h2>
          <p className="mt-1 text-center text-[10px] uppercase leading-relaxed text-navy/60">
            {SCREENING.iqInstruction}
          </p>
          {/* Static meme chart — decorative context for the slider, no event
              details, no external requests (served from /public). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/iq-bell-curve.jpg" alt={SCREENING.iqImageAlt} className="mt-3 w-full border-2 border-navy/30" />

          {/* Live verdict — the wojak the declared IQ currently lands on. */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={face.src}
              alt={face.alt}
              className="h-16 w-16 border-2 border-navy bg-white object-contain"
            />
            <div className="text-left">
              <p className="font-stamp text-2xl uppercase tracking-widest text-navy">{iq}</p>
              <p className="text-[9px] uppercase tracking-wide text-navy/60">{face.caption}</p>
            </div>
          </div>

          <input
            type="range"
            min={SCREENING.iqMin}
            max={SCREENING.iqMax}
            value={iq}
            onChange={(event) => setIq(Number(event.target.value))}
            aria-label={SCREENING.iqHeading}
            className="iq-slider mt-4 w-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2e7d32 ${fillPercent}%, rgba(26, 42, 74, 0.12) ${fillPercent}%)`,
            }}
          />
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-navy/50">
            <span>{SCREENING.iqMin}</span>
            <span>100</span>
            <span>{SCREENING.iqMax}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!answer}
          className="mt-5 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
        >
          {SCREENING.submit}
        </button>
      </div>
      <Footer />
    </PageShell>
  )
}
