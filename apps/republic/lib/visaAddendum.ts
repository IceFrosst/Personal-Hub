import type { ApplicationState } from './applicationContext'
import { DOCUMENT_PROGRESS, iqFaceFor } from './content'

export interface VisaAddendumContent {
  label: string
  value: string
  /** Optional small stamp image (the IQ wojak face) rendered beside the value. */
  imageSrc?: string
  imageAlt?: string
}

/** The selected/typed visa-specific answer printed on both progress and final documents. */
export function getVisaAddendum(state: ApplicationState): VisaAddendumContent | null {
  switch (state.visaType) {
    case 'business':
      return state.businessPitch ? { label: DOCUMENT_PROGRESS.pitchLabel, value: state.businessPitch } : null
    case 'special':
      return state.specialStatement
        ? { label: DOCUMENT_PROGRESS.statementLabel, value: state.specialStatement }
        : null
    case 'fiance': {
      const value = state.fianceAnswers.filter(Boolean).join(' · ')
      return value ? { label: DOCUMENT_PROGRESS.interviewAnswersLabel, value } : null
    }
    default:
      return null
  }
}

/**
 * Secondary-screening addenda (absurd-question answer + self-declared IQ)
 * printed on both the progress card and the final document — shared so the
 * two documents (and the downloadable PNG canvas) can never disagree.
 */
export function getScreeningAddenda(state: ApplicationState): VisaAddendumContent[] {
  const addenda: VisaAddendumContent[] = []
  if (state.screeningAnswer) {
    addenda.push({ label: DOCUMENT_PROGRESS.screeningLabel, value: state.screeningAnswer })
  }
  if (state.declaredIq !== null) {
    const face = iqFaceFor(state.declaredIq)
    // Face + bare number only, no label or suffix text (owner request).
    addenda.push({
      label: '',
      value: String(state.declaredIq),
      imageSrc: face.src,
      imageAlt: face.alt,
    })
  }
  return addenda
}
