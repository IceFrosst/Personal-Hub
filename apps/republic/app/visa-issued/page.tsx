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
  formatPassportDate,
  formatPassportVisaName,
  iqFaceFor,
} from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk } from '@/lib/sound'
import { getScreeningAddenda, getVisaAddendum } from '@/lib/visaAddendum'

// The downloadable PNG is composited on an off-screen canvas at a fixed
// resolution — kept entirely for the DOWNLOAD VISA button (canvas.toDataURL);
// the on-screen document itself is the DOM <VisaDocument size="full"> below,
// not this canvas, so it renders crisp at any zoom/DPI and shares its exact
// structure with the progress card (see components/VisaDocument.tsx). The
// canvas mirrors the same layout: larger photo; NAME + PASSPORT, unbolded
// VISA: + bold short name and VALID, compact appointment DATE, SEX + smaller
// borderless IQ number/image; orange pending stamp with today's date. No
// SERIAL, ISSUED or REFERENCE №. The downloaded image matches the on-screen design as closely as a canvas
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
  // The issue date is generated earlier at appointment confirmation and
  // stored in context, so it is read straight from state rather than
  // recomputed. SERIAL still exists as an internal application invariant
  // (guards require it) but is no longer printed anywhere on the passport.
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
    // The declared-IQ wojak face stamped beside the IQ addendum line — same
    // asset the on-screen documents show, so the PNG can't disagree.
    const faceSrc = screeningAddenda.find((item) => item.imageSrc)?.imageSrc ?? null

    const loadImage = (src: string | null) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        if (!src) {
          resolve(null)
          return
        }
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = src
      })

    let cancelled = false
    void Promise.all([loadImage(photoSrc), loadImage(faceSrc)]).then(([photo, face]) => {
      if (cancelled) return
      draw(ctx, photo, face)
      setReady(true)
    })

    function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
      if (context.measureText(text).width <= maxWidth) return text
      let truncated = text
      while (truncated.length > 1 && context.measureText(`${truncated}…`).width > maxWidth) {
        truncated = truncated.slice(0, -1)
      }
      return `${truncated}…`
    }

    function draw(
      context: CanvasRenderingContext2D,
      photo: HTMLImageElement | null,
      face: HTMLImageElement | null
    ) {
      const NAVY = '#1a2a4a'
      const PAPER = '#f4f0e8'
      const ORANGE = '#d97706'
      const addendumValues = [
        ...(visaAddendum ? [visaAddendum] : []),
        // IQ is rendered beside SEX in the field grid, not as an addendum.
        ...screeningAddenda.filter((item) => !item.imageSrc),
        ...(state.dutyFreeItems.length
          ? [{ label: DOCUMENT_PROGRESS.dutyFreeLabel, value: state.dutyFreeItems.join(' · ') }]
          : []),
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
      const documentHeight = Math.max(
        CANVAS_H,
        535 +
          wrappedAddenda.reduce(
            (height, item) => height + Math.max(37 + item.lines.length * 20, item.imageSrc ? 62 : 0),
            0
          )
      )
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
      // No visa subtitle, SERIAL № or issue-date corner. Today's issue date
      // is printed inside the orange PENDING APPROVAL stamp below.
      context.textAlign = 'left'

      // photo frame — rectangular clip at the capture's ORIGINAL aspect
      // ratio (owner request — no square crop of the human): fixed height,
      // width from the image's own ratio, clamped so an extreme capture
      // can't crowd the field grid. Placeholder box stays portrait-ish.
      const photoX = 60
      const photoY = 115
      const photoH = 260
      const photoW = photo
        ? Math.max(150, Math.min(300, Math.round(photoH * (photo.width / photo.height))))
        : 170
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

      // Unequal two-column grid, same as DOM: NAME + PASSPORT, VISA: + short
      // selected name + VALID, compact appointment DATE full-width, SEX + IQ.
      const gridX = photoX + photoW + 36
      const gridRight = CANVAS_W - 40
      const colGap = 24
      const availableWidth = gridRight - gridX - colGap
      const leftColWidth = availableWidth * 0.39
      const rightColWidth = availableWidth - leftColWidth
      const fullWidth = gridRight - gridX
      const colAx = gridX
      const colBx = gridX + leftColWidth + colGap
      const rowGap = 58
      let rowY = 135

      const cell = (label: string, value: string, x: number, width: number) => {
        context.font = '12px "Courier New", monospace'
        context.fillStyle = NAVY
        context.fillText(label, x, rowY)
        context.font = 'bold 15px "Courier New", monospace'
        context.fillText(fitText(context, value, width), x, rowY + 20)
      }

      cell(STICKER_LABELS.name, state.applicantName.toUpperCase() || STICKER_LABELS.unknownName, colAx, leftColWidth)
      cell(STICKER_LABELS.passport, `@${state.instagramHandle}`, colBx, rightColWidth)
      rowY += rowGap
      cell('VISA:', formatPassportVisaName(visa!.name), colAx, leftColWidth)
      cell(STICKER_LABELS.valid, APPROVED.validValue, colBx, rightColWidth)
      rowY += rowGap
      cell(DOCUMENT_PROGRESS.appointmentLabel, formatPassportDate(state.slot ?? ''), colAx, fullWidth)
      rowY += rowGap
      cell(STICKER_LABELS.sex, state.gender ?? '—', colAx, leftColWidth)
      if (state.declaredIq !== null) {
        const size = 24
        const sx = colBx
        const sy = rowY - 13
        context.fillStyle = NAVY
        context.font = 'bold 12px "Courier New", monospace'
        context.fillText('IQ:', sx, rowY + 10)
        context.font = 'bold 15px "Courier New", monospace'
        context.fillText(String(state.declaredIq), sx + 28, rowY + 10)
        if (face) {
          const imageX = sx + 64
          context.fillStyle = PAPER
          context.fillRect(imageX, sy, size, size)
          context.drawImage(face, imageX, sy, size, size)
        }
      }
      // CONDITIONS row and its "bring snacks" gag were removed entirely.

      // Appointment + visa-specific answer addenda. These are outside the
      // sticker field grid, with the same dashed-divider treatment as the DOM
      // document, and are included in the PNG rather than being screen-only.
      let addendumY = Math.max(rowY + 54, photoY + photoH + 25)
      const addendum = (label: string, lines: string[], stamp?: HTMLImageElement | null) => {
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
        if (stamp) {
          // Small bordered wojak stamp, right-aligned on the addendum row —
          // mirrors the bordered <img> treatment in components/VisaDocument.tsx.
          const size = 52
          const sx = CANVAS_W - 60 - size
          const sy = addendumY - 8
          context.fillStyle = PAPER
          context.fillRect(sx, sy, size, size)
          const scale = Math.min(size / stamp.width, size / stamp.height)
          const dw = stamp.width * scale
          const dh = stamp.height * scale
          context.drawImage(stamp, sx + (size - dw) / 2, sy + (size - dh) / 2, dw, dh)
          context.strokeStyle = NAVY
          context.lineWidth = 1.5
          context.strokeRect(sx, sy, size, size)
          context.fillStyle = NAVY
        }
        addendumY += Math.max(37 + lines.length * 20, stamp ? 62 : 0)
      }
      wrappedAddenda.forEach((item) => addendum(item.label, item.lines, item.imageSrc ? face : null))

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

      // Orange PENDING APPROVAL stamp in the top-right, with today's issue
      // date inside it (matching the DOM stamp).
      context.save()
      context.translate(CANVAS_W - 175, 82)
      context.rotate(-0.16)
      context.globalAlpha = 0.9
      context.strokeStyle = ORANGE
      context.lineWidth = 6
      context.strokeRect(-145, -34, 290, 68)
      context.fillStyle = ORANGE
      context.font = 'bold 23px "Courier New", monospace'
      context.textAlign = 'center'
      context.fillText(APPROVED.stamp, 0, 3)
      context.font = 'bold 12px "Courier New", monospace'
      context.fillText(issueDate, 0, 22)
      context.restore()
    }

    return () => {
      cancelled = true
    }
  }, [
    visa,
    state.selfieDataUrl,
    state.selfieThumbnailUrl,
    state.referenceCode,
    state.applicantName,
    state.instagramHandle,
    issueDate,
    state.slot,
    state.gender,
    visaAddendum,
    screeningAddenda,
    state.dutyFreeItems,
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

  // Same sticker fields, same order, as components/DocumentProgress.tsx —
  // every one of them is guaranteed complete by the guard above, so nothing
  // here ever renders a blank/ruled row (unlike the mid-funnel progress
  // card, which shows blanks for fields not filled in yet).
  const fields: VisaDocumentField[] = [
    { key: 'name', label: STICKER_LABELS.name, value: state.applicantName.toUpperCase() || STICKER_LABELS.unknownName },
    { key: 'passport', label: STICKER_LABELS.passport, value: `@${state.instagramHandle}` },
    { key: 'visaType', label: 'VISA:', value: formatPassportVisaName(visa.name) },
    { key: 'valid', label: STICKER_LABELS.valid, value: APPROVED.validValue },
    {
      key: 'appointment',
      label: DOCUMENT_PROGRESS.appointmentLabel,
      value: formatPassportDate(state.slot),
      span: true,
    },
    { key: 'sex', label: STICKER_LABELS.sex, value: state.gender ?? '—' },
    ...(state.declaredIq !== null
      ? [{
          key: 'iq',
          label: 'IQ:',
          value: String(state.declaredIq),
          imageSrc: iqFaceFor(state.declaredIq).src,
          imageAlt: iqFaceFor(state.declaredIq).alt,
        }]
      : []),
  ]
  const addenda: VisaDocumentAddendum[] = []
  if (visaAddendum) {
    addenda.push({ key: 'subStep', label: visaAddendum.label, value: visaAddendum.value })
  }
  // IQ is beside SEX in the field grid; only non-image screening content
  // remains below as an addendum.
  screeningAddenda.filter((item) => !item.imageSrc).forEach((item, index) => {
    addenda.push({
      key: `screening-${index}`,
      label: item.label,
      value: item.value,
    })
  })
  if (state.dutyFreeItems.length) {
    addenda.push({
      key: 'duty-free',
      label: DOCUMENT_PROGRESS.dutyFreeLabel,
      value: state.dutyFreeItems.join(' · '),
    })
  }

  return (
    // Deliberately no `showProgress` here — the final document is the payoff
    // and should stand alone, not share the screen with the (now-redundant)
    // mid-funnel progress card.
    <PageShell>
      {/* No outer paper-card outline here — the VisaDocument already has its
          own double border. A light px-3 inset makes the passport slightly
          wider than before without running edge-to-edge across the screen. */}
      <div className="px-3 text-center">
        <div>
          <h1 className="font-stamp text-xl uppercase tracking-wide text-navy">{APPROVED.granted}</h1>
          <p className="mt-1 text-[11px] uppercase text-navy/60">{APPROVED.valid}</p>
        </div>

        <div className="relative mt-4">
          <VisaDocument
            size="full"
            photoUrl={state.selfieDataUrl ?? state.selfieThumbnailUrl}
            fields={fields}
            addenda={addenda}
          />
          <div className="pointer-events-none absolute -right-2 -top-2">
            <StampSlam
              text={APPROVED.stamp}
              subtext={issueDate}
              color="pending"
              rotate={10}
              className="!border-[4px] !px-3 !py-1 !text-sm"
            />
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
