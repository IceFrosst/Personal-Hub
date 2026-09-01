import { STICKER_LABELS } from '@/lib/content'

// Shared presentational structure for BOTH the persistent progress card
// (components/DocumentProgress.tsx, compact, sticky, shown throughout the
// funnel) and the final on-screen /visa-issued document (full size, all
// fields complete) — the "same document, being filled in / then finished"
// pair the two are meant to be. Extracted here specifically to prevent the
// two from drifting apart in border/header/photo/grid/barcode treatment;
// see CLAUDE.md's DocumentProgress + visa-issued Gotchas.
//
// Deliberately dumb/presentational — no hooks, no context, no animation
// logic. Callers compute field values AND whether a field should play its
// one-time reveal animation (DocumentProgress uses
// components/DocumentProgress.tsx's own useRevealAnimation hook per field;
// /visa-issued's final document never animates, everything is already
// filled) and pass the result in as plain data. This keeps the component
// safe to render with zero hooks itself, so callers stay free to call their
// own hooks in whatever order/count they need without any Rules-of-Hooks
// conflict.

export interface VisaDocumentField {
  key: string
  label: string
  value: string | null
  /** Optional inline image (the IQ wojak face beside SEX in column 2). */
  imageSrc?: string
  imageAlt?: string
  /** Full-width field across both columns. */
  span?: boolean
  animate?: boolean
}

export interface VisaDocumentAddendum {
  key: string
  label: string
  value: string | null
  /** Optional small stamp image (e.g. the declared-IQ wojak face) shown beside the value. */
  imageSrc?: string
  imageAlt?: string
  animate?: boolean
}

export interface VisaDocumentProps {
  size: 'compact' | 'full'
  photoUrl?: string | null
  photoAnimate?: boolean
  /** In the sticker's own order — see the two-column layout note above each caller. */
  fields: VisaDocumentField[]
  /** Real funnel data that isn't one of the sticker's own fields (sub-step content, screening, duty-free) — rendered below the grid with its own dashed divider. */
  addenda?: VisaDocumentAddendum[]
  /** Optional rotated corner stamp (e.g. FULLY EQUIPPED for a fully-supplied sidequest). */
  cornerStamp?: string
}

// Single border now — the old thin inner outline was removed (owner request)
// so the fields get its padding + border back as usable text width.
const SIZE = {
  compact: {
    wrap: 'p-2',
    title: 'text-[9px]',
    photo: 'h-14',
    photoBlank: 'w-11',
    photoText: 'text-[3px]',
    photoGap: 'gap-1.5',
    grid: 'text-[8px] gap-x-2 gap-y-0.5',
    addendum: 'text-[8px]',
    barcodeClass: 'barcode-mini',
    barcodeGap: 'mt-1.5',
    blankNarrow: 'w-9',
    blankWide: 'w-16',
  },
  // Full is the SAME arrangement as compact, just scaled up — label + value
  // on one line per row, photo beside the grid. It used to stack each label
  // above its value with big row gaps, which stretched the final document
  // vertically into something that no longer resembled the card the visitor
  // watched fill in all funnel long; owner asked for them to match.
  full: {
    // p-2.5 + gap-1.5: fields sit closer to the photo and everything shifts
    // left, buying the right column enough room (owner request).
    wrap: 'p-2.5',
    title: 'text-base',
    photo: 'h-24',
    photoBlank: 'w-20',
    photoText: 'text-[8px] px-1',
    photoGap: 'gap-1.5',
    grid: 'text-[11px] gap-x-2 gap-y-1.5',
    addendum: 'text-[11px]',
    barcodeClass: 'barcode',
    barcodeGap: 'mt-3',
    blankNarrow: 'w-12',
    blankWide: 'w-24',
  },
} as const

function Blank({ wide, size }: { wide?: boolean; size: 'compact' | 'full' }) {
  const s = SIZE[size]
  return <span className={`inline-block h-2 border-b border-navy/30 ${wide ? s.blankWide : s.blankNarrow}`} aria-hidden />
}

