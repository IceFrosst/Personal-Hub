'use client'

import { useEffect, useRef, useState } from 'react'
import { useApplication } from '@/lib/applicationContext'
import { getAnimatedFields, markFieldAnimated } from '@/lib/formProgress'
import { DOCUMENT_PROGRESS, STICKER_LABELS, VISA_BY_SLUG } from '@/lib/content'

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

function Blank({ wide }: { wide?: boolean }) {
  return <span className={`inline-block h-2 border-b border-navy/30 ${wide ? 'w-16' : 'w-9'}`} aria-hidden />
}

function Row({
  label,
  value,
  animKey,
  span,
}: {
  label: string
  value: string | null
  animKey: string
  /** REFERENCE № runs full-width across both columns, same as on the sticker. */
  span?: boolean
}) {
  const filled = Boolean(value)
  const animate = useRevealAnimation(animKey, filled)

  return (
    <div className={`flex items-baseline justify-between gap-1.5 ${span ? 'col-span-2' : ''}`}>
      <span className="shrink-0 text-navy">{label}</span>
      {filled ? (
        <span className={`truncate text-right font-bold text-navy ${animate ? 'animate-field-fill' : ''}`}>
          {value}
        </span>
      ) : (
        <Blank wide={span} />
      )}
    </div>
  )
}

// A faithful DOM replica of the final canvas-composited visa sticker on
// /visa-issued — "the same document, being filled in." Shares the exact
// label copy with the sticker via STICKER_LABELS (single source; see
// lib/content.ts) and mirrors its design language: the same double navy
// border on paper, the same "DICTATORSHIP OF IGNAS" header + "VISA — <TYPE>"
// subtitle line (blank/ruled until a visa is chosen), a SQUARE photo box
// (not the sticker's old oval — square everywhere per owner feedback), and
// a barcode strip along the bottom. The two-column field grid replicates
// *every* field on the sticker, in the sticker's own order — NAME +
// PASSPORT №, VISA TYPE + SERIAL №, REFERENCE № full-width, then ISSUED +
// VALID, then CONDITIONS full-width — via STICKER_LABELS, the single shared
// source. SERIAL №/ISSUED/VALID/CONDITIONS never actually have a value here
// (they're only ever computed on /visa-issued itself, which this component
// never renders alongside — see the bottom of this comment), so they always
// render as ruled blanks; that's intentional, not a missing-data bug. The
// APPOINTMENT slot is real funnel data known well before issuance, but it is
// NOT one of the sticker's own fields, so it's deliberately kept outside the
// replicated field grid — shown as its own dashed-divider line below it —
// rather than standing in for (and being confused with) the sticker's ISSUED
// row. The photo box uses the sticker's own placeholder treatment
// (`#cfc8b8` fill + `STICKER_LABELS.photoPlaceholder` text, square corners)
// until biometrics are captured, then shows the persisted thumbnail; falls
// back to the placeholder again if the thumbnail never made it (e.g.
// generation failed). Never rendered on landing or /visa-issued — see that
// page's <PageShell> call (no `showProgress`).
export function DocumentProgress() {
  const { state, hydrated } = useApplication()
  // Called unconditionally (Rules of Hooks) — the `!hydrated` early return
  // below is fine since nothing else in this component calls a hook after it.
  const photoAnimate = useRevealAnimation('photo', Boolean(state.selfieThumbnailUrl))
  const appointmentAnimate = useRevealAnimation('appointment', Boolean(state.slot))

  // Same hydration-safety rule as the rest of the funnel: nothing here may
  // read context state before the sessionStorage read completes, so render
  // nothing (not even the card shell) until then.
  if (!hydrated) return null

  const visa = state.visaType ? VISA_BY_SLUG[state.visaType] : null

  return (
    <div className="sticky top-0 z-20 mb-2 border-2 border-navy bg-paper p-1 shadow-[2px_2px_0_rgba(26,42,74,0.15)]">
      <div className="border border-navy p-1.5">
        <p className="text-center font-stamp text-[9px] uppercase tracking-[0.2em] text-navy">
          {STICKER_LABELS.republicTitle}
        </p>
        {visa ? (
          <p className="text-center text-[7px] uppercase tracking-[0.15em] text-navy">
            {STICKER_LABELS.visaPrefix}
            {visa.name}
          </p>
        ) : (
          <div className="mt-0.5 flex justify-center">
            <Blank wide />
          </div>
        )}

        <div className="mt-1 flex items-start gap-1.5">
          <div className="h-11 w-8 shrink-0 overflow-hidden border border-navy bg-[#cfc8b8]">
            {state.selfieThumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.selfieThumbnailUrl}
                alt=""
                className={`h-full w-full object-cover ${photoAnimate ? 'animate-field-fill' : ''}`}
              />
            ) : (
              <p className="flex h-full w-full items-center justify-center px-px text-center text-[3px] font-bold uppercase leading-[1.1] text-navy">
                {STICKER_LABELS.photoPlaceholder}
              </p>
            )}
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-0.5 text-[8px] uppercase tracking-wide">
            <Row label={STICKER_LABELS.name} value={state.applicantName || null} animKey="name" />
            <Row
              label={STICKER_LABELS.passport}
              value={state.instagramHandle ? `@${state.instagramHandle}` : null}
              animKey="passport"
            />
            <Row label={STICKER_LABELS.visaType} value={visa ? visa.name : null} animKey="visaType" />
            <Row label={STICKER_LABELS.serial} value={null} animKey="serial" />
            <Row label={STICKER_LABELS.reference} value={state.referenceCode} animKey="reference" span />
            <Row label={STICKER_LABELS.issued} value={null} animKey="issued" />
            <Row label={STICKER_LABELS.valid} value={null} animKey="valid" />
            <Row label={STICKER_LABELS.conditions} value={null} animKey="conditions" span />
          </div>
        </div>

        {/* Appointment slot: real funnel data, but deliberately outside the
            replicated sticker field grid above (it isn't one of the sticker's
            own fields) — set off with its own dashed divider so it reads as
            an addendum, not a stand-in for ISSUED. */}
        <div className="mt-1 flex items-baseline justify-between gap-1.5 border-t border-dashed border-navy/40 pt-1 text-[8px] uppercase tracking-wide">
          <span className="shrink-0 text-navy">{DOCUMENT_PROGRESS.appointmentLabel}</span>
          {state.slot ? (
            <span className={`truncate text-right font-bold text-navy ${appointmentAnimate ? 'animate-field-fill' : ''}`}>
              {state.slot}
            </span>
          ) : (
            <Blank />
          )}
        </div>

        <div className="barcode-mini mt-1.5" aria-hidden />
      </div>
    </div>
  )
}
