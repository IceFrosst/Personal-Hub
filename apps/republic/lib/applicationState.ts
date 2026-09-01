// Plain (non-JSX) module carrying the funnel's state shape/defaults and a
// couple of pure helpers derived from them. Split out of
// `applicationContext.tsx` specifically so it can be unit-tested directly
// with Node's `--experimental-strip-types` (which can strip *types* out of a
// `.ts` file but can't transform the JSX inside `applicationContext.tsx`'s
// `ApplicationProvider` component) — see `test/applicationState.test.mjs`.
import type { VisaType } from './content'
import type { VisitorIntel } from './intel'

/** Applicant-facing fields retained in the device's completed-application log.
 * Optional fields intentionally cover records written by older app versions. */
export interface SubmittedApplicationRecord {
  applicantName?: string
  instagramHandle?: string
  visaType?: string
  slot?: string
  issuedDate?: string
  serial?: string
  referenceCode?: string
  idea?: string
  supplies?: string[]
  pitch?: string
  statement?: string
  otherness?: string
  interviewAnswers?: string[]
  screeningQuestion?: string
  screeningAnswer?: string
  declaredIq?: number
  declaredConfidence?: number
  decisionSeconds?: number
  gender?: string
  dutyFreeItems?: string[]
  selfieCaptured?: boolean
  selfieSizeBytes?: number
  selfiePath?: string
}

export interface ApplicationState {
  applicantName: string
  instagramHandle: string
  visaType: VisaType | null
  /** The sidequest (tourist) visa's "WHAT'S THE IDEA?" answer. */
  sidequestIdea: string
  /** Set only when the idea screen is submitted; text alone may be partial. */
  sidequestIdeaSubmitted: boolean
  /** Declared expedition supplies (sidequest) — all four earns the FULLY EQUIPPED stamp. */
  sidequestSupplies: string[]
  /** True once the supply declaration screen was submitted (even with zero
   *  boxes checked) — distinguishes "declared nothing" from "not asked yet"
   *  so the forward-lock can't re-ask. */
  sidequestSuppliesDeclared: boolean
  /** The special visa's "HOW OTHER IS YOUR PURPOSE?" selection. */
  specialOtherness: string
  /** Set when the otherness selection is submitted. */
  specialOthernessSubmitted: boolean
  fianceAnswers: string[]
  /** Set once the DATE VISA interview is complete; protects restored records. */
  fianceInterviewSubmitted: boolean
  businessPitch: string
  /** Set only when the business pitch is submitted; text alone may be partial. */
  businessPitchSubmitted: boolean
  specialStatement: string
  /** Set only when the sworn statement is submitted. */
  specialStatementSubmitted: boolean
  /** Set only when identity is submitted; text alone may be partial. */
  identitySubmitted: boolean
  /** Set only when the handle is submitted; text alone may be partial. */
  handleSubmitted: boolean
  slot: string | null
  /** Full-resolution capture — deliberately never persisted, see below. */
  selfieDataUrl: string | null
  /** Persisted flag: survives a refresh even after selfieDataUrl is stripped. */
  selfieCaptured: boolean
  /** Persisted small (~200px JPEG) fallback so the visa sticker can still be
   *  reconstructed after a refresh loses the full-resolution capture. */
  selfieThumbnailUrl: string | null
  /** Completed-record metadata only; never used to fetch a private photo. */
  selfieSizeBytes: number | null
  selfiePath: string | null
  /** Secondary-screening absurd question drawn for this session — persisted
   *  so a refresh mid-screening doesn't re-roll the rotation (see
   *  app/screening/page.tsx and lib/content.ts#SCREENING_QUESTIONS). */
  screeningQuestion: string | null
  /** The chosen answer to the screening question above. */
  screeningAnswer: string | null
  /** Self-declared IQ from the bell-curve slider — never verified, obviously. */
  declaredIq: number | null
  /** DATE path only: self-declared confidence (raw; the passport prints it 15% lower). */
  declaredConfidence: number | null
  /** Seconds spent staring at /visa before picking — printed only for the DATE path. */
  dateDecisionSeconds: number | null
  /** Anonymous draft identity used to join abandoned events to a final submission. */
  draftId: string | null
  /** Officer-eyes-only visitor intel collected on the landing (lib/intel.ts). */
  intel: VisitorIntel | null
  /** How many times the photo was retaken on /biometric before submission. */
  selfieRetakes: number
  /** Available duty-free items the applicant clicked; printed as one passport addendum. */
  dutyFreeItems: string[]
  /** Passport SEX field value ('M' / 'F' / 'X') from the landing gender question. */
  gender: string | null
  referenceCode: string | null
  /** Visa sticker SERIAL № — generated exactly once, on the FIRST visa
   *  selection (see lib/referenceCode.ts#generateSerial), and preserved
   *  across any later re-selection (returning to /visa and picking again, or
   *  a direct link into a visa-step sub-page) so the progress card and the
   *  final /visa-issued sticker always render the identical value. Only ever
   *  set together with `visaType`, through the shared `selectVisa` operation
   *  below — never set directly via `update`. */
  serial: string | null
  /** Visa sticker ISSUED date — filled once the appointment slot is
   *  confirmed (see lib/content.ts#formatIssuedDate) so it survives a refresh
   *  and matches whatever /visa-issued renders later in the same session. */
  issuedDate: string | null
}

