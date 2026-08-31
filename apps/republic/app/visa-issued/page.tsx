'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { StampSlam } from '@/components/StampSlam'
import { VisaDocument, type VisaDocumentAddendum, type VisaDocumentField } from '@/components/VisaDocument'
import { useApplication } from '@/lib/applicationContext'
import {
  APPROVED,
  DOCUMENT_PROGRESS,
  STICKER_LABELS,
  CONSULATE_DM_URL,
  COPY_INSTRUCTION,
  COPY_FAILED_INSTRUCTION,
  VISA_BY_SLUG,
  buildReferenceLine,
} from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk } from '@/lib/sound'
import { getScreeningAddenda, getVisaAddendum } from '@/lib/visaAddendum'

// The downloadable PNG is composited on an off-screen canvas at a fixed
// resolution — kept entirely for the DOWNLOAD VISA button (canvas.toDataURL);
// the on-screen document itself is the DOM <VisaDocument size="full"> below,
// not this canvas, so it renders crisp at any zoom/DPI and shares its exact
// structure with the progress card (see components/VisaDocument.tsx). The
// canvas's own field layout mirrors the same two-column grid order (NAME +
// PASSPORT, VISA TYPE + SERIAL №, REFERENCE № full-width, ISSUED + VALID,
// CONDITIONS full-width) instead of the old single vertical list, so the
// downloaded image matches the on-screen design as closely as a canvas
// practically can.
const CANVAS_W = 900
const CANVAS_H = 680

type CopyStatus = 'idle' | 'pending' | 'copied' | 'failed'

