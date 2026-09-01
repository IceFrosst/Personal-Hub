'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { uploadPhoto } from '@/lib/api'
import { createThumbnail } from '@/lib/photo'
import { BIOMETRIC_NOTES, IDENTITY_VERIFICATION } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

export default function BiometricPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Same hydration race as /appointment: wait for the persisted session to
    // load before deciding whether to redirect.
    if (!hydrated) return
    // A visa selection isn't valid without its SERIAL № (see
    // lib/applicationContext.tsx#selectVisa) — a legacy/pre-migration
    // session with `visaType` but no `serial` is treated the same as having
    // no selection at all and must re-select rather than proceed with a
    // missing sticker field.
    if (!state.visaType || !state.serial) {
      router.replace('/visa')
      return
    }
    // Same invariant for the appointment slot: ISSUED is set in the same
    // context update as `slot` (see app/appointment/page.tsx), so a session
    // missing either one hasn't genuinely confirmed an appointment.
    if (!state.slot || !state.issuedDate) {
      router.replace('/appointment')
    }
  }, [hydrated, state.visaType, state.serial, state.slot, state.issuedDate, router])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPreview(typeof reader.result === 'string' ? reader.result : null)
      playBeep()
    }
    reader.readAsDataURL(file)
  }

  function retake() {
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!preview) return
    setSubmitting(true)
    const uploaded = await uploadPhoto(preview)
    const finalDataUrl = uploaded ?? preview
    // The thumbnail is what survives a refresh (see lib/applicationContext.tsx)
    // — best-effort; a failure here just means /visa-issued falls back to its
    // placeholder frame after a refresh instead of a restored photo.
    const thumbnail = await createThumbnail(finalDataUrl)
    update({ selfieDataUrl: finalDataUrl, selfieCaptured: true, selfieThumbnailUrl: thumbnail })
    addStamp('BIOMETRICS SUBMITTED')
    // Everyone gets secondary screening now — DATE applicants get the
    // confidence meter there instead of the IQ bell curve (they still never
    // see an IQ question; see app/screening/page.tsx).
    router.push('/screening')
  }

  if (!hydrated || !state.visaType || !state.serial || !state.slot || !state.issuedDate) return null

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">
          {IDENTITY_VERIFICATION.heading}
        </h1>
        <p className="mt-2 text-center text-[11px] uppercase leading-relaxed tracking-wide text-navy/80">
          {IDENTITY_VERIFICATION.instruction}
        </p>

        <div className="relative mx-auto mt-5 flex h-56 w-44 items-center justify-center overflow-hidden border-2 border-navy bg-paper-dark">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={IDENTITY_VERIFICATION.photoAlt} className="h-full w-full object-cover" />
          ) : (
            <span className="px-3 text-center text-[10px] uppercase text-navy/40">{IDENTITY_VERIFICATION.noPhoto}</span>
          )}
          <div
            className="pointer-events-none absolute inset-4 rounded-[50%] border-2 border-dashed border-navy/50"
            aria-hidden
          />
        </div>

        {/* Per-path officer observation — revealed only once a photo exists.
            Keyed by visa type (BIOMETRIC_NOTES); nothing is measured. */}
        {preview && state.visaType && (
          <p className="animate-fade-in mt-3 text-center text-[11px] font-bold uppercase tracking-wide text-stamp">
            {BIOMETRIC_NOTES[state.visaType]}
          </p>
        )}

        {!preview ? (
          <label className="mt-5 block min-h-11 w-full cursor-pointer border-2 border-navy bg-navy py-3 text-center font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90">
            {IDENTITY_VERIFICATION.takePhoto}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        ) : (
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={retake}
              className="min-h-11 flex-1 border-2 border-navy bg-paper py-3 font-stamp text-sm uppercase tracking-widest text-navy transition-colors hover:bg-navy hover:text-paper"
            >
              {IDENTITY_VERIFICATION.retake}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="min-h-11 flex-1 border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? IDENTITY_VERIFICATION.submitting : IDENTITY_VERIFICATION.submit}
            </button>
          </div>
        )}
      </div>
      <Footer />
    </PageShell>
  )
}
