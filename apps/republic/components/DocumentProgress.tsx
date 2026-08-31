'use client'

import { useEffect, useRef, useState } from 'react'
import { useApplication } from '@/lib/applicationContext'
import { getAnimatedFields, markFieldAnimated } from '@/lib/formProgress'
import { APPROVED, DOCUMENT_PROGRESS, STICKER_LABELS, VISA_BY_SLUG } from '@/lib/content'
import { VisaDocument, type VisaDocumentAddendum, type VisaDocumentField } from '@/components/VisaDocument'
import { getScreeningAddenda, getVisaAddendum } from '@/lib/visaAddendum'

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

// A faithful DOM replica of the final canvas-composited visa sticker on
// /visa-issued — "the same document, being filled in." Renders via the
// shared components/VisaDocument.tsx (also used by the final /visa-issued
// document itself, in its "full" size, so the two structures can't drift
// apart — see that file's header comment). This component owns everything
// stateful: hydration guarding, the one-time reveal-animation hooks (one per
// field, called unconditionally so their count/order never changes — see
// useRevealAnimation above), and reading live funnel state out of context;
// VisaDocument itself just renders whatever field data it's handed.
//
// Field grid mirrors the sticker's own order exactly — NAME + PASSPORT,
// VISA TYPE + SERIAL №, REFERENCE № full-width, ISSUED + VALID, CONDITIONS
// full-width — via STICKER_LABELS, the single shared label source with the
// canvas draw code on /visa-issued. By /biometric, every field except
// REFERENCE № is filled: SERIAL № is set at visa selection, VALID/
// CONDITIONS fill immediately on visa selection (from
// APPROVED.validValue/conditionsValue, the same constants /visa-issued
// renders), and ISSUED fills once the appointment slot is confirmed.
// REFERENCE № is the one truly issuance-only value and stays a ruled blank
// until /processing generates it. Below the grid, up to two addenda (not
// sticker fields — the appointment slot, and whatever the chosen visa's
// sub-step collected) render with their own dashed-divider treatment.
// Never rendered on landing or /visa-issued — see PageShell's `showProgress`.
export function DocumentProgress() {
  const { state, hydrated } = useApplication()
  // Called unconditionally (Rules of Hooks) — the `!hydrated` early return
  // below is fine since nothing else in this component calls a hook after it.
  const nameAnimate = useRevealAnimation('name', Boolean(state.applicantName))
  const passportAnimate = useRevealAnimation('passport', Boolean(state.instagramHandle))
  const visaTypeAnimate = useRevealAnimation('visaType', Boolean(state.visaType))
  const serialAnimate = useRevealAnimation('serial', Boolean(state.serial))
  const referenceAnimate = useRevealAnimation('reference', Boolean(state.referenceCode))
  const issuedAnimate = useRevealAnimation('issued', Boolean(state.issuedDate))
  const validAnimate = useRevealAnimation('valid', Boolean(state.visaType))
  const sexAnimate = useRevealAnimation('sex', Boolean(state.gender))
  const photoAnimate = useRevealAnimation('photo', Boolean(state.selfieThumbnailUrl))
  const appointmentAnimate = useRevealAnimation('appointment', Boolean(state.slot))
  const subStepAddendum = getVisaAddendum(state)
  const subStepAnimate = useRevealAnimation('subStepContent', Boolean(subStepAddendum))

  // Same hydration-safety rule as the rest of the funnel: nothing here may
  // read context state before the sessionStorage read completes, so render
  // nothing (not even the card shell) until then.
  if (!hydrated) return null

  const visa = state.visaType ? VISA_BY_SLUG[state.visaType] : null

  const fields: VisaDocumentField[] = [
    { key: 'name', label: STICKER_LABELS.name, value: state.applicantName || null, animate: nameAnimate },
    {
      key: 'passport',
      label: STICKER_LABELS.passport,
      value: state.instagramHandle ? `@${state.instagramHandle}` : null,
      animate: passportAnimate,
    },
    { key: 'visaType', label: STICKER_LABELS.visaType, value: visa ? visa.name : null, animate: visaTypeAnimate },
    { key: 'serial', label: STICKER_LABELS.serial, value: state.serial, animate: serialAnimate },
    {
      key: 'reference',
      label: STICKER_LABELS.reference,
      value: state.referenceCode,
      span: true,
      animate: referenceAnimate,
    },
    { key: 'issued', label: STICKER_LABELS.issued, value: state.issuedDate, animate: issuedAnimate },
    { key: 'valid', label: STICKER_LABELS.valid, value: visa ? APPROVED.validValue : null, animate: validAnimate },
    { key: 'sex', label: STICKER_LABELS.sex, value: state.gender, animate: sexAnimate },
  ]

  const addenda: VisaDocumentAddendum[] = [
    { key: 'appointment', label: DOCUMENT_PROGRESS.appointmentLabel, value: state.slot, animate: appointmentAnimate },
  ]
  if (subStepAddendum) {
    addenda.push({
      key: 'subStep',
      label: subStepAddendum.label,
      value: subStepAddendum.value,
      animate: subStepAnimate,
    })
  }
  getScreeningAddenda(state).forEach((item, index) => {
    addenda.push({
      key: `screening-${index}`,
      label: item.label,
      value: item.value,
      imageSrc: item.imageSrc,
      imageAlt: item.imageAlt,
    })
  })

  return (
    <div className="sticky top-0 z-20 mb-2">
      <VisaDocument
        size="compact"
        visaName={visa ? visa.name : null}
        photoUrl={state.selfieThumbnailUrl}
        photoAnimate={photoAnimate}
        fields={fields}
        addenda={addenda}
      />
    </div>
  )
}
