'use client'

import { useEffect, useRef, useState } from 'react'
import { useApplication } from '@/lib/applicationContext'
import { getAnimatedFields, markFieldAnimated } from '@/lib/formProgress'
import {
  DOCUMENT_PROGRESS,
  DOCUMENT_PROGRESS_SUBSTEP_LABELS,
  PASSPORT_MRZ_LINE,
  VISA_BY_SLUG,
} from '@/lib/content'

const SUB_STEP_TRUNCATE = 20

function truncate(text: string, max = SUB_STEP_TRUNCATE): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

/**
 * Plays the field-fill reveal exactly once per field per browser session —
 * on the render where `filled` first becomes true, unless that field key was
 * already marked as animated before (e.g. this is a refresh mid-funnel, not
 * a genuinely new value). Reduced motion is handled globally (see
 * app/globals.css) by collapsing the animation to a single ~0ms frame, which
 * is the correct "instant fill" behavior without any extra branching here.
 */
function useRevealAnimation(key: string, filled: boolean): boolean {
  const [animate, setAnimate] = useState(false)
  const evaluatedRef = useRef(false)

  useEffect(() => {
    if (!filled || evaluatedRef.current) return
    evaluatedRef.current = true
    if (getAnimatedFields().has(key)) return
    markFieldAnimated(key)
    setAnimate(true)
    const timer = setTimeout(() => setAnimate(false), 500)
    return () => clearTimeout(timer)
  }, [filled, key])

  return animate
}

function Blank() {
  return <span className="inline-block h-2 w-9 border-b border-navy/30" aria-hidden />
}

function Row({ label, value, animKey }: { label: string; value: string | null; animKey: string }) {
  const filled = Boolean(value)
  const animate = useRevealAnimation(animKey, filled)

  return (
    <div className="flex items-baseline justify-between gap-1.5">
      <span className="shrink-0 text-navy/50">{label}</span>
      {filled ? (
        <span className={`truncate text-right font-bold text-navy ${animate ? 'animate-field-fill' : ''}`}>
          {value}
        </span>
      ) : (
        <Blank />
      )}
    </div>
  )
}

// A small passport booklet: a dark "cover" (navy) bearing the PASSPORT
// heading, a lighter inner "page" with a photo box + data fields (the photo
// box is solid black — a silhouette — until biometrics are captured, then
// shows the persisted thumbnail; falls back to black again if the thumbnail
// never made it, e.g. generation failed), and a purely decorative
// machine-readable-zone line along the bottom of the cover. Deliberately
// smaller than the old flat "FORM 1G-NAS" strip. Never rendered on
// /visa-issued — see that page's <PageShell> call (no `showProgress`).
export function DocumentProgress() {
  const { state, hydrated } = useApplication()
  // Called unconditionally (Rules of Hooks) — the `!hydrated` early return
  // below is fine since nothing else in this component calls a hook after it.
  const photoAnimate = useRevealAnimation('photo', Boolean(state.selfieThumbnailUrl))

  // Same hydration-safety rule as the rest of the funnel: nothing here may
  // read context state before the sessionStorage read completes, so render
  // nothing (not even the card shell) until then.
  if (!hydrated) return null

  const subStepLabel = state.visaType ? DOCUMENT_PROGRESS_SUBSTEP_LABELS[state.visaType] : undefined
  let subStepValue: string | null = null
  if (state.visaType === 'consultation' && state.consultationMatter) subStepValue = truncate(state.consultationMatter)
  if (state.visaType === 'business' && state.businessPitch) subStepValue = truncate(state.businessPitch)
  if (state.visaType === 'special' && state.specialStatement) subStepValue = truncate(state.specialStatement)
  if (state.visaType === 'fiance' && state.fianceAnswers.length > 0) {
    subStepValue = DOCUMENT_PROGRESS.fianceAnsweredValue
  }

  return (
    <div className="sticky top-0 z-20 mb-2 border-2 border-navy bg-navy p-1 shadow-[2px_2px_0_rgba(26,42,74,0.15)]">
      <p className="text-center font-stamp text-[9px] uppercase tracking-[0.3em] text-paper">
        {DOCUMENT_PROGRESS.title}
      </p>

      <div className="mt-1 flex gap-1.5 rounded-sm bg-paper/95 p-1.5 backdrop-blur-sm">
        <div className="h-9 w-7 shrink-0 overflow-hidden border border-navy bg-black">
          {state.selfieThumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.selfieThumbnailUrl}
              alt=""
              className={`h-full w-full object-cover ${photoAnimate ? 'animate-field-fill' : ''}`}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[9px] uppercase tracking-wide">
          <Row
            label={DOCUMENT_PROGRESS.declarationLabel}
            value={DOCUMENT_PROGRESS.declarationValue}
            animKey="declaration"
          />
          <Row label={DOCUMENT_PROGRESS.nameLabel} value={state.applicantName || null} animKey="name" />
          <Row
            label={DOCUMENT_PROGRESS.passportLabel}
            value={state.instagramHandle ? `@${state.instagramHandle}` : null}
            animKey="passport"
          />
          <Row
            label={DOCUMENT_PROGRESS.visaTypeLabel}
            value={state.visaType ? VISA_BY_SLUG[state.visaType].name : null}
            animKey="visaType"
          />
          {subStepLabel && <Row label={subStepLabel} value={subStepValue} animKey={`substep-${state.visaType}`} />}
          <Row label={DOCUMENT_PROGRESS.appointmentLabel} value={state.slot} animKey="appointment" />
          <Row
            label={DOCUMENT_PROGRESS.biometricsLabel}
            value={state.selfieCaptured ? DOCUMENT_PROGRESS.biometricsValue : null}
            animKey="biometrics"
          />
          {state.referenceCode && (
            <Row label={DOCUMENT_PROGRESS.statusLabel} value={DOCUMENT_PROGRESS.statusValue} animKey="status" />
          )}
        </div>
      </div>

      <p
        className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-center font-mono text-[7px] tracking-[0.1em] text-paper/60"
        aria-hidden
      >
        {PASSPORT_MRZ_LINE}
      </p>
    </div>
  )
}
