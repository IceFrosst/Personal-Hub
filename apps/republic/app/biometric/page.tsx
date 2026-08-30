'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { uploadPhoto } from '@/lib/api'
import { createThumbnail } from '@/lib/photo'
import { BIOMETRIC } from '@/lib/content'
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
    if (!state.visaType) {
      router.replace('/visa')
      return
    }
    if (!state.slot) {
      router.replace('/appointment')
    }
  }, [hydrated, state.visaType, state.slot, router])

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
    router.push('/processing')
  }

  if (!hydrated || !state.visaType || !state.slot) return null

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">
          {BIOMETRIC.heading}
        </h1>
        <p className="mt-2 text-center text-[11px] uppercase leading-relaxed tracking-wide text-navy/80">
          {BIOMETRIC.instruction}
        </p>

        <div className="relative mx-auto mt-5 flex h-56 w-44 items-center justify-center overflow-hidden border-2 border-navy bg-paper-dark">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={BIOMETRIC.photoAlt} className="h-full w-full object-cover" />
          ) : (
            <span className="px-3 text-center text-[10px] uppercase text-navy/40">{BIOMETRIC.noPhoto}</span>
          )}
          <div
            className="pointer-events-none absolute inset-4 rounded-[50%] border-2 border-dashed border-navy/50"
            aria-hidden
          />
        </div>

        {!preview ? (
          <label className="mt-5 block min-h-11 w-full cursor-pointer border-2 border-navy bg-navy py-3 text-center font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90">
            {BIOMETRIC.takePhoto}
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
              {BIOMETRIC.retake}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="min-h-11 flex-1 border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? BIOMETRIC.submitting : BIOMETRIC.submit}
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-[9px] uppercase leading-relaxed text-navy/40">
          {BIOMETRIC.purgeNotice}
        </p>
      </div>
      <Footer />
    </PageShell>
  )
}
