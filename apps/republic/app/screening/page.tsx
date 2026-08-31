'use client'

// Secondary screening — the cognitive self-assessment step between identity
// verification (/biometric) and /processing. The absurd follow-up question
// itself now lives on the landing page (asked immediately after a YES
// declaration — see app/page.tsx); this page is just the IQ bell-curve meme
// with the slider. The declared IQ lands on the progress card and final
// document (with its matching wojak face stamp) via lib/visaAddendum.ts.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { SCREENING, iqFaceFor } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk } from '@/lib/sound'

export default function ScreeningPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
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
    }
  }, [hydrated, state, router])

  if (!hydrated || !state.visaType || !state.selfieCaptured) return null

  const face = iqFaceFor(iq)
  const fillPercent = Math.round(((iq - SCREENING.iqMin) / (SCREENING.iqMax - SCREENING.iqMin)) * 100)

  function submit() {
    playStampThunk()
    update({ declaredIq: iq })
    addStamp('SECONDARY SCREENING CLEARED')
    router.push('/processing')
  }

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{SCREENING.heading}</h1>
        <p className="mt-1 text-center text-[10px] uppercase leading-relaxed text-navy/60">{SCREENING.sub}</p>

        <div className="mt-5">
          <h2 className="text-center font-stamp text-sm uppercase tracking-wide text-navy">{SCREENING.iqHeading}</h2>
          <p className="mt-1 text-center text-[10px] uppercase leading-relaxed text-navy/60">
            {SCREENING.iqInstruction}
          </p>
          {/* Static meme chart — decorative context for the slider, no event
              details, no external requests (served from /public). Its
              background is pre-flattened onto the paper color (#f4f0e8) so it
              blends into the card seamlessly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/iq-bell-curve.jpg" alt={SCREENING.iqImageAlt} className="mt-3 w-full" />

          {/* Live verdict — the wojak the declared IQ currently lands on. */}
          <div className="mt-4 flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={face.src} alt={face.alt} className="h-16 w-16 border-2 border-navy object-contain" />
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
          className="mt-5 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97]"
        >
          {SCREENING.submit}
        </button>
      </div>
      <Footer />
    </PageShell>
  )
}
