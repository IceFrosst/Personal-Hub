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
  /** Local-log only — when this device submitted (DB rows have created_at
   *  instead). Also the legacy-completion fallback source for `issuedDate`
   *  below when an older record predates that field — see
   *  `mapSubmittedApplication`. */
  submittedAt?: string
  /** Small (~200px JPEG) thumbnail retained in THIS device's application log
   *  and session state. It is excluded from the `republic.applications` table
   *  JSON payload, `draft_events`, and officer-eyes-only `intel`; finalization
   *  may still send it to private Storage as the review image when the
   *  full-resolution source is unavailable. */
  selfieThumbnailUrl?: string
}

export interface ApplicationState {
  applicantName: string
  instagramHandle: string
  visaType: VisaType | null
  /** The sidequest (tourist) visa's "WHAT'S THE IDEA?" answer. */
  sidequestIdea: string
  /** Set only when the idea screen is submitted; text alone may be partial. */
  sidequestIdeaSubmitted: boolean
  /** Declared sidequest supplies — all four earns the FULLY EQUIPPED stamp. */
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

/** Small, deterministic (non-cryptographic) string hash — same input always
 *  produces the same output, which is exactly what the legacy-completion
 *  fallbacks below need: a value that never changes across repeat views of
 *  the same on-file record, without needing any *new* per-record state. */
function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Deterministic internal placeholder SERIAL № for a legacy local record that
 * predates SERIAL being generated at visa-selection time (see
 * `ApplicationState#serial`'s own lifecycle note). It is a pure
 * *guard-satisfying* value — SERIAL № has not been printed anywhere on the
 * passport for a while (see app/visa-issued/page.tsx's own comment) — so
 * there is no user-facing accuracy to preserve, only the /visa-issued (and
 * every earlier funnel step's) `!state.serial` completeness guard, which
 * would otherwise bounce a genuinely finished old application back into the
 * live funnel instead of showing its final document. Always derived from the
 * record's own `referenceCode`, so re-viewing the exact same record always
 * regenerates the exact same value — never randomized per view — and
 * prefixed distinctly from `generateSerial()`'s real `SN-######` format so it
 * can never collide with, or be mistaken for, a genuinely-issued one.
 */
function synthesizeSerial(referenceCode: string): string {
  const digits = 100000 + (hashString(referenceCode) % 900000)
  return `SN-LEGACY-${digits}`
}

/**
 * Deterministic fallback ISSUED date for a legacy local record that predates
 * `issuedDate` being stored (or, rarer still, one that predates `submittedAt`
 * too). Unlike SERIAL №, this DOES render on-screen (the /visa-issued stamp's
 * subtext), so it uses the exact DD/MM/YYYY shape of the en-GB date. The UTC
 * getters are deliberate: an ISO timestamp near midnight must not display a
 * different date merely because the applicant's browser has another timezone.
 * It's fed the record's own `submittedAt` instead of `new Date()`, so it
 * reflects a real moment already on file rather than inventing a new one
 * (which would drift on every view, exactly the bug this exists to fix). A
 * missing or invalid timestamp uses the truthful non-date guard value
 * `DATE ON FILE`, never an epoch/1970 date.
 */
export function synthesizeIssuedDate(submittedAt: string | undefined): string {
  const parsed = typeof submittedAt === 'string' ? new Date(submittedAt) : new Date(Number.NaN)
  if (Number.isNaN(parsed.getTime())) return 'DATE ON FILE'
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const year = String(parsed.getUTCFullYear()).padStart(4, '0')
  return `${day}/${month}/${year}`
}

/**
 * Rehydrates a completed local-log row without starting a new draft. A
 * completed record is inherently forward-locked: markers are set for its
 * selected path, while officer intel/draft identity remain empty because the
 * local log strips them before writing.
 *
 * Legacy-safe completion: an existing `serial`/`issuedDate` on the record is
 * always preserved as-is (never regenerated/overwritten). Only when BOTH are
 * absent AND the record is otherwise a genuinely completed application (has
 * a `visaType`, `slot`, `referenceCode`, and `selfieCaptured === true` — the
 * same fields /visa-issued's own guard otherwise requires) are they
 * synthesized, deterministically, from data already on that same record —
 * see `synthesizeSerial`/`synthesizeIssuedDate` above. This exists so an
 * application submitted by an older app version (before SERIAL №/ISSUED were
 * added to the local log) still resolves to a genuinely complete restored
 * state instead of silently failing /visa-issued's completeness guard and
 * bouncing through /visa → back into the (already-answered) sub-step →
 * /appointment. An incomplete record (missing slot/referenceCode/selfie) is
 * NOT synthesized — there's nothing genuinely finished to restore, so it
 * correctly stays incomplete and the normal guards route it appropriately.
 */
export function mapSubmittedApplication(record: SubmittedApplicationRecord): ApplicationState {
  const applicantName = stringValue(record.applicantName)
  const instagramHandle = stringValue(record.instagramHandle)
  const visaType = isVisaType(record.visaType) ? record.visaType : null
  const slot = nullableString(record.slot)
  const referenceCode = nullableString(record.referenceCode)
  const selfieCaptured = record.selfieCaptured === true
  const isOtherwiseComplete = Boolean(visaType && slot && referenceCode && selfieCaptured)
  const existingSerial = nullableString(record.serial)
  const existingIssuedDate = nullableString(record.issuedDate)
  const serial = existingSerial ?? (isOtherwiseComplete && referenceCode ? synthesizeSerial(referenceCode) : null)
  const issuedDate =
    existingIssuedDate ?? (isOtherwiseComplete ? synthesizeIssuedDate(record.submittedAt) : null)
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
    slot,
    selfieDataUrl: null,
    selfieCaptured,
    // Priority: the record's OWN persisted thumbnail (written by this same
    // device, at submit time or by the restore-rescue path — see
    // lib/api.ts#persistApplicationThumbnail) wins outright when present.
    // applicationContext.tsx#restoreSubmittedApplication only ever considers
    // the current session's in-memory thumbnail (resolveRestoredThumbnail)
    // as a fallback when this is null — it must never override a thumbnail
    // the record already has on file.
    selfieThumbnailUrl: nullableString(record.selfieThumbnailUrl),
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
    referenceCode,
    serial,
    issuedDate,
  }
}

/**
 * Decides whether a previously captured selfie thumbnail may carry over into
 * a restored application state. Only ever consulted (by
 * `applicationContext.tsx#restoreSubmittedApplication`) as a FALLBACK, when
 * the record itself has no `selfieThumbnailUrl` of its own —
 * `mapSubmittedApplication` always prefers the record's own on-file
 * thumbnail over this. A thumbnail is safe *session* state — it may
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
 * Pure exact-reference-code merge step behind lib/api.ts#persistApplicationThumbnail
 * — split out here (rather than left inline in that function) specifically
 * so it's unit-testable directly under plain Node ESM alongside this
 * module's other pure helpers (see the file header comment); lib/api.ts's
 * own runtime imports (e.g. ./applicationStatus) only resolve inside a
 * bundler, not under Node's native ESM module resolver, so that whole file
 * can't be imported the same way. Returns the exact same array reference
 * (not even a shallow copy) when no row's `referenceCode` matches, or when
 * the matching row already carries this exact thumbnail — so a genuine
 * no-op is `===`-detectable by the caller, which skips a redundant
 * localStorage write. Never touches any row but the one exact match; per
 * the "never borrow another application's image" rule, a caller must only
 * ever pass a thumbnail already confirmed (via resolveRestoredThumbnail) to
 * belong to this exact referenceCode.
 */
export function mergeSelfieThumbnail<T extends SubmittedApplicationRecord>(
  log: T[],
  referenceCode: string,
  thumbnailUrl: string
): T[] {
  const index = log.findIndex((record) => record.referenceCode === referenceCode)
  if (index === -1) return log
  if (log[index].selfieThumbnailUrl === thumbnailUrl) return log
  const next = log.slice()
  next[index] = { ...next[index], selfieThumbnailUrl: thumbnailUrl }
  return next
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
