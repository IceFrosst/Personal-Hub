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
import { SCREENING } from '@/lib/content'
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
      return
    }
    // DATE VISA skips the IQ self-assessment entirely (owner request) —
    // /biometric routes fiancé applicants straight to /processing, so anyone
    // landing here with that visa type is deep-linking/back-navigating and
    // gets forwarded the same way.
    if (state.visaType === 'fiance') {
      router.replace('/processing')
    }
  }, [hydrated, state, router])

  if (!hydrated || !state.visaType || state.visaType === 'fiance' || !state.selfieCaptured) return null

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

        {/* Image + number ONLY (owner request) — no section heading, no
            instruction line, no scale labels. The chart and the big declared
            number carry the whole joke unassisted. */}
        <div className="mt-4">
          {/* Static meme chart — decorative context for the slider, no event
              details, no external requests (served from /public). Its
              background is pre-flattened onto the paper color (#f4f0e8) so it
              blends into the card seamlessly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/iq-bell-curve.jpg" alt={SCREENING.iqImageAlt} className="mt-3 w-full" />

          {/* Just the declared number — no live wojak preview here (owner
              request); the matching face still gets stamped on the passport
              via lib/visaAddendum.ts. */}
          <p className="mt-4 text-center font-stamp text-3xl uppercase tracking-widest text-navy">{iq}</p>

          {/* The slider is width-matched to the meme's own IQ axis (the 55
              tick sits ~24% in, the 145 tick ~72% in on the source image), so
              it never extends past the chart and its positions line up with
              the printed scores (owner request). Percentages are relative to
              the image, which is w-full — same reference width. */}
          <div className="ml-[24%] w-[48%]">
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
