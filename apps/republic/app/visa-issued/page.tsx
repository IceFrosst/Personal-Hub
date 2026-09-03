'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toPng } from 'html-to-image'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { FinalPassport } from '@/components/FinalPassport'
import { useApplication } from '@/lib/applicationContext'
import { isFinalizedApplicationState } from '@/lib/applicationState'
import {
  APPROVED,
  APPLICATION_STATUS_COPY,
  CONFIDENCE,
  DECISION_TIME_LABEL,
  adjustedConfidence,
  formatDecisionTime,
  DOCUMENT_PROGRESS,
  FULLY_EQUIPPED_STAMP,
  STICKER_LABELS,
  CONSULATE_DM_URL,
  COPY_INSTRUCTION,
  COPY_FAILED_INSTRUCTION,
  VISA_BY_SLUG,
  buildReferenceLine,
  formatPassportDate,
  formatPassportVisaName,
  isFullyEquipped,
  passportPhotoNote,
} from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk } from '@/lib/sound'
import { getScreeningAddenda, getVisaAddendum } from '@/lib/visaAddendum'
import { useApplicationStatus } from '@/lib/useApplicationStatus'

// DOWNLOAD VISA captures the REAL on-screen document (the DOM node, stamp
// overlay and all) via html-to-image at 3× pixel ratio — so the saved PNG is
// the same passport the applicant sees, by construction, and can never
// drift from it again (the old hand-drawn canvas mirror drifted repeatedly;
// owner complaint). The off-screen canvas below is kept ONLY as a
// best-effort fallback if DOM capture throws (some webviews are flaky with
// font/image embedding) — it approximates the design but is no longer the
// primary path, so don't spend effort keeping it pixel-perfect.
const CANVAS_W = 900
const CANVAS_H = 680

type CopyStatus = 'idle' | 'pending' | 'copied' | 'failed'

