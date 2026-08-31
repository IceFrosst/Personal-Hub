'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { StampSlam } from '@/components/StampSlam'
import { useApplication } from '@/lib/applicationContext'
import {
  APPROVED,
  STICKER_LABELS,
  CONSULATE_DM_URL,
  COPY_INSTRUCTION,
  COPY_FAILED_INSTRUCTION,
  VISA_BY_SLUG,
  buildReferenceLine,
} from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk } from '@/lib/sound'

const CANVAS_W = 900
const CANVAS_H = 560

function deriveSerial(referenceCode: string): string {
  let n = 0
  for (const ch of referenceCode) n = (n * 31 + ch.charCodeAt(0)) % 900000
  return `SN-${String(100000 + n).padStart(6, '0')}`
}

type CopyStatus = 'idle' | 'pending' | 'copied' | 'failed'

export default function VisaIssuedPage() {
  const router = useRouter()
  const { state, hydrated } = useApplication()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  const visa = state.visaType ? VISA_BY_SLUG[state.visaType] : null
  const serial = useMemo(() => (state.referenceCode ? deriveSerial(state.referenceCode) : ''), [state.referenceCode])
  const issueDate = useMemo(() => new Date().toLocaleDateString('en-GB'), [])
  const referenceLine = useMemo(
    () =>
      visa && state.referenceCode && state.slot
        ? buildReferenceLine({ visaType: visa.name, referenceCode: state.referenceCode, slot: state.slot })
        : null,
    [visa, state.referenceCode, state.slot]
  )

  useEffect(() => {
    // Same hydration race as the rest of the funnel — wait for context load
    // before deciding this is an invalid/incomplete session. Deliberately
    // checks `selfieCaptured` (persisted) rather than `selfieDataUrl` (never
    // persisted) — a finalized application (referenceCode + selfieCaptured)
    // must survive a refresh and stay on this page; only a genuinely
    // incomplete/invalid session bounces back to /visa.
    if (!hydrated) return
    if (!state.visaType || !state.slot || !state.referenceCode || !state.selfieCaptured) {
      router.replace('/visa')
      return
    }
    addStamp('VISA ISSUED')
    playStampThunk()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useEffect(() => {
    if (!visa || !state.referenceCode) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Prefer the full-resolution capture (only ever present within the same
    // session, never persisted); fall back to the small persisted thumbnail
    // after a refresh; if neither exists, skip the Image load entirely and
    // draw the "PHOTO ON FILE" placeholder frame straight away.
    const photoSrc = state.selfieDataUrl ?? state.selfieThumbnailUrl

    if (!photoSrc) {
      draw(ctx, null)
      setReady(true)
      return
    }

    const img = new Image()
    img.onload = () => {
      draw(ctx, img)
      setReady(true)
    }
    img.onerror = () => {
      draw(ctx, null)
      setReady(true)
    }
    img.src = photoSrc

    function draw(context: CanvasRenderingContext2D, photo: HTMLImageElement | null) {
      const NAVY = '#1a2a4a'
      const PAPER = '#f4f0e8'
      const GREEN = '#2e7d32'

      context.clearRect(0, 0, CANVAS_W, CANVAS_H)
      context.fillStyle = PAPER
      context.fillRect(0, 0, CANVAS_W, CANVAS_H)

      context.strokeStyle = NAVY
      context.lineWidth = 6
      context.strokeRect(10, 10, CANVAS_W - 20, CANVAS_H - 20)
      context.lineWidth = 1.5
      context.strokeRect(22, 22, CANVAS_W - 44, CANVAS_H - 44)

      context.fillStyle = NAVY
      context.textAlign = 'center'
      context.font = 'bold 34px "Courier New", monospace'
      context.fillText(STICKER_LABELS.republicTitle, CANVAS_W / 2, 66)
      context.font = '18px "Courier New", monospace'
      context.fillText(`${STICKER_LABELS.visaPrefix}${visa!.name}`, CANVAS_W / 2, 92)

      context.textAlign = 'left'

      // photo frame — square clip (was an ellipse; owner rejected the oval look)
      const photoX = 60
      const photoY = 130
      const photoW = 220
      const photoH = 280
      context.save()
      context.beginPath()
      context.rect(photoX, photoY, photoW, photoH)
      context.closePath()
      context.clip()
      if (photo) {
        const scale = Math.max(photoW / photo.width, photoH / photo.height)
        const drawW = photo.width * scale
        const drawH = photo.height * scale
        context.drawImage(
          photo,
          photoX + photoW / 2 - drawW / 2,
          photoY + photoH / 2 - drawH / 2,
          drawW,
          drawH
        )
      } else {
        context.fillStyle = '#cfc8b8'
        context.fillRect(photoX, photoY, photoW, photoH)
        context.fillStyle = NAVY
        context.textAlign = 'center'
        context.font = 'bold 15px "Courier New", monospace'
        context.fillText(STICKER_LABELS.photoPlaceholder, photoX + photoW / 2, photoY + photoH / 2, photoW - 24)
        context.textAlign = 'left'
      }
      context.restore()
      context.strokeStyle = NAVY
      context.lineWidth = 3
      context.strokeRect(photoX, photoY, photoW, photoH)

      // text block
      const textX = photoX + photoW + 36
      let ty = 140
      const line = (label: string, value: string, size = 15, gap = 27) => {
        context.font = `bold ${size}px "Courier New", monospace`
        context.fillStyle = NAVY
        context.fillText(label, textX, ty)
        ty += 19
        context.font = `${size}px "Courier New", monospace`
        context.fillText(value, textX, ty)
        ty += gap
      }
      line(STICKER_LABELS.name, state.applicantName.toUpperCase() || STICKER_LABELS.unknownName)
      line(STICKER_LABELS.passport, `@${state.instagramHandle}`)
      line(STICKER_LABELS.visaType, visa!.name)
      line(STICKER_LABELS.serial, serial)
      line(STICKER_LABELS.reference, state.referenceCode ?? '')
      line(STICKER_LABELS.issued, issueDate)
      line(STICKER_LABELS.valid, APPROVED.validValue)
      line(STICKER_LABELS.conditions, APPROVED.conditionsValue, 15, 0)

      // barcode
      context.save()
      let bx = 60
      const by = CANVAS_H - 70
      while (bx < CANVAS_W - 60) {
        const w = 1 + Math.floor(Math.random() * 3)
        context.fillStyle = NAVY
        context.fillRect(bx, by, w, 34)
        bx += w + 2 + Math.floor(Math.random() * 3)
      }
      context.restore()

      // APPROVED stamp, rotated, overlapping the photo edge
      context.save()
      context.translate(photoX + photoW - 20, photoY + photoH - 40)
      context.rotate(-0.25)
      context.globalAlpha = 0.88
      context.strokeStyle = GREEN
      context.lineWidth = 6
      context.strokeRect(-95, -34, 190, 68)
      context.fillStyle = GREEN
      context.font = 'bold 34px "Courier New", monospace'
      context.textAlign = 'center'
      context.fillText(APPROVED.stamp, 0, 12)
      context.restore()
    }
  }, [
    visa,
    state.selfieDataUrl,
    state.selfieThumbnailUrl,
    state.referenceCode,
    state.applicantName,
    state.instagramHandle,
    serial,
    issueDate,
  ])

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${APPROVED.filePrefix}${state.referenceCode ?? APPROVED.fallbackFileSlug}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  // Opens the DM thread FIRST, synchronously, in direct response to the click
  // — calling window.open() after an `await` breaks the user-gesture chain in
  // some browsers and gets silently popup-blocked. The clipboard write is
  // genuinely best-effort and never blocks or gates the navigation; its
  // result only changes the status message shown below (which never claims
  // success it didn't actually have).
  function handleProceed() {
    window.open(CONSULATE_DM_URL, '_blank', 'noopener,noreferrer')
    void copyReferenceLine()
  }

  async function copyReferenceLine() {
    if (!referenceLine) return
    setCopyStatus('pending')
    try {
      await navigator.clipboard.writeText(referenceLine)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  if (!hydrated || !visa || !state.slot || !state.referenceCode || !state.selfieCaptured) return null

  return (
    // Deliberately no `showProgress` here — the big visa sticker is the payoff
    // and should stand alone, not share the screen with the passport card.
    <PageShell>
      <div className="paper-card p-5 text-center">
        <div>
          <h1 className="font-stamp text-xl uppercase tracking-wide text-navy">{APPROVED.granted}</h1>
          <p className="mt-1 text-[11px] uppercase text-navy/60">
            {APPROVED.valid} {APPROVED.conditions}
          </p>
        </div>

        <div className="relative mt-4 overflow-hidden border-2 border-navy">
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="block w-full" />
          {!ready && <p className="p-6 text-[11px] uppercase text-navy/50">{APPROVED.rendering}</p>}
          {ready && (
            <div className="pointer-events-none absolute right-3 top-3">
              <StampSlam text={APPROVED.stamp} color="approve" rotate={10} className="!border-[4px] !px-3 !py-1 !text-base" />
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!ready}
            className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
          >
            {APPROVED.download}
          </button>
          <button
            type="button"
            onClick={handleProceed}
            className="min-h-11 w-full border-2 border-stamp bg-paper py-3 font-stamp text-sm uppercase tracking-widest text-stamp transition-all hover:bg-stamp hover:text-paper active:scale-[0.97]"
          >
            {APPROVED.proceed}
          </button>
          {copyStatus === 'copied' && (
            <p className="animate-fade-in text-[10px] uppercase leading-relaxed text-approve">{COPY_INSTRUCTION}</p>
          )}
          {copyStatus === 'failed' && referenceLine && (
            <div className="animate-fade-in text-[10px] uppercase leading-relaxed text-stamp">
              <p>{COPY_FAILED_INSTRUCTION}</p>
              <p className="mt-1 break-words font-bold text-navy">{referenceLine}</p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </PageShell>
  )
}
