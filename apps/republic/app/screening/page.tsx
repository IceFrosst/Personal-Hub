'use client'

// Secondary screening — between identity verification (/biometric) and
// /processing. Two variants by visa type: the DATE path gets the CONFIDENCE
// meter (whatever they declare prints 15% lower on the passport, "adjusted
// by officer"); every other path gets the IQ bell-curve meme. The declared
// value lands on the progress card and final document.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { CONFIDENCE, SCREENING } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk } from '@/lib/sound'

export default function ScreeningPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [iq, setIq] = useState<number>(SCREENING.iqDefault)
  const [confidence, setConfidence] = useState<number>(CONFIDENCE.default)

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
    // Forward-lock: a declared IQ/confidence cannot be revised (owner rule).
    if (state.declaredIq !== null || state.declaredConfidence !== null) {
      router.replace('/processing')
    }
  }, [hydrated, state, router])

  if (
    !hydrated ||
    !state.visaType ||
    !state.selfieCaptured ||
    state.declaredIq !== null ||
    state.declaredConfidence !== null
  )
    return null

  const isDate = state.visaType === 'fiance'
  const fillPercent = isDate
    ? Math.round(((confidence - CONFIDENCE.min) / (CONFIDENCE.max - CONFIDENCE.min)) * 100)
    : Math.round(((iq - SCREENING.iqMin) / (SCREENING.iqMax - SCREENING.iqMin)) * 100)

  function submit() {
    playStampThunk()
    if (isDate) {
      update({ declaredConfidence: confidence })
      addStamp('CONFIDENCE ASSESSED')
    } else {
      update({ declaredIq: iq })
      addStamp('SECONDARY SCREENING CLEARED')
    }
    router.push('/processing')
  }

  if (isDate) {
    return (
      <PageShell showProgress>
        <div className="paper-card p-5">
          <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{SCREENING.heading}</h1>

          <p className="mt-4 text-center text-[11px] uppercase tracking-[0.2em] text-navy">{CONFIDENCE.label}</p>
          <p className="mt-3 text-center font-stamp text-3xl uppercase tracking-widest text-navy">{confidence}%</p>
          <input
            type="range"
            min={CONFIDENCE.min}
            max={CONFIDENCE.max}
            value={confidence}
            onChange={(event) => setConfidence(Number(event.target.value))}
            aria-label={CONFIDENCE.ariaLabel}
            className="iq-slider mt-3 w-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2e7d32 ${fillPercent}%, rgba(26, 42, 74, 0.12) ${fillPercent}%)`,
            }}
          />

          <button
            type="button"
            onClick={submit}
            className="mt-5 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97]"
          >
            {SCREENING.submit}
          </button>
        </div>
        <Footer />
      </PageShell>
    )
  }

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{SCREENING.heading}</h1>

        {/* Image + number ONLY (owner request) — no section heading, no
            instruction line, no scale labels. The chart and the big declared
            number carry the whole joke unassisted. */}
        {/* Bleed close to the form edges so the meme takes almost the whole
            card width; image and slider share this exact wrapper width. */}
        <div className="-mx-3 mt-3">
          {/* Static meme chart — decorative context for the slider, no event
              details, no external requests (served from /public). Its
              background is pre-flattened onto the paper color (#f4f0e8) so it
              blends into the card seamlessly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/iq-bell-curve.jpg" alt={SCREENING.iqImageAlt} className="w-full" />

          {/* Just the declared number — no live wojak preview here (owner
              request); the matching face still gets stamped on the passport
              via lib/visaAddendum.ts. */}
          <p className="mt-3 text-center font-stamp text-3xl uppercase tracking-widest text-navy">{iq}</p>

          {/* Exactly the same width as the image above — no overhang. */}
          <input
            type="range"
            min={SCREENING.iqMin}
            max={SCREENING.iqMax}
            value={iq}
            onChange={(event) => setIq(Number(event.target.value))}
            aria-label={SCREENING.iqAriaLabel}
            className="iq-slider mt-2 w-full cursor-pointer"
            style={{
              background: `linear-gradient(to right, #2e7d32 ${fillPercent}%, rgba(26, 42, 74, 0.12) ${fillPercent}%)`,
            }}
          />
        </div>

        <button
          type="button"
          onClick={submit}
          className="mt-5 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97]"
        >
          {SCREENING.submit}
        </button>
      </div>
      <Footer />
    </PageShell>
  )
}