export default function VisaIssuedPage() {
  const router = useRouter()
  const { state, hydrated } = useApplication()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The visible passport (document + stamp overlay) — what DOWNLOAD captures.
  const documentRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  const visa = state.visaType ? VISA_BY_SLUG[state.visaType] : null
  const remoteStatus = useApplicationStatus(state.referenceCode, state.instagramHandle)
  // Until the narrow lookup succeeds, preserve the existing pending presentation.
  const decisionStatus = remoteStatus?.status ?? 'pending'
  const statusCopy = APPLICATION_STATUS_COPY[decisionStatus]
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
    if (!isFinalizedApplicationState(state)) {
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
      const STAMP_INK =
        decisionStatus === 'approved' ? '#2e7d32' : decisionStatus === 'denied' ? '#c0392b' : '#d97706'
      const addendumValues = [
        ...(state.visaType === 'special' && state.specialOtherness
          ? [{ label: DOCUMENT_PROGRESS.othernessLabel, value: state.specialOtherness }]
          : []),
        ...(visaAddendum ? [visaAddendum] : []),
        // IQ is rendered beside SEX in the field grid, not as an addendum.
        ...screeningAddenda.filter((item) => !item.imageSrc),
        ...(state.visaType === 'fiance' && state.dateDecisionSeconds !== null
          ? [{ label: DECISION_TIME_LABEL, value: formatDecisionTime(state.dateDecisionSeconds) }]
          : []),
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

      // Single border — the thin inner outline was removed (owner request).
      context.strokeStyle = NAVY
      context.lineWidth = 6
      context.strokeRect(10, 10, CANVAS_W - 20, documentHeight - 20)

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
      cell(STICKER_LABELS.passport, state.instagramHandle, colBx, rightColWidth)
      rowY += rowGap
      cell('VISA:', formatPassportVisaName(visa!.name), colAx, leftColWidth)
      cell(STICKER_LABELS.other, passportPhotoNote(visa!.slug), colBx, rightColWidth)
      rowY += rowGap
      cell(STICKER_LABELS.sex, state.gender ?? '—', colAx, leftColWidth)
      if (state.declaredConfidence !== null) {
        cell(
          CONFIDENCE.passportLabel,
          `${adjustedConfidence(state.declaredConfidence)}${CONFIDENCE.adjustedSuffix}`,
          colBx,
          rightColWidth
        )
      }
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
      rowY += rowGap
      cell(DOCUMENT_PROGRESS.appointmentLabel, formatPassportDate(state.slot ?? ''), colAx, fullWidth)
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

      // FULLY EQUIPPED corner stamp (every canonical sidequest supply declared)
      if (state.visaType === 'tourist' && isFullyEquipped(state.sidequestSupplies)) {
        context.save()
        context.translate(CANVAS_W - 150, documentHeight - 100)
        context.rotate(-0.12)
        context.globalAlpha = 0.9
        context.strokeStyle = '#2e7d32'
        context.lineWidth = 4
        context.strokeRect(-105, -20, 210, 40)
        context.fillStyle = '#2e7d32'
        context.font = 'bold 18px "Courier New", monospace'
        context.textAlign = 'center'
        context.fillText(FULLY_EQUIPPED_STAMP, 0, 6)
        context.restore()
      }

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

      // Decision stamp in the top-right, with the issue date inside it
      // (matching the DOM stamp) — scaled 1.5× per owner and re-centered so
      // it stays inside the document border.
      context.save()
      context.translate(CANVAS_W - 255, 96)
      context.rotate(-0.16)
      context.globalAlpha = 0.9
      context.strokeStyle = STAMP_INK
      context.lineWidth = 6
      context.strokeRect(-217, -51, 435, 102)
      context.fillStyle = STAMP_INK
      context.font = 'bold 34px "Courier New", monospace'
      context.textAlign = 'center'
      context.fillText(statusCopy.stamp, 0, 5)
      context.font = 'bold 18px "Courier New", monospace'
      context.fillText(issueDate, 0, 33)
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
    state.visaType,
    state.specialOtherness,
    state.sidequestSupplies,
    state.declaredConfidence,
    state.declaredIq,
    state.dateDecisionSeconds,
    decisionStatus,
    statusCopy.stamp,
  ])

  async function handleDownload() {
    const filename = `${APPROVED.filePrefix}${state.referenceCode ?? APPROVED.fallbackFileSlug}.png`
    // Primary: capture the exact document being displayed (with the stamp
    // overlay). Fallback: the legacy canvas approximation.
    try {
      const node = documentRef.current
      if (!node) throw new Error('document node missing')
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        backgroundColor: '#f4f0e8',
        // Skip the browser's font shorthand quirks by letting the library
        // embed the same webfonts the page already loaded.
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.download = filename
      link.href = dataUrl
      link.click()
      return
    } catch {
      // fall through to canvas
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = filename
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

  if (!hydrated || !visa || !isFinalizedApplicationState(state)) return null

  return (
    // Deliberately no `showProgress` here — the final document is the payoff
    // and should stand alone, not share the screen with the (now-redundant)
    // mid-funnel progress card.
    <PageShell>
      {/* No outer paper-card outline here. -mx-0.5 pulls the passport 2px
          into PageShell's px-4, leaving ~14px of screen-edge gap per side —
          another 30% narrower than the previous ~20px (owner request). */}
      <div className="-mx-0.5 text-center">
        <div>
          <h1 className="font-stamp text-xl uppercase tracking-wide text-navy">{statusCopy.issuedHeading}</h1>
          <p
            className={`mt-1 text-[11px] font-bold uppercase ${
              decisionStatus === 'approved'
                ? 'text-approve'
                : decisionStatus === 'denied'
                  ? 'text-stamp'
                  : 'text-[#d97706]'
            }`}
          >
            {statusCopy.issuedStatus}
          </p>
          <p className="text-[10px] uppercase text-navy/50">{statusCopy.issuedNote}</p>
        </div>

        {/* The shared final-passport presentation (components/FinalPassport.tsx)
            — wrapper, VisaDocument, photo selection and the decision
            StampSlam all in one place, also used by the landing's
            returning-applicant state (app/page.tsx). `documentRef` forwards
            to its root node so DOWNLOAD VISA's DOM capture (html-to-image,
            see the file header comment) keeps capturing the exact document
            rendered here, stamp overlay and all. */}
        <FinalPassport ref={documentRef} state={state} stampText={statusCopy.stamp} stampColor={statusCopy.stampColor} />

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
