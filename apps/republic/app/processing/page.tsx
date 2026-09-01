'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { ProgressBar } from '@/components/ProgressBar'
import { useApplication } from '@/lib/applicationContext'
import { PROCESSING_HEADING, PROCESSING_LINES, PROCESSING_TAIL_NOTE } from '@/lib/content'
import { generateReferenceCode } from '@/lib/referenceCode'
import { recordApplication, recordAppointment, buildApplicationRecord, uploadSelfie } from '@/lib/api'
import { createThumbnail } from '@/lib/photo'
import { addStamp } from '@/lib/passport'
import { recordDraftSubmitted } from '@/lib/draftAudit'

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export default function ProcessingPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [percent, setPercent] = useState(0)
  const [lineIndex, setLineIndex] = useState(0)
  // Guards the finalize step against a dev/StrictMode double effect
  // invocation within the SAME mount — refs survive that (React only
  // simulates an unmount/remount for effects, the fiber itself doesn't
  // recreate). A genuine remount (e.g. browser back to /processing) gets a
  // fresh ref, but is separately guarded below by checking
  // `state.referenceCode` first, since that value *is* persisted.
  const finalizedRef = useRef(false)

  useEffect(() => {
    // Don't redirect (or finalize) until the context has finished reading
    // sessionStorage — see the identical race documented on /appointment and
    // /biometric.
    if (!hydrated) return

    // Already finalized this session (e.g. navigated back here after
    // /visa-issued) — resume forward instead of redirecting to /visa or
    // generating a second reference code / application record.
    if (state.referenceCode) {
      router.replace('/visa-issued')
      return
    }

    // Checks the persisted `selfieCaptured` flag, not the never-persisted
    // `selfieDataUrl` — a refresh here before finalize() has run (selfieCaptured
    // already true from biometric submission, referenceCode not yet generated)
    // must resume finalization in place, not bounce back to /visa and lose the
    // flow. `selfieDataUrl` is never required for flow control anywhere.
    // Also requires `serial` and `issuedDate` — same single-source invariant
    // as every other downstream guard (see app/biometric/page.tsx and
    // lib/applicationContext.tsx#selectVisa): a legacy/incomplete session
    // missing either one hasn't genuinely completed selection or the
    // appointment step, so it must restart rather than finalize with a gap.
    if (!state.visaType || !state.serial || !state.slot || !state.issuedDate || !state.selfieCaptured) {
      router.replace('/visa')
      return
    }

    // Generates the ONE reference code + the ONE finalized application
    // record for this funnel, linking name, handle, visa type, whichever
    // sub-step answer applies, the chosen slot, and selfie metadata (never
    // the raw photo). Writing `referenceCode` back into context re-triggers
    // this effect (it's a dependency below); the re-run then takes the
    // "already finalized" branch above and performs the actual navigation —
    // so finalize() itself never calls router.replace, avoiding a redundant
    // double-navigation.
    function finalize() {
      if (finalizedRef.current) return
      finalizedRef.current = true
      const code = generateReferenceCode()

      const complete = (selfiePath: string | null) => {
        const record = buildApplicationRecord(state, code)
        if (selfiePath) record.selfiePath = selfiePath
        void recordApplication(record)
        void recordAppointment({ visaType: record.visaType, slot: record.slot, referenceCode: code })
        if (record.draftId) recordDraftSubmitted(record.draftId, code)
        addStamp('VISA PROCESSED')
        update({ referenceCode: code })
      }

      // Best-effort: upload a review-size copy (~640px JPEG) of the selfie to
      // the private bucket so the Ministry desk can see who's applying.
      // Raced against a timeout so a stalled network can never trap the
      // applicant on the processing screen; any failure just records without
      // a photo path, exactly like before.
      const source = state.selfieDataUrl ?? state.selfieThumbnailUrl
      if (!source) {
        complete(null)
        return
      }
      const upload = createThumbnail(source, 640, 0.75)
        .then((review) => uploadSelfie(code, review ?? source))
        .catch(() => null)
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000))
      void Promise.race([upload, timeout]).then(complete)
    }

    if (prefersReducedMotion()) {
      finalize()
      return
    }

    const lineTimer = setInterval(() => {
      setLineIndex((i) => (i + 1) % PROCESSING_LINES.length)
    }, 900)

    let stalled = false
    const raf = setInterval(() => {
      setPercent((p) => {
        if (p >= 99) {
          if (!stalled) {
            stalled = true
            setTimeout(finalize, 1600)
          }
          return 99
        }
        const jump = p > 85 ? 1 : p > 60 ? 3 : 6
        return Math.min(99, p + jump)
      })
    }, 140)

    return () => {
      clearInterval(lineTimer)
      clearInterval(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.referenceCode, state.visaType, state.serial, state.slot, state.issuedDate, state.selfieCaptured])

  if (!hydrated || !state.visaType || !state.serial || !state.slot || !state.issuedDate) return null

  return (
    <PageShell showProgress>
      <div className="paper-card p-6 text-center">
        <h1 className="font-stamp text-lg uppercase tracking-wide text-navy">{PROCESSING_HEADING}</h1>
        <p className="mt-3 min-h-[2.5rem] text-[11px] uppercase tracking-wide text-navy/70">
          {PROCESSING_LINES[lineIndex]}
        </p>
        <div className="mt-5">
          <ProgressBar percent={percent} />
          <p className="mt-2 text-[11px] font-bold text-navy">{percent}%</p>
        </div>
        {percent >= 99 && (
          <p className="mt-3 animate-fade-in text-[10px] uppercase text-navy/50">{PROCESSING_TAIL_NOTE}</p>
        )}
      </div>
    </PageShell>
  )
}