export function VisaDocument({ size, photoUrl, photoAnimate, fields, addenda, cornerStamp }: VisaDocumentProps) {
  const s = SIZE[size]

  return (
    <div className={`relative border-2 border-navy bg-paper ${s.wrap} shadow-[2px_2px_0_rgba(26,42,74,0.15)]`}>
      {cornerStamp && (
        <span
          className={`pointer-events-none absolute bottom-2 right-2 z-10 rotate-[-7deg] border-2 border-approve bg-paper/80 px-1 py-0.5 font-stamp font-bold uppercase tracking-widest text-approve ${
            size === 'full' ? 'text-[11px]' : 'text-[8px]'
          }`}
        >
          {cornerStamp}
        </span>
      )}
      <div>
        <p className={`text-center font-stamp uppercase tracking-[0.2em] text-navy ${s.title}`}>
          {STICKER_LABELS.republicTitle}
        </p>
        {/* No separate visa-name subtitle, SERIAL №, or issue-date corner.
            Today's date now lives inside the PENDING APPROVAL stamp. */}

        {/* Photo left, fields right — SAME horizontal layout in both sizes. */}
        <div className={`mt-2 flex items-start ${s.photoGap}`}>
          {/* Photo keeps the capture's ORIGINAL aspect ratio (owner request —
              no square crop of the human): fixed height, natural width, with
              a max-width cap so an extreme landscape capture can't crowd out
              the field grid. Only the no-photo placeholder box has a fixed
              width. */}
          <div className={`shrink-0 overflow-hidden border border-navy bg-[#cfc8b8] ${s.photo} ${photoUrl ? 'max-w-[45%]' : s.photoBlank}`}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className={`h-full w-auto object-contain ${photoAnimate ? 'animate-field-fill' : ''}`}
              />
            ) : (
              <p className={`flex h-full w-full items-center justify-center text-center font-bold uppercase leading-[1.1] text-navy ${s.photoText}`}>
                {STICKER_LABELS.photoPlaceholder}
              </p>
            )}
          </div>

          {/* Unequal columns: short labels/values on the left need less room;
              the right gets more space for handles, validity and IQ. */}
          <div className={`grid min-w-0 flex-1 grid-cols-[0.78fr_1.22fr] uppercase tracking-wide ${s.grid}`}>
            {fields.map((field) => (
              <div
                key={field.key}
                className={`flex min-w-0 items-center justify-between gap-1.5 ${field.span ? 'col-span-2' : ''}`}
              >
                {field.label && <span className="shrink-0 text-navy">{field.label}</span>}
                {field.value ? (
                  <span
                    className={`flex min-w-0 items-center justify-end gap-1 text-right font-bold text-navy ${field.animate ? 'animate-field-fill' : ''}`}
                    title={field.value}
                  >
                    {/* Full size WRAPS long values instead of shortening them
                        (owner request); the compact card still truncates. */}
                    <span className={size === 'full' ? 'min-w-0 break-words leading-snug' : 'truncate'}>
                      {field.value}
                    </span>
                    {field.imageSrc && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={field.imageSrc}
                        alt={field.imageAlt ?? ''}
                        className={`shrink-0 object-contain ${size === 'full' ? 'h-5 w-5' : 'h-4 w-4'}`}
                      />
                    )}
                  </span>
                ) : (
                  <Blank wide={field.span} size={size} />
                )}
              </div>
            ))}
          </div>
        </div>

        {addenda?.map((item) => (
          <div
            key={item.key}
            className={`mt-1 flex items-baseline justify-between gap-1.5 border-t border-dashed border-navy/40 pt-1 uppercase tracking-wide ${s.addendum}`}
          >
            <span className="shrink-0 text-navy">{item.label}</span>
            {item.value ? (
              <span
                className={`flex min-w-0 items-center justify-end gap-1 font-bold text-navy ${item.animate ? 'animate-field-fill' : ''}`}
                title={item.value}
              >
                {item.imageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageSrc}
                    alt={item.imageAlt ?? ''}
                    className={`shrink-0 border border-navy object-contain ${size === 'full' ? 'h-6 w-6' : 'h-5 w-5'}`}
                  />
                )}
                {/* Same rule as fields: full size wraps, compact truncates. */}
                <span className={size === 'full' ? 'min-w-0 break-words text-right leading-snug' : 'truncate'}>
                  {item.value}
                </span>
              </span>
            ) : (
              <Blank size={size} />
            )}
          </div>
        ))}

        <div className={`${s.barcodeClass} ${s.barcodeGap}`} aria-hidden />
      </div>
    </div>
  )
}
