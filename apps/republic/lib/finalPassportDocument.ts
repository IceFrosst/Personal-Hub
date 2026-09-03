import type { ApplicationState } from './applicationContext'
import type { VisaDocumentAddendum, VisaDocumentField } from '@/components/VisaDocument'
import {
  CONFIDENCE,
  DECISION_TIME_LABEL,
  DOCUMENT_PROGRESS,
  FULLY_EQUIPPED_STAMP,
  STICKER_LABELS,
  VISA_BY_SLUG,
  adjustedConfidence,
  formatDecisionTime,
  formatPassportDate,
  formatPassportVisaName,
  iqFaceFor,
  isFullyEquipped,
  passportPhotoNote,
} from './content'
import { getScreeningAddenda, getVisaAddendum } from './visaAddendum'

export interface FinalPassportDocument {
  fields: VisaDocumentField[]
  addenda: VisaDocumentAddendum[]
  cornerStamp?: string
}

/**
 * The exact `VisaDocumentField[]`/`VisaDocumentAddendum[]` structure for a
 * FINALIZED passport — extracted from app/visa-issued/page.tsx so that
 * page and the landing's returning-applicant passport (app/page.tsx) build
 * the on-screen document from one shared place and can never drift apart.
 * Returns `null` if `state` isn't actually finalized enough to have a visa
 * (callers are expected to already gate on the fuller finalization check —
 * visaType + serial + slot + issuedDate + referenceCode + selfieCaptured —
 * before rendering; this function only guards the one field it directly
 * dereferences, `visa`).
 */
export function buildFinalPassportDocument(state: ApplicationState): FinalPassportDocument | null {
  const visa = state.visaType ? VISA_BY_SLUG[state.visaType] : null
  if (!visa) return null

  const visaAddendum = getVisaAddendum(state)
  const screeningAddenda = getScreeningAddenda(state)

  // Same sticker fields, same order, as components/DocumentProgress.tsx —
  // callers must guarantee every field is already complete (see the
  // finalization guard both current callers apply) so nothing here ever
  // renders a blank/ruled row.
  const fields: VisaDocumentField[] = [
    { key: 'name', label: STICKER_LABELS.name, value: state.applicantName.toUpperCase() || STICKER_LABELS.unknownName },
    // Label is "IG @:" so the value is the bare handle — no doubled @.
    { key: 'passport', label: STICKER_LABELS.passport, value: state.instagramHandle },
    { key: 'visaType', label: 'VISA:', value: formatPassportVisaName(visa.name) },
    { key: 'other', label: STICKER_LABELS.other, value: passportPhotoNote(visa.slug) },
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
    ...(state.declaredConfidence !== null
      ? [{
          key: 'confidence',
          label: CONFIDENCE.passportLabel,
          value: `${adjustedConfidence(state.declaredConfidence)}${CONFIDENCE.adjustedSuffix}`,
        }]
      : []),
    {
      key: 'appointment',
      label: DOCUMENT_PROGRESS.appointmentLabel,
      value: formatPassportDate(state.slot ?? ''),
      span: true,
    },
  ]

  const addenda: VisaDocumentAddendum[] = []
  if (state.visaType === 'special' && state.specialOtherness) {
    addenda.push({
      key: 'otherness',
      label: DOCUMENT_PROGRESS.othernessLabel,
      value: state.specialOtherness,
    })
  }
  if (visaAddendum) {
    addenda.push({ key: 'subStep', label: visaAddendum.label, value: visaAddendum.value })
  }
  // IQ is beside SEX in the field grid; only non-image screening content
  // remains below as an addendum.
  screeningAddenda
    .filter((item) => !item.imageSrc)
    .forEach((item, index) => {
      addenda.push({
        key: `screening-${index}`,
        label: item.label,
        value: item.value,
      })
    })
  if (state.visaType === 'fiance' && state.dateDecisionSeconds !== null) {
    addenda.push({
      key: 'decisionTime',
      label: DECISION_TIME_LABEL,
      value: formatDecisionTime(state.dateDecisionSeconds),
    })
  }
  if (state.dutyFreeItems.length) {
    addenda.push({
      key: 'duty-free',
      label: DOCUMENT_PROGRESS.dutyFreeLabel,
      value: state.dutyFreeItems.join(' · '),
    })
  }

  return {
    fields,
    addenda,
    cornerStamp:
      state.visaType === 'tourist' && isFullyEquipped(state.sidequestSupplies) ? FULLY_EQUIPPED_STAMP : undefined,
  }
}
