import { forwardRef } from 'react'
import { StampSlam } from './StampSlam'
import { VisaDocument } from './VisaDocument'
import type { ApplicationState } from '@/lib/applicationContext'
import { buildFinalPassportDocument } from '@/lib/finalPassportDocument'

// The ONE shared presentation of a finalized passport — wrapper, the real
// `VisaDocument` (field/addenda construction via
// lib/finalPassportDocument.ts#buildFinalPassportDocument), photo selection,
// and the decision `StampSlam` overlay, all in one place. Both `/visa-issued`
// (app/visa-issued/page.tsx) and the landing's returning-applicant state
// (app/page.tsx) render this exact component so the two on-screen documents
// can never drift apart — previously only the field/addendum *data* was
// shared and each page still hand-rolled its own wrapper/photo/stamp JSX.
//
// Forwards its root DOM ref so `/visa-issued`'s DOWNLOAD VISA (html-to-image
// capture, see that file's header comment) keeps capturing the EXACT node
// rendered on screen, stamp overlay and all, through this shared component.
// Callers must gate rendering on their own finalization guard first (see
// `lib/applicationState.ts#isFinalizedApplicationState`) — like
// `buildFinalPassportDocument`, this component only guards the one field it
// directly dereferences (no visa → renders nothing) and otherwise trusts the
// caller not to hand it a partial/corrupt record.
export interface FinalPassportProps {
  state: ApplicationState
  /** The current decision's stamp text (e.g. "PENDING APPROVAL"/"APPROVED"/"DENIED"). */
  stampText: string
  stampColor: 'stamp' | 'approve' | 'pending'
}

export const FinalPassport = forwardRef<HTMLDivElement, FinalPassportProps>(function FinalPassport(
  { state, stampText, stampColor },
  ref
) {
  const finalDocument = buildFinalPassportDocument(state)
  if (!finalDocument) return null

  return (
    // pt-5/pr-1 keep the overhanging stamp inside this node's bounds so
    // `/visa-issued`'s DOM-capture download never clips it.
    <div ref={ref} className="relative mt-4 pt-5 pr-1">
      <VisaDocument
        size="full"
        photoUrl={state.selfieDataUrl ?? state.selfieThumbnailUrl}
        fields={finalDocument.fields}
        addenda={finalDocument.addenda}
        cornerStamp={finalDocument.cornerStamp}
      />
      <div className="pointer-events-none absolute right-0 top-0">
        {/* 50% larger text than the old !text-sm version; border thinned
            30% and the ghost strike removed (owner requests). */}
        <StampSlam
          text={stampText}
          subtext={state.issuedDate ?? ''}
          color={stampColor}
          rotate={10}
          ghost={false}
          className="!border-[4px] !px-[18px] !py-1.5 !text-[21px]"
        />
      </div>
    </div>
  )
})