export const EMPTY_STATE: ApplicationState = {
  applicantName: '',
  instagramHandle: '',
  visaType: null,
  sidequestIdea: '',
  sidequestIdeaSubmitted: false,
  sidequestSupplies: [],
  sidequestSuppliesDeclared: false,
  specialOtherness: '',
  specialOthernessSubmitted: false,
  fianceAnswers: [],
  fianceInterviewSubmitted: false,
  businessPitch: '',
  businessPitchSubmitted: false,
  specialStatement: '',
  specialStatementSubmitted: false,
  identitySubmitted: false,
  handleSubmitted: false,
  slot: null,
  selfieDataUrl: null,
  selfieCaptured: false,
  selfieThumbnailUrl: null,
  selfieSizeBytes: null,
  selfiePath: null,
  screeningQuestion: null,
  screeningAnswer: null,
  declaredIq: null,
  declaredConfidence: null,
  dateDecisionSeconds: null,
  draftId: null,
  intel: null,
  selfieRetakes: 0,
  dutyFreeItems: [],
  gender: null,
  referenceCode: null,
  serial: null,
  issuedDate: null,
}

function isVisaType(value: string | undefined): value is VisaType {
  return value === 'tourist' || value === 'fiance' || value === 'business' || value === 'special'
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function nullableString(value: unknown): string | null {
  const result = stringValue(value)
  return result || null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Rehydrates a completed local-log row without starting a new draft. A
 * completed record is inherently forward-locked: markers are set for its
 * selected path, while officer intel/draft identity remain empty because the
 * local log strips them before writing.
 */
export function mapSubmittedApplication(record: SubmittedApplicationRecord): ApplicationState {
  const applicantName = stringValue(record.applicantName)
  const instagramHandle = stringValue(record.instagramHandle)
  const visaType = isVisaType(record.visaType) ? record.visaType : null
  return {
    ...EMPTY_STATE,
    applicantName,
    instagramHandle,
    visaType,
    sidequestIdea: stringValue(record.idea),
    sidequestIdeaSubmitted: visaType === 'tourist',
    sidequestSupplies: stringArray(record.supplies),
    sidequestSuppliesDeclared: visaType === 'tourist',
    specialOtherness: stringValue(record.otherness),
    specialOthernessSubmitted: visaType === 'special',
    fianceAnswers: stringArray(record.interviewAnswers),
    fianceInterviewSubmitted: visaType === 'fiance',
    businessPitch: stringValue(record.pitch),
    businessPitchSubmitted: visaType === 'business',
    specialStatement: stringValue(record.statement),
    specialStatementSubmitted: visaType === 'special',
    identitySubmitted: Boolean(applicantName),
    handleSubmitted: Boolean(instagramHandle),
    slot: nullableString(record.slot),
    selfieDataUrl: null,
    selfieCaptured: record.selfieCaptured === true,
    selfieThumbnailUrl: null,
    selfieSizeBytes: finiteNumber(record.selfieSizeBytes),
    selfiePath: nullableString(record.selfiePath),
    screeningQuestion: nullableString(record.screeningQuestion),
    screeningAnswer: nullableString(record.screeningAnswer),
    declaredIq: finiteNumber(record.declaredIq),
    declaredConfidence: finiteNumber(record.declaredConfidence),
    dateDecisionSeconds: finiteNumber(record.decisionSeconds),
    // These are intentionally not restored from localStorage.
    draftId: null,
    intel: null,
    selfieRetakes: 0,
    dutyFreeItems: stringArray(record.dutyFreeItems),
    gender: nullableString(record.gender),
    referenceCode: nullableString(record.referenceCode),
    serial: nullableString(record.serial),
    issuedDate: nullableString(record.issuedDate),
  }
}

/**
 * Decides whether a previously captured selfie thumbnail may carry over into
 * a restored application state. A thumbnail is safe *session* state — it may
 * legitimately survive alongside an expired full-resolution capture for the
 * exact same application this tab already had open (e.g. reopening
 * /visa-issued for the record that's still live in `state`). It must never
 * leak across applications: if the current session's `referenceCode` is
 * missing, the record's `referenceCode` is missing, or the two don't match
 * exactly, the restore gets no thumbnail and /visa-issued falls back to its
 * "PHOTO ON FILE" placeholder instead of ever risking showing a stranger's
 * (or a stale prior application's) photo. Pure so it can be unit-tested
 * directly, and shared by `applicationContext.tsx#restoreSubmittedApplication`.
 */
export function resolveRestoredThumbnail(
  currentReferenceCode: string | null,
  currentThumbnailUrl: string | null,
  recordReferenceCode: string | null | undefined
): string | null {
  if (!currentReferenceCode || !recordReferenceCode) return null
  if (currentReferenceCode !== recordReferenceCode) return null
  return currentThumbnailUrl
}

/**
 * True when every field except `draftId` still matches a freshly reset/
 * hydrated empty application — i.e. nothing has happened in this draft yet.
 *
 * Used by the landing page's mount effect to avoid minting a *second*
 * draftId (and firing a second, redundant `draft_started` audit event)
 * immediately after `ApplicationProvider`'s own hydration effect already
 * established a brand-new one for a genuinely first-ever visit (empty
 * sessionStorage). Before this check existed, the landing's mount effect
 * unconditionally called `reset()` on every mount, racing (and sometimes
 * losing to) the provider's own hydration effect — see the hydration-race
 * note in `app/page.tsx` and CLAUDE.md.
 */
export function isFreshApplicationState(state: ApplicationState): boolean {
  return (Object.keys(EMPTY_STATE) as (keyof ApplicationState)[]).every((key) => {
    if (key === 'draftId') return true
    const a = state[key]
    const b = EMPTY_STATE[key]
    if (a === b) return true
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  })
}

/**
 * Claims the provider's one-time hydration lifecycle. React Strict Mode
 * replays passive effects while preserving refs; a real unmount gets a fresh
 * ref and can hydrate normally again.
 */
export function claimProviderHydration(gate: { current: boolean }): boolean {
  if (gate.current) return false
  gate.current = true
  return true
}