export default function VisaIssuedPage() {
  const router = useRouter()
  const { state, hydrated } = useApplication()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  const visa = state.visaType ? VISA_BY_SLUG[state.visaType] : null
  // SERIAL № and ISSUED are both generated earlier in the funnel (visa
  // selection and appointment confirmation respectively — see
  // applicationContext.tsx) and stored in context, so they're read straight
  // from state here rather than recomputed, guaranteeing this document shows
  // the exact same values the progress card already displayed. Deliberately
  // no fallback/recompute for either — the guards below require both
  // `state.serial` and `state.issuedDate` before this page renders at all,
  // so a session missing either is bounced back to /visa instead of ever
  // reaching a document that would have to synthesize an unpersisted value.
  const serial = state.serial ?? ''
  const issueDate = state.issuedDate ?? ''
  const visaAddendum = useMemo(() => getVisaAddendum(state), [state])
  const screeningAddenda = useMemo(() => getScreeningAddenda(state), [state])
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
    if (
      !state.visaType ||
      !state.serial ||
      !state.slot ||
      !state.issuedDate ||
      !state.referenceCode ||
      !state.selfieCaptured
    ) {
      router.replace('/visa')
      return
    }
    addStamp('VISA ISSUED')
    playStampThunk()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  // Draws the DOWNLOADABLE image onto an off-screen canvas (see the file
  // header comment) — this effect has no effect on what's visibly on
  // screen, only on what DOWNLOAD VISA saves.
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

    function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
      if (context.measureText(text).width <= maxWidth) return text
      let truncated = text
      while (truncated.length > 1 && context.measureText(`${truncated}…`).width > maxWidth) {
        truncated = truncated.slice(0, -1)
      }
      return `${truncated}…`
    }

    function draw(context: CanvasRenderingContext2D, photo: HTMLImageElement | null) {
      const NAVY = '#1a2a4a'
      const PAPER = '#f4f0e8'
      const GREEN = '#2e7d32'
      const addendumValues = [
        { label: DOCUMENT_PROGRESS.appointmentLabel, value: state.slot ?? '' },
        ...(visaAddendum ? [visaAddendum] : []),
        ...screeningAddenda,
      ]

      const wrapText = (text: string, maxWidth: number): string[] => {
        const lines: string[] = []
        let line = ''
        for (const word of text.split(/\s+/).filter(Boolean)) {
          const candidate = line ? `${line} ${word}` : word
          if (context.measureText(candidate).width <= maxWidth) {
            line = candidate
            continue
          }
          if (line) lines.push(line)
          if (context.measureText(word).width <= maxWidth) {
            line = word
            continue
          }
          // Preserve even an unbroken user-entered token rather than
          // ellipsizing it: split it at the last character that fits.
          let chunk = ''
          for (const char of word) {
            if (chunk && context.measureText(chunk + char).width > maxWidth) {
              lines.push(chunk)
              chunk = char
            } else {
              chunk += char
            }
          }
          line = chunk
        }
        if (line || lines.length === 0) lines.push(line)
        return lines
      }

      context.font = '15px "Courier New", monospace'
      const wrappedAddenda = addendumValues.map((item) => ({
        ...item,
        lines: wrapText(item.value, CANVAS_W - 120),
      }))
      const documentHeight = Math.max(CANVAS_H, 535 + wrappedAddenda.reduce((height, item) => height + 37 + item.lines.length * 20, 0))
      if (context.canvas.height !== documentHeight) context.canvas.height = documentHeight

      context.clearRect(0, 0, CANVAS_W, documentHeight)
      context.fillStyle = PAPER
      context.fillRect(0, 0, CANVAS_W, documentHeight)

      context.strokeStyle = NAVY
      context.lineWidth = 6
      context.strokeRect(10, 10, CANVAS_W - 20, documentHeight - 20)
      context.lineWidth = 1.5
      context.strokeRect(22, 22, CANVAS_W - 44, documentHeight - 44)

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
      const photoH = 220
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

      // Two-column field grid, same order as the DOM VisaDocument/progress
      // card — NAME + PASSPORT, VISA TYPE + SERIAL, REFERENCE (full width),
      // ISSUED + VALID, CONDITIONS (full width).
      const gridX = photoX + photoW + 36
      const gridRight = CANVAS_W - 40
      const colGap = 24
      const colWidth = (gridRight - gridX - colGap) / 2
      const colAx = gridX
      const colBx = gridX + colWidth + colGap
      const fullWidth = gridRight - gridX
      const rowGap = 58
      let rowY = 150

      const cell = (label: string, value: string, x: number, width: number) => {
        context.font = 'bold 12px "Courier New", monospace'
        context.fillStyle = NAVY
        context.fillText(label, x, rowY)
        context.font = '15px "Courier New", monospace'
        context.fillText(fitText(context, value, width), x, rowY + 20)
      }

      cell(STICKER_LABELS.name, state.applicantName.toUpperCase() || STICKER_LABELS.unknownName, colAx, colWidth)
      cell(STICKER_LABELS.passport, `@${state.instagramHandle}`, colBx, colWidth)
      rowY += rowGap
      cell(STICKER_LABELS.visaType, visa!.name, colAx, colWidth)
      cell(STICKER_LABELS.serial, serial, colBx, colWidth)
      rowY += rowGap
      cell(STICKER_LABELS.reference, state.referenceCode ?? '', colAx, fullWidth)
      rowY += rowGap
      cell(STICKER_LABELS.issued, issueDate, colAx, colWidth)
      cell(STICKER_LABELS.valid, APPROVED.validValue, colBx, colWidth)
      rowY += rowGap
      cell(STICKER_LABELS.conditions, APPROVED.conditionsValue, colAx, fullWidth)

      // Appointment + visa-specific answer addenda. These are outside the
      // sticker field grid, with the same dashed-divider treatment as the DOM
      // document, and are included in the PNG rather than being screen-only.
      let addendumY = rowY + 54
      const addendum = (label: string, lines: string[]) => {
        context.save()
        context.setLineDash([7, 5])
        context.strokeStyle = NAVY
        context.globalAlpha = 0.45
        context.beginPath()
        context.moveTo(60, addendumY - 17)
        context.lineTo(CANVAS_W - 60, addendumY - 17)
        context.stroke()
        context.restore()
        context.fillStyle = NAVY
        context.font = 'bold 12px "Courier New", monospace'
        context.fillText(label, 60, addendumY)
        context.font = '15px "Courier New", monospace'
        lines.forEach((line, index) => context.fillText(line, 60, addendumY + 20 + index * 20))
        addendumY += 37 + lines.length * 20
      }
      wrappedAddenda.forEach((item) => addendum(item.label, item.lines))

      // barcode
      context.save()
      let bx = 60
      const by = documentHeight - 70
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
    state.slot,
    visaAddendum,
    screeningAddenda,
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

  if (
    !hydrated ||
    !visa ||
    !state.serial ||
    !state.slot ||
    !state.issuedDate ||
    !state.referenceCode ||
    !state.selfieCaptured
  )
    return null

  // Same 8 sticker fields, same order, as components/DocumentProgress.tsx —
  // every one of them is guaranteed complete by the guard above, so nothing
  // here ever renders a blank/ruled row (unlike the mid-funnel progress
  // card, which shows blanks for fields not filled in yet).
  const fields: VisaDocumentField[] = [
    { key: 'name', label: STICKER_LABELS.name, value: state.applicantName.toUpperCase() || STICKER_LABELS.unknownName },
    { key: 'passport', label: STICKER_LABELS.passport, value: `@${state.instagramHandle}` },
    { key: 'visaType', label: STICKER_LABELS.visaType, value: visa.name },
    { key: 'serial', label: STICKER_LABELS.serial, value: serial },
    { key: 'reference', label: STICKER_LABELS.reference, value: state.referenceCode, span: true },
    { key: 'issued', label: STICKER_LABELS.issued, value: issueDate },
    { key: 'valid', label: STICKER_LABELS.valid, value: APPROVED.validValue },
    { key: 'conditions', label: STICKER_LABELS.conditions, value: APPROVED.conditionsValue, span: true },
  ]
  const addenda: VisaDocumentAddendum[] = [
    { key: 'appointment', label: DOCUMENT_PROGRESS.appointmentLabel, value: state.slot },
  ]
  if (visaAddendum) {
    addenda.push({ key: 'subStep', label: visaAddendum.label, value: visaAddendum.value })
  }
  screeningAddenda.forEach((item, index) => {
    addenda.push({ key: `screening-${index}`, label: item.label, value: item.value })
  })

  return (
    // Deliberately no `showProgress` here — the final document is the payoff
    // and should stand alone, not share the screen with the (now-redundant)
    // mid-funnel progress card.
    <PageShell>
      <div className="paper-card p-5 text-center">
        <div>
          <h1 className="font-stamp text-xl uppercase tracking-wide text-navy">{APPROVED.granted}</h1>
          <p className="mt-1 text-[11px] uppercase text-navy/60">
            {APPROVED.valid} {APPROVED.conditions}
          </p>
        </div>

        <div className="relative mt-4">
          <VisaDocument
            size="full"
            visaName={visa.name}
            photoUrl={state.selfieDataUrl ?? state.selfieThumbnailUrl}
            fields={fields}
            addenda={addenda}
          />
          <div className="pointer-events-none absolute -right-2 -top-2">
            <StampSlam text={APPROVED.stamp} color="approve" rotate={10} className="!border-[4px] !px-3 !py-1 !text-base" />
          </div>
        </div>

        {/* Off-screen — used only to produce the DOWNLOAD VISA PNG, see the
            file header comment. Not part of the on-screen document. */}
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="hidden" aria-hidden />

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
