'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { uploadPhoto } from '@/lib/api'
import { createThumbnail } from '@/lib/photo'
import { IDENTITY_VERIFICATION } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

// The selfie camera starts LIVE and front-facing the moment this page opens
// (owner request) — getUserMedia with `facingMode: 'user'`, previewed
// mirrored like every native selfie camera, captured mirrored too so the
// photo matches what the applicant saw. If getUserMedia is unavailable or
// denied, it falls back to the old `<input type="file" capture="user">`
// flow, which defers to the OS camera app instead of failing the step.
export default function BiometricPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cameraState, setCameraState] = useState<'starting' | 'live' | 'fallback'>('starting')
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const funnelValid = Boolean(state.visaType && state.serial && state.slot && state.issuedDate)

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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setCameraState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // play() can reject on quick unmounts — harmless, so swallowed.
        void videoRef.current.play().catch(() => {})
      }
      setCameraState('live')
    } catch {
      // Permission denied / no camera / insecure context — fall back to the
      // file-input flow rather than blocking the funnel.
      setCameraState('fallback')
    }
  }, [])

  // Auto-start the front camera as soon as this page is genuinely active
  // (hydrated, valid session, nothing captured yet); stop it on unmount.
  useEffect(() => {
    if (!hydrated || !funnelValid || preview) return
    void startCamera()
    return stopCamera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, funnelValid, preview])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror the capture to match the mirrored live preview.
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    setPreview(canvas.toDataURL('image/jpeg', 0.92))
    playBeep()
    stopCamera()
  }

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
    // The auto-start effect above re-fires once `preview` clears.
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
    // DATE VISA applicants skip the IQ self-assessment (owner request — the
    // Ministry does not test what it already suspects) and go straight to
    // processing; everyone else gets secondary screening.
    router.push(state.visaType === 'fiance' ? '/processing' : '/screening')
  }

  if (!hydrated || !funnelValid) return null

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
          ) : cameraState === 'fallback' ? (
            <span className="px-3 text-center text-[10px] uppercase text-navy/40">{IDENTITY_VERIFICATION.noPhoto}</span>
          ) : (
            // Live front-camera feed, mirrored like a native selfie camera.
            // Mounted for both 'starting' and 'live' so the stream has an
            // element to attach to the moment getUserMedia resolves.
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full -scale-x-100 object-cover"
            />
          )}
          <div
            className="pointer-events-none absolute inset-4 rounded-[50%] border-2 border-dashed border-navy/50"
            aria-hidden
          />
        </div>

        {!preview ? (
          cameraState === 'fallback' ? (
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
            <button
              type="button"
              onClick={capture}
              disabled={cameraState !== 'live'}
              className="mt-5 block min-h-11 w-full border-2 border-navy bg-navy py-3 text-center font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {IDENTITY_VERIFICATION.takePhoto}
            </button>
          )
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
