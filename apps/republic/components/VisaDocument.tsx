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
  /** REFERENCE №/CONDITIONS run full-width across both columns, same as on the sticker. */
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
  visaName: string | null
  photoUrl?: string | null
  photoAnimate?: boolean
  /** In the sticker's own order — see the two-column layout note above each caller. */
  fields: VisaDocumentField[]
  /** Real funnel data that isn't one of the sticker's own fields (appointment slot, sub-step content) — rendered below the grid with its own dashed divider. */
  addenda?: VisaDocumentAddendum[]
}

const SIZE = {
  compact: {
    wrap: 'p-1',
    inner: 'p-1.5',
    title: 'text-[9px]',
    subtitle: 'text-[7px]',
    photo: 'h-11 w-11',
    photoText: 'text-[3px]',
    photoGap: 'gap-1.5',
    grid: 'text-[8px] gap-x-2 gap-y-0.5',
    addendum: 'text-[8px]',
    barcodeClass: 'barcode-mini',
    barcodeGap: 'mt-1.5',
    blankNarrow: 'w-9',
    blankWide: 'w-16',
  },
  full: {
    wrap: 'p-1.5',
    inner: 'p-3',
    title: 'text-base',
    subtitle: 'text-[10px]',
    photo: 'h-28 w-28',
    photoText: 'text-[9px] px-1',
    photoGap: 'gap-3',
    grid: 'w-full text-[12px] gap-x-4 gap-y-3',
    addendum: 'text-[12px]',
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

export function VisaDocument({ size, visaName, photoUrl, photoAnimate, fields, addenda }: VisaDocumentProps) {
  const s = SIZE[size]

  return (
    <div className={`border-2 border-navy bg-paper ${s.wrap} shadow-[2px_2px_0_rgba(26,42,74,0.15)]`}>
      <div className={`border border-navy ${s.inner}`}>
        <p className={`text-center font-stamp uppercase tracking-[0.2em] text-navy ${s.title}`}>
          {STICKER_LABELS.republicTitle}
        </p>
        {visaName ? (
          <p className={`text-center uppercase tracking-[0.15em] text-navy ${s.subtitle}`}>
            {STICKER_LABELS.visaPrefix}
            {visaName}
          </p>
        ) : (
          <div className="mt-0.5 flex justify-center">
            <Blank wide size={size} />
          </div>
        )}

        <div className={`mt-2 flex ${size === 'full' ? 'flex-col items-center' : 'items-start'} ${s.photoGap}`}>
          <div className={`shrink-0 overflow-hidden border border-navy bg-[#cfc8b8] ${s.photo}`}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className={`h-full w-full object-cover ${photoAnimate ? 'animate-field-fill' : ''}`}
              />
            ) : (
              <p className={`flex h-full w-full items-center justify-center text-center font-bold uppercase leading-[1.1] text-navy ${s.photoText}`}>
                {STICKER_LABELS.photoPlaceholder}
              </p>
            )}
          </div>

          <div className={`grid min-w-0 flex-1 grid-cols-2 uppercase tracking-wide ${s.grid}`}>
            {fields.map((field) => (
              <div
                key={field.key}
                className={`${size === 'full' ? 'flex min-w-0 flex-col items-start' : 'flex items-baseline justify-between gap-1.5'} ${field.span ? 'col-span-2' : ''}`}
              >
                <span className="shrink-0 text-navy">{field.label}</span>
                {field.value ? (
                  <span
                    className={`${size === 'full' ? 'w-full break-words text-left leading-snug' : 'truncate text-right'} font-bold text-navy ${field.animate ? 'animate-field-fill' : ''}`}
                  >
                    {field.value}
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
            className={`mt-1 border-t border-dashed border-navy/40 pt-1 uppercase tracking-wide ${size === 'full' ? 'flex flex-col items-start' : 'flex items-baseline justify-between gap-1.5'} ${s.addendum}`}
          >
            <span className="shrink-0 text-navy">{item.label}</span>
            {item.value ? (
              <span
                className={`${size === 'full' ? 'flex w-full items-center gap-2 text-left leading-snug' : 'flex min-w-0 items-center justify-end gap-1'} font-bold text-navy ${item.animate ? 'animate-field-fill' : ''}`}
                title={item.value}
              >
                {item.imageSrc && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageSrc}
                    alt={item.imageAlt ?? ''}
                    className={`shrink-0 border border-navy object-contain ${size === 'full' ? 'h-10 w-10' : 'h-5 w-5'}`}
                  />
                )}
                <span className={size === 'full' ? 'break-words' : 'truncate'}>{item.value}</span>
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
