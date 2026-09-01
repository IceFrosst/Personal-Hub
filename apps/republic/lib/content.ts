// All editable copy/config for the Dictatorship of Ignas lives here.
// Deadpan is the law — do not punch up the jokes, just keep them straight-faced.

// 'consultation' (SEEK ADVICE PERMIT) was removed outright per owner request
// — the whole path is gone, not hidden (no VISAS entry, no /visa/consultation
// route, no ConsultationStep, no consultationMatter state).
export type VisaType = 'tourist' | 'fiance' | 'business' | 'special'

export interface VisaDefinition {
  slug: VisaType
  icon: string
  name: string
  tagline: string
  lines: string[]
}

// Trimmed per owner feedback: each card is now icon + name + at most one
// flavor line (fiancé gets neither, just the HIGH RISK stamp rendered
// separately in app/visa/page.tsx). Empty `tagline`/`lines` are hidden
// entirely by that page, not rendered as empty quotes/an empty list.
// Business visa is listed first per owner request; the rest keep their prior
// relative order (tourist, fiance, special). The SEEK ADVICE PERMIT
// (consultation) card was removed entirely — see the VisaType note above.
export const VISAS: VisaDefinition[] = [
  {
    slug: 'business',
    icon: '💼',
    name: 'BUSINESS VISA',
    tagline: '',
    lines: ['Purpose: money talk, projects'],
  },
  {
    slug: 'tourist',
    icon: '🗺',
    name: 'SIDEQUEST VISA',
    tagline: '',
    lines: ['Reward: infinite memories'],
  },
  {
    slug: 'fiance',
    icon: '💌',
    name: 'DATE VISA',
    tagline: '',
    // Got its flavor line back per owner feedback — it was the only card
    // without one (it used to carry nothing but the HIGH RISK stamp).
    lines: ['Purpose: heart-related business'],
  },
  {
    slug: 'special',
    icon: '📎',
    name: 'SPECIAL PURPOSE VISA',
    tagline: '',
    lines: ['Purpose of visit: other'],
  },
]

export const VISA_BY_SLUG: Record<VisaType, VisaDefinition> = VISAS.reduce(
  (acc, v) => ({ ...acc, [v.slug]: v }),
  {} as Record<VisaType, VisaDefinition>
)

export const VISA_SELECTION = {
  heading: 'SELECT VISA TYPE',
}

/** Passport field value: "BUSINESS VISA" → "BUSINESS", etc. The field's
 * unbolded label already says VISA:. */
export function formatPassportVisaName(name: string): string {
  return name.replace(/\s+VISA$/, '')
}

// ---------------------------------------------------------------------------
// Site metadata (browser tab title, link-preview description, PWA app name) —
// app/layout.tsx's Next.js `Metadata`/`appleWebApp` config.
// ---------------------------------------------------------------------------

export const SITE_METADATA = {
  title: 'Dictatorship of Ignas — Border Control',
  description: 'Do you have something to declare? Apply for a visa to enter the Dictatorship of Ignas.',
  appName: 'Dictatorship of Ignas',
}

// ---------------------------------------------------------------------------
// Coat of arms — components/Crest.tsx (the aria-label is read aloud by screen
// readers, so it counts as user-facing copy same as any visible label).
// ---------------------------------------------------------------------------

export const CREST_ARIA_LABEL =
  'Coat of arms of the Dictatorship of Ignas: a shield bearing a phone, a fork, and a heart'

// ---------------------------------------------------------------------------
// Entry declaration
// ---------------------------------------------------------------------------

export const LANDING = {
  title: 'DICTATORSHIP OF IGNAS',
  // The header crest/title already carries "BORDER CONTROL" as its subtitle
  // line below — this second line is the form-code line, and reads plainly
  // as "ENTRY DECLARATION" (no "FORM 1G-NAS" prefix; that internal form-code
  // string was cut per owner feedback, see CLAUDE.md).
  subtitle: 'BORDER CONTROL — ENTRY DECLARATION',
  applicantNumberPrefix: 'APPLICANT №',
  // Shown until lib/api.ts#getApplicantNumber resolves inside a client effect
  // (never during render — see the hydration-safety Gotcha in CLAUDE.md).
  applicantNumberPlaceholder: '————',
  question: 'DO YOU HAVE SOMETHING TO DECLARE?',
  yes: 'YES',
  no: 'NO',
  genderQuestion: 'GENDER OF APPLICANT?',
  // The top-right corner is a tappable PRIORITY ↔ NON-PRIORITY toggle now
  // (owner request) — pure theater, it changes nothing downstream.
  priorityStamp: 'PRIORITY',
  nonPriorityStamp: 'NON-PRIORITY',
}

// Asked on the landing card right after the follow-up question is cleared.
// `value` is what the passport's SEX field prints (see STICKER_LABELS.sex).
export const GENDER_OPTIONS: { label: string; value: string }[] = [
  { label: 'MALE', value: 'M' },
  { label: 'FEMALE', value: 'F' },
  { label: 'CLASSIFIED', value: 'X' },
]

/** Zero-padded to 4 digits. The underlying number is now a real global
 *  sequential count from the `republic.next_applicant_number()` Supabase RPC
 *  (see lib/api.ts#getApplicantNumber) — no fixed range to document here
 *  anymore, it just keeps climbing. */
export function formatApplicantNumber(n: number): string {
  return String(n).padStart(4, '0')
}

// The single date-format source for the sticker's ISSUED field — called
// exactly once, where the value is first computed (app/appointment/page.tsx,
// on slot confirmation), and stored in ApplicationState#issuedDate from then
// on. Every later renderer (components/DocumentProgress.tsx,
// app/visa-issued/page.tsx) reads that persisted value straight from state
// rather than calling this again, so the progress card and the final visa
// always agree even if rendered on different calendar days within the same
// session — see the single-source note above ApplicationState#issuedDate.
export function formatIssuedDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-GB')
}

// ---------------------------------------------------------------------------
// Applicant identification — app/identity/page.tsx, shown after YES (or the
// denied/appeal loop) and before visa selection. Landing itself no longer
// collects any identity fields.
// ---------------------------------------------------------------------------

export const IDENTITY = {
  heading: 'APPLICANT IDENTIFICATION',
  nameLabel: 'NAME OF APPLICANT:',
  namePlaceholder: '____________________',
  nameRequiredError: 'NAME REQUIRED. THE MINISTRY DOES NOT PROCESS ANONYMOUS APPLICANTS.',
  continue: 'CONTINUE',
}

// Instagram handle is asked on its own page AFTER the visa type is chosen and
// the appointment is booked, right before the photo (owner request) — see
// app/handle/page.tsx.
export const HANDLE_STEP = {
  heading: 'PASSPORT REGISTRY',
  note: 'THE MINISTRY REQUIRES YOUR INSTAGRAM FOR PASSPORT ISSUANCE. THIS IS NORMAL.',
  handleLabel: 'PASSPORT №: @',
  handlePlaceholder: 'instagram_handle',
  handleRequiredError: 'INSTAGRAM HANDLE REQUIRED. NO HANDLE, NO PASSPORT, NO ENTRY.',
  continue: 'CONTINUE',
}

// ---------------------------------------------------------------------------
// Denial (NO branch)
// ---------------------------------------------------------------------------

export const DENIAL_REASONS = [
  'VIBES INSUFFICIENT.',
  'THE OFFICER SIMPLY DID NOT FEEL LIKE IT.',
  'NOTHING TO DECLARE.',
  'DECLARATION FORM SMELLED SUSPICIOUS.',
  'YOUR ENERGY DID NOT MATCH YOUR PAPERWORK.',
  'INSUFFICIENT ENTHUSIASM ON ARRIVAL.',
  'THE OFFICER HAD A LONG DAY.',
  'RANDOM SELECTION. VERY RANDOM. VERY SELECTED.',
]

// The REASON line only renders for a random denial or the bribe trap —
// declaring NOTHING (`?via=nothing`) and the CLASSIFIED gender trap
// (`?via=classified`) show no reason at all, just their STATUS line
// (owner request; see app/denied/page.tsx).
export const DENIAL = {
  stamp: 'ENTRY DENIED',
  reasonPrefix: 'REASON:',
  status: 'STATUS: WASTING OFFICER\'S TIME.',
  statusClassified: 'STATUS: KINDLY, FUCK OFF.',
  appeal: 'FILE AN APPEAL',
  caseLabel: 'CASE №:',
  dateLabel: 'DATE:',
  pendingPlaceholder: '…',
}

// ---------------------------------------------------------------------------
// Visa sub-step shared copy. Sub-steps now navigate straight to /appointment
// on completion (see components/visa-steps/*.tsx) — there's no more
// intermediate confirmation screen, so these gag lines/labels are currently
// unused but kept as copy-bank content rather than deleted outright.
// ---------------------------------------------------------------------------

export const TOURIST_STEP = {
  notice: 'NO ADDITIONAL DOCUMENTS REQUIRED.',
  disclaimer: 'The Ministry trusts you. This is unusual and should not be relied upon.',
}

// ---------------------------------------------------------------------------
// Sidequest visa — the idea itself
// ---------------------------------------------------------------------------

export const SIDEQUEST = {
  prompt: "WHAT'S THE IDEA?",
  placeholder: 'It better be good',
  submit: 'SUBMIT IDEA',
  // Customs-form supply declaration — all optional; checking ALL of them
  // earns the FULLY EQUIPPED stamp on the passport documents.
  suppliesHeading: 'DECLARE EXPEDITION SUPPLIES:',
  supplies: ['Snacks', 'Playlist', 'Questionable plan', 'Bail money'],
  suppliesSubmit: 'DECLARE SUPPLIES',
}

// Stamped on the passport (progress + final + PNG) when a sidequest
// applicant declares every expedition supply.
export const FULLY_EQUIPPED_STAMP = 'FULLY EQUIPPED'

/** True only when EVERY canonical supply was declared — membership, not
 * array length, so duplicates or unknown persisted values can't earn the
 * stamp. Single shared predicate for the progress card, the final DOM
 * document, and the PNG canvas. */
export function isFullyEquipped(supplies: readonly string[]): boolean {
  return SIDEQUEST.supplies.every((supply) => supplies.includes(supply))
}

// ---------------------------------------------------------------------------
// Fiancé visa — vibe check interview
// ---------------------------------------------------------------------------

export const FIANCE_INTRO =
  'LYING TO A BORDER OFFICER IS A CRIME. FLIRTING WITH ONE IS WORSE.'

export interface InterviewQuestion {
  question: string
  options: string[]
}

// Trimmed to a single question per owner feedback — the "red flags" and
// "favorite food" follow-ups are cut outright (not hidden), and there is no
// visible question counter anymore (see components/visa-steps/FianceStep.tsx
// — formatFianceProgress was deleted, not just unused, since one question
// needs no counter at all). Still an array (not a bare object) so
// `fianceAnswers` in applicationContext stays the same array type — just one
// element now instead of three.
export const FIANCE_QUESTIONS: InterviewQuestion[] = [
  {
    question: 'Purpose of visit?',
    options: ['Unclear, but I paid the declaration fee', 'Diplomatic immunity via charm'],
  },
]

export const FIANCE_HIGH_RISK = 'HIGH RISK'

// The withdrawn option — a phantom third answer on the interview. Tapping it
// removes it and logs nothing anywhere except the applicant's dignity.
export const FIANCE_SECRET_OPTION = 'A secret third thing'
export const FIANCE_SECRET_REMOVED = 'OPTION REMOVED. YOUR INTEREST WAS LOGGED.'

export const FIANCE_RESULT = {
  title: 'VIBE CHECK: PASSED',
  note: '(the outcome was never in doubt. the Ministry finds you delightful.)',
}

// ---------------------------------------------------------------------------
// Business visa
// ---------------------------------------------------------------------------

export const BUSINESS = {
  prompt: 'STATE YOUR PROPOSAL. THE MINISTRY EVALUATES ALL OFFERS. (most are declined.)',
  placeholder: 'Pitch here. Numbers help. Vibes also help, less officially.',
  submit: 'SUBMIT PROPOSAL',
  receivedNote: 'PROPOSAL RECEIVED. THE MINISTRY WILL PRETEND TO CONSIDER IT.',
}

// ---------------------------------------------------------------------------
// Special purpose visa — sworn statement
// ---------------------------------------------------------------------------

export const SPECIAL = {
  prompt: 'PURPOSE OF VISIT: OTHER. ELABORATE. THIS IS BEING RECORDED.',
  placeholder: 'Sworn statement here.',
  declaration: 'I declare under penalty of mild disappointment that the above is true.',
  submit: 'SWEAR & SUBMIT',
  othernessPrompt: 'HOW OTHER IS YOUR PURPOSE?',
  othernessOptions: ['Mildly other', 'Substantially other', 'The form has no box for this'],
  // (The post-submit redaction gag was removed per owner request.)
}

export const SPECIAL_REPLIES = [
  'YOUR STATEMENT HAS BEEN FORWARDED TO THE MINISTER. (he will read it on the toilet)',
  'YOUR STATEMENT HAS BEEN FILED UNDER "MISCELLANEOUS, CONCERNING."',
  'YOUR STATEMENT HAS BEEN NOTARIZED BY NO ONE IN PARTICULAR.',
  'YOUR STATEMENT WILL BE READ ALOUD AT THE NEXT MINISTRY MEETING, TO LAUGHTER.',
]

// ---------------------------------------------------------------------------
// Consulate appointment — day availability now comes from a real Google
// Calendar (see lib/googleCalendar.ts + app/api/available-dates/route.ts,
// server-only, freeBusy-based, read-only, never writes events). This file
// just keeps the static appointment-screen copy and the fixed per-day time
// choices — there's no more "APPOINTMENT CONFIRMED" screen or its "proceed"
// button; picking a time immediately persists it and navigates on.
// ---------------------------------------------------------------------------

// "Consulate" was dropped from every user-facing appointment string per
// owner feedback (unclear word) — the heading is just APPOINTMENT and the
// calendar copy refers to "the calendar" / "the Ministry" instead.
export const APPOINTMENT = {
  heading: 'APPOINTMENT',
  daySub: 'SELECT AN AVAILABLE DAY.',
  timeSub: 'SELECT A TIME OF DAY. EXACT HOURS ARE ASSIGNED BY THE MINISTRY.',
  loadingDays: 'CHECKING THE CALENDAR…',
  unavailableHeading: 'NO APPOINTMENTS AVAILABLE.',
  unavailableNote:
    'THE CALENDAR IS FULLY BOOKED OR TEMPORARILY UNREACHABLE. TRY AGAIN LATER, OR MESSAGE THE MINISTRY DIRECTLY.',
  emptyMonth: 'NO FREE DAYS THIS MONTH. THE MINISTRY IS IN DEMAND.',
  changeDay: 'CHANGE DAY',
}

// Time-of-day choices shown once a completely-free calendar day is picked. A
// day only ever reaches this step when the WHOLE local day had zero busy
// intervals (see lib/googleCalendar.ts), so every period below is offered as
// available — deliberately vague day-parts, never clock hours (owner
// request), and no per-period unavailability logic, unlike the old joke slot
// pool further down this file. Per-visa rules: only the SIDEQUEST VISA
// (tourist) additionally offers FULL DAY and MULTI-DAY expedition durations.
// (The removed SEEK ADVICE PERMIT used to skip the time step entirely — the
// null return below is kept in the signature for that case ever returning.)
const BASE_APPOINTMENT_PERIODS: string[] = ['MORNING', 'AFTERNOON', 'EVENING']
const SIDEQUEST_APPOINTMENT_PERIODS: string[] = [...BASE_APPOINTMENT_PERIODS, 'FULL DAY', 'MULTI-DAY']

/**
 * Time-of-day options for a visa, or null when the visa requires no time at
 * all (picking a day completes the appointment immediately).
 */
export function appointmentPeriodsFor(visaType: VisaType): string[] | null {
  if (visaType === 'tourist') return SIDEQUEST_APPOINTMENT_PERIODS
  return BASE_APPOINTMENT_PERIODS
}

/** Uppercase display label for a 'YYYY-MM-DD' date string, e.g. "SAT, 14 JUN 2025". */
export function formatSlotDateLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date
    .toLocaleDateString('en-GB', {
      timeZone: 'UTC',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    .toUpperCase()
}

/**
 * The single unambiguous string stored in ApplicationState#slot. With a
 * period it's "SAT, 14 JUN 2025 — MORNING"; without one (a visa whose
 * appointmentPeriodsFor is null) it's just the date label.
 */
export function formatSlot(dateIso: string, period?: string): string {
  const label = formatSlotDateLabel(dateIso)
  return period ? `${label} — ${period}` : label
}

/** Compact passport display for a stored slot, e.g.
 * "SUN, 13 SEPT 2026 — AFTERNOON" → "13 Sept, Sun, Afternoon". The stored
 * value itself stays unchanged for records/DMs; this is display-only. */
export function formatPassportDate(slot: string): string {
  const [datePart, periodPart] = slot.split(' — ')
  const match = datePart.match(/^([A-Z]{3}),\s+(\d{1,2})\s+([A-Z]{3,})\s+\d{4}$/)
  if (!match) return slot
  const [, weekday, day, month] = match
  const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()
  return [
    `${Number(day)} ${title(month)}`,
    title(weekday),
    ...(periodPart ? [title(periodPart)] : []),
  ].join(', ')
}

/** Uppercase month heading for the appointment calendar grid, e.g. "SEPTEMBER 2026". */
export function formatMonthLabel(monthIso: string): string {
  const [year, month] = monthIso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Old joke slot-label pool — SUPERSEDED by the Google Calendar-backed
// day/time flow above; app/appointment/page.tsx no longer imports any of
// this or lib/slots.ts. Kept, not deleted, as a fallback/demo-mode reference
// (same "kept as copy-bank content" convention this file already uses for
// the unused sub-step gag lines above) — useful if the calendar integration
// is ever swapped out, or a local demo without the four GOOGLE_* env vars
// configured is wanted again.
// ---------------------------------------------------------------------------

export interface SlotLabelCandidate {
  time: string
  unavailableLabel: string
}

export const SLOT_AVAILABLE_LABEL = 'AVAILABLE'

export const BASE_SLOT_LABELS: SlotLabelCandidate[] = [
  { time: '09:00', unavailableLabel: 'CANCELLED' },
  { time: '11:30', unavailableLabel: 'reserved for someone more important' },
  { time: '13:00', unavailableLabel: 'FULLY BOOKED' },
  { time: '14:00', unavailableLabel: 'the officer stepped out' },
  { time: '15:30', unavailableLabel: 'FULLY BOOKED' },
  { time: '17:00', unavailableLabel: 'the officer is tired but present' },
  { time: '18:30', unavailableLabel: 'CANCELLED' },
]

export const FIANCE_SLOT_LABELS: SlotLabelCandidate[] = [
  { time: '19:00', unavailableLabel: 'dinner hours (fully booked, ironically)' },
  { time: '20:30', unavailableLabel: 'FULLY BOOKED' },
  { time: '23:00', unavailableLabel: 'bold choice. taken by someone bolder.' },
]

export const BUSINESS_SLOT_LABELS: SlotLabelCandidate[] = [
  { time: '10:00', unavailableLabel: 'sharp. also taken.' },
  { time: '13:00', unavailableLabel: 'lunch meeting (booked, applicant would have paid)' },
  { time: '16:00', unavailableLabel: 'FULLY BOOKED' },
]

// ---------------------------------------------------------------------------
// Identity verification (selfie step) — user-facing copy renamed from
// "BIOMETRIC VERIFICATION" to "IDENTITY VERIFICATION" per owner feedback.
// The internal /biometric route, component name, and ApplicationState's
// selfie* field names were deliberately left unchanged (an internal/route
// detail, not user-facing prose) — only this copy and its import name
// changed. The old purge-notice line ("unclaimed biometric data is
// incinerated after 72 hours…") was cut entirely, not left as empty
// spacing — see app/biometric/page.tsx.
// ---------------------------------------------------------------------------

export const IDENTITY_VERIFICATION = {
  heading: 'IDENTITY VERIFICATION',
  instruction: 'LOOK DIRECTLY AT THE CAMERA. NO SMILING. THIS IS A GOVERNMENT DOCUMENT.',
  retake: 'RETAKE',
  submit: 'SUBMIT PHOTO',
  submitting: 'SUBMITTING PHOTO…',
  noPhoto: 'NO PHOTO ON FILE',
  takePhoto: 'TAKE PHOTO',
  photoAlt: 'Applicant selfie preview',
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Secondary screening — the "absurd question" step. GUARANTEED for every
// applicant (owner request: 100% occurrence, no probability roll), with the
// question itself drawn from a small rotation pool, picked once per session
// and persisted (ApplicationState#screeningQuestion) so a refresh doesn't
// re-roll it. The IQ self-assessment (bell-curve meme + slider) is always
// shown alongside, regardless of which question was drawn.
// ---------------------------------------------------------------------------

export interface ScreeningQuestion {
  question: string
  options: string[]
}

export const SCREENING_QUESTIONS: ScreeningQuestion[] = [
  {
    question: 'A PIGEON HAS BEEN FOLLOWING YOU FOR THREE BLOCKS. WHAT DO YOU DO?',
    options: ['NOTHING. IT HAS CLEARANCE.', 'FOLLOW IT BACK.', 'FILE A COMPLAINT WITH THE PIGEON.'],
  },
  {
    question: 'HOW MANY UNREAD MESSAGES ARE YOU CURRENTLY IGNORING?',
    options: ['A NORMAL AMOUNT.', 'THE NUMBER IS CLASSIFIED.', 'I AM THE UNREAD MESSAGE.'],
  },
  {
    question: 'YOU ARE SCARED OF SPIDERS. A SPIDERMAN APPEARS IN YOUR ROOM. WHAT DO YOU DO?',
    options: ['YOU KILL IT.', 'CATCH AND RELEASE. I AM MERCIFUL.', 'WE HAVE A ROOMMATE AGREEMENT.'],
  },
  {
    question: 'YOUR ALARM RINGS. FIRST OFFICIAL ACT?',
    options: [
      'SNOOZE. WE NEGOTIATE DAILY.',
      'STAND UP IMMEDIATELY LIKE A PSYCHOPATH.',
      'MATH: \u201CIF I SKIP BREAKFAST AND TELEPORT…\u201D',
    ],
  },
  {
    question: 'A GROUP PHOTO IS BEING TAKEN. WHERE ARE YOU?',
    options: ['MIDDLE. NATURAL LEADER.', 'EDGE, FOR EASY CROPPING.', 'HOLDING THE PHONE. UNCROPPABLE. IMMORTAL.'],
  },
]

// Confidence meter — the DATE path's secondary-screening variant (it skips
// IQ). Whatever the applicant declares, the passport prints it 15% lower,
// "adjusted by officer."
export const CONFIDENCE = {
  label: 'CURRENT CONFIDENCE',
  ariaLabel: 'Declare your current confidence',
  min: 0,
  max: 100,
  default: 50,
  passportLabel: 'CONFIDENCE:',
  // Short enough to never truncate in the grid cell at 390px — the officer
  // is implied; the cut number is the joke.
  adjustedSuffix: '% (ADJUSTED)',
}

/** The officer's correction: floor(declared × 0.85). */
export function adjustedConfidence(declared: number): number {
  return Math.floor(declared * 0.85)
}

// Hesitation timer — how long the applicant stared at the visa-selection
// screen before choosing. Printed on the passport ONLY for the DATE path.
export const DECISION_TIME_LABEL = 'DECISION TIME:'
export function formatDecisionTime(seconds: number): string {
  if (seconds < 3) return 'SUSPICIOUSLY FAST.'
  return `${Math.round(seconds)} SECONDS. NOTED.`
}

// The IQ section is image + number ONLY per owner request — no sub-line, no
// section heading/instruction, no scale labels (the old `sub`/`iqHeading`/
// `iqInstruction`/`iqValueSuffix` strings were deleted, not just unrendered).
// `iqAriaLabel` survives as the slider's screen-reader name only.
export const SCREENING = {
  heading: 'SECONDARY SCREENING',
  iqAriaLabel: 'Declare your IQ',
  iqImageAlt: 'IQ bell curve distribution chart, official Ministry issue',
  iqMin: 55,
  iqMax: 145,
  iqDefault: 100,
  submit: 'SUBMIT FOR SCREENING',
}

// Which bell-curve wojak the declared IQ lands on — shown live next to the
// slider AND stamped into the small IQ field on both documents (and the
// downloadable PNG). Bands follow the meme itself: the curve's ±1σ midwit
// region is 85–115.
export interface IqFace {
  src: string
  alt: string
  caption: string
}

export function iqFaceFor(iq: number): IqFace {
  if (iq < 85) return { src: '/iq-face-low.jpg', alt: 'Blissful low-IQ wojak', caption: 'BLISSFUL. NO NOTES.' }
  if (iq <= 115) return { src: '/iq-face-mid.jpg', alt: 'Crying midwit wojak', caption: 'MIDWIT. CONDOLENCES.' }
  return { src: '/iq-face-high.jpg', alt: 'Hooded enlightened wojak', caption: 'ENLIGHTENED. ALLEGEDLY.' }
}

export const PROCESSING_HEADING = 'PROCESSING APPLICATION'

export const PROCESSING_LINES = [
  'PROCESSING APPLICATION… DO NOT REFRESH. THE MINISTRY SEES EVERYTHING.',
  'CHECKING INTERPOL DATABASE…',
  'CHECKING FOLLOWING/FOLLOWERS RATIO…',
  'CHECKING IF YOU LIKED HIS LAST POST…',
  'CROSS-REFERENCING VIBES WITH PAPERWORK…',
  'RESULT: concerning, but admissible.',
]

export const PROCESSING_TAIL_NOTE = '(this is normal. this is always normal.)'

// ---------------------------------------------------------------------------
// Approval / visa issued
// ---------------------------------------------------------------------------

// The old CONDITIONS "bring snacks" gag is fully retired per owner request
// (`conditions`/`conditionsValue` deleted — it had already been dropped from
// the documents, and now from the /visa-issued subtitle too).
export const APPROVED = {
  stamp: 'PENDING APPROVAL',
  granted: 'APPLICATION SUBMITTED.',
  valid: 'STATUS: PENDING APPROVAL.',
  download: 'DOWNLOAD VISA',
  proceed: 'REPORT TO THE AUTHORITIES',
  rendering: 'RENDERING VISA…',
  filePrefix: 'visa-',
  fallbackFileSlug: 'dictatorship-of-ignas',
}

// ---------------------------------------------------------------------------
// Shared visa document + downloadable canvas label copy
// ---------------------------------------------------------------------------

export const STICKER_LABELS = {
  republicTitle: 'DICTATORSHIP OF IGNAS',
  name: 'NAME:',
  // "IG @:" — the value renders as the bare handle (no doubled @).
  passport: 'IG @:',
  sex: 'SEX:',
  other: 'OTHER:',
  // VISA TYPE and SERIAL № labels were removed per owner request. The bare
  // selected visa name stays in the old visa-type field position.
  // ISSUED label removed per owner request; the bare issue date is printed
  // in smaller bold type at the passport's top-right corner.
  // REFERENCE № was removed from both documents per owner request — the code
  // still exists (DM reference line, records), it's just not printed on the
  // passport anymore.
  // VALID was removed per owner request — its grid slot now shows OTHER:
  // with the officer's photo observation (see passportPhotoNote below).
  unknownName: 'APPLICANT UNKNOWN',
  // Shown in the square photo frame when neither the full-resolution capture
  // nor its persisted thumbnail survived a refresh (see
  // lib/applicationContext.tsx and app/visa-issued/page.tsx).
  photoPlaceholder: 'PHOTO ON FILE',
}

// ---------------------------------------------------------------------------
// Persistent document progress card (components/DocumentProgress.tsx) — shown
// on every funnel page from /identity onward. It shares VisaDocument's DOM
// structure with the final document on app/visa-issued/page.tsx, so it
// reuses STICKER_LABELS above as the single source for every field label the
// two share — including NAME/PASSPORT №/VISA TYPE/SERIAL №/REFERENCE №/
// ISSUED/VALID/CONDITIONS, the republic title, and the "VISA — " prefix.
// By /biometric (the last funnel page before the photo), every field except
// REFERENCE № is filled: SERIAL № is generated once at visa selection and
// stored in applicationContext (see ApplicationState#serial), VALID/
// CONDITIONS fill immediately on visa selection from APPROVED.validValue /
// APPROVED.conditionsValue below (the same constants /visa-issued renders),
// and ISSUED fills once the appointment slot is confirmed (via
// formatIssuedDate above, stored in ApplicationState#issuedDate). REFERENCE №
// only fills once generated on /processing — that's the one truly
// issuance-only value. APPOINTMENT is the only label unique to the progress
// card, and is deliberately NOT one of the replicated sticker fields — it's
// rendered as its own separate line below the field grid, since the
// appointment slot is real funnel data but has no equivalent row on the
// sticker itself.
//
// A second, optional addendum line sits below the appointment line: whatever
// typed/selected content the chosen visa's sub-step collected (business
// pitch, special-purpose sworn statement, or the fiancé interview answers)
// — tourist has no sub-step, so it never renders one.
// Same pattern as APPOINTMENT: not a sticker field, shown once the relevant
// context field is non-empty, one label per visa type below so a single
// generic "ANSWER:" doesn't get confusingly reused across very different
// content. Fiancé's answer is rendered in one compact line (see
// components/DocumentProgress.tsx) and, like every other value in this card,
// CSS-truncated if too long for one line — never discarded from state.
// ---------------------------------------------------------------------------

export const DOCUMENT_PROGRESS = {
  appointmentLabel: 'DATE:',
  ideaLabel: 'IDEA:',
  pitchLabel: 'PITCH:',
  statementLabel: 'STATEMENT:',
  interviewAnswersLabel: 'INTERVIEW:',
  screeningLabel: 'SCREENING:',
  othernessLabel: 'OTHERNESS:',
  dutyFreeLabel: 'DUTY-FREE:',
  // No iqLabel — the IQ addendum prints as wojak face + bare number, no text
  // (owner request; see lib/visaAddendum.ts#getScreeningAddenda).
}

// ---------------------------------------------------------------------------
// Identity verification — per-path officer observation, revealed right after
// the selfie is captured on /biometric. Pure deadpan annotation; nothing is
// actually measured, obviously.
// ---------------------------------------------------------------------------

export const BIOMETRIC_NOTES: Record<VisaType, string> = {
  fiance: 'ELEVATED PULSE DETECTED. NOTED.',
  tourist: 'SUSPECT IS DEHYDRATED. NOTED.',
  business: 'POSTURE COULD BE BETTER. NOTED.',
  special: 'SUBJECT APPEARS NERVOUS.',
}

/** The passport's OTHER: field — the same photo observation, compacted for a
 * grid cell (trailing "NOTED." and final period stripped). Fills only once a
 * photo exists, since it is nominally an observation OF the photo. */
export function passportPhotoNote(visaType: VisaType): string {
  return BIOMETRIC_NOTES[visaType].replace(/\s*NOTED\.$/, '').replace(/[.\s]+$/, '')
}

// ---------------------------------------------------------------------------
// Officer mood — rotates by hour
// ---------------------------------------------------------------------------

export interface OfficerMood {
  dots: string
  label: string
}

export const OFFICER_MOODS: OfficerMood[] = [
  { dots: '●●●●●', label: 'excellent — proceed with confidence' },
  { dots: '●●●●○', label: 'good — proceed normally' },
  { dots: '●●●○○', label: 'proceed with caution' },
  { dots: '●●○○○', label: 'proceed with a lot of caution' },
  { dots: '●○○○○', label: 'do not make eye contact' },
]

export const OFFICER_MOOD_PREFIX = 'CURRENT OFFICER MOOD:'

export function getOfficerMood(hour = new Date().getHours()): OfficerMood {
  return OFFICER_MOODS[hour % OFFICER_MOODS.length]
}

// ---------------------------------------------------------------------------
// Bribe
// ---------------------------------------------------------------------------

export const BRIBE = {
  button: 'OFFER BRIBE',
  response: 'BRIBE ACCEPTED. ATTEMPTED CORRUPTION OF A STATE OFFICER LOGGED. APPLICATION DENIED.',
  countSuffix: 'attempted, this device',
}

// Printed as the denial reason when /denied is reached via `?via=bribe`
// (see components/BribeButton.tsx + app/denied/page.tsx).
export const BRIBE_DENIAL_REASON =
  'Attempted to bribe a state officer. The officer kept the cash. You keep the denial.'


// The drawn cash pile peeking from the screen edge (components/HiddenBribe.tsx)
// — collapsed-state aria-label; the revealed state reuses BRIBE.button above.
export const HIDDEN_BRIBE_ARIA_LABEL = 'Something is peeking out from behind the desk. Tap to investigate.'

// ---------------------------------------------------------------------------
// Idle nudge
// ---------------------------------------------------------------------------

export const IDLE_NUDGE = 'APPLICANT. THE QUEUE IS MOVING. ARE YOU?'
export const IDLE_TIMEOUT_MS = 20_000

// ---------------------------------------------------------------------------
// Footer / 404
// ---------------------------------------------------------------------------

export const FOOTER = '© Ministry of Interior, Dictatorship of Ignas. Unauthorized fun prohibited.'

export const FOOTER_NAV = {
  statistics: 'Statistics',
  dutyFree: 'Duty-Free',
  terms: 'Terms',
}

// Shared across not-found.tsx, /statistics, /duty-free, /terms — all four have
// an identical "go back home" link at the bottom.
export const RETURN_TO_BORDER_CONTROL = 'RETURN TO BORDER CONTROL'

export const NOT_FOUND = {
  title: 'FORM MISPLACED.',
  sub: 'THE MINISTRY APOLOGIZES FOR NOTHING. REF: 404',
  home: RETURN_TO_BORDER_CONTROL,
}

// ---------------------------------------------------------------------------
// Statistics page (placeholder numbers — no fiancé counts, ever)
// ---------------------------------------------------------------------------

export const STATISTICS_HEADING = 'OFFICIAL MINISTRY STATISTICS'
export const STATISTICS_SUBHEADING = 'FIGURES ARE ACCURATE AS OF WHENEVER THE MINISTRY LAST CHECKED.'
export const STATISTICS_BRIBE_LABEL = 'Bribes attempted'

export const STATISTICS_ROWS: { label: string; value: string }[] = [
  { label: 'Entries denied', value: '812' },
  { label: 'Tourist visas issued', value: '304' },
  { label: 'Consultation permits issued', value: '129' },
  { label: 'Business visas issued', value: '41' },
  { label: 'Special purpose visas issued', value: '17' },
  { label: 'Appeals filed', value: '596' },
  { label: 'Appeals granted', value: '596' },
  { label: 'Applications pending identity verification', value: '88' },
  { label: 'Passport fraud detected', value: '3' },
]
export const STATISTICS_NOTE =
  'NOTE: fiancé visa figures are withheld. The Ministry protects romantic privacy.'
export const STATISTICS_FOOTNOTE = 'The Dictatorship has one (1) citizen and he is doing his best.'
export const STATISTICS_BRIBE_BASE = 214

// ---------------------------------------------------------------------------
// Duty-free
// ---------------------------------------------------------------------------

export const DUTY_FREE_HEADING = 'DUTY-FREE'
export const DUTY_FREE_SUBHEADING = 'TAX-FREE SHOPPING FOR THE DISCERNING APPLICANT.'

export const DUTY_FREE_ITEMS: { name: string; status: string; available?: boolean }[] = [
  { name: "Ignas's attention — 15 min", status: 'SOLD OUT' },
  { name: 'One (1) good morning text', status: 'restocked weekly' },
  { name: 'Unsolicited life advice', status: 'AVAILABLE', available: true },
  { name: 'One (1) inside joke, lifetime license', status: "issued at officer's discretion" },
  { name: 'Ignas laughing at your joke', status: 'availability not guaranteed' },
  { name: 'Reply within 5 minutes', status: 'DISCONTINUED' },
  { name: 'Priority boarding on future sidequests', status: 'AVAILABLE', available: true },
]

// ---------------------------------------------------------------------------
// Terms & Conditions (paragraph 6 easter egg — see app/terms/page.tsx's
// hardcoded index for the screenshot-worthy paragraph; renumbered down from
// 7 after paragraph 6, "unclaimed biometric data is incinerated…", was cut).
// ---------------------------------------------------------------------------

export const TERMS_HEADING = 'TERMS & CONDITIONS'
export const TERMS_SUBHEADING = 'READ CAREFULLY. NO ONE ELSE DOES.'

export const TERMS_PARAGRAPHS: string[] = [
  '1. By using this site you acknowledge the Dictatorship of Ignas as a sovereign, if entirely fictional, state.',
  '2. All visas are issued at the sole discretion of the Ministry, which is one (1) person.',
  '3. The Ministry reserves the right to deny entry for reasons including but not limited to vibes.',
  '4. Bribes are accepted but change nothing. See Bribe Policy, which does not exist.',
  '5. Identity verification data (your selfie) is used only to composite your visa sticker and is not sold, because nobody is buying.',
  '6. If you actually read this far: screenshot this paragraph and DM it to the Ministry for its eternal respect. No prize. Just respect.',
  '7. This document is legally binding in no jurisdiction whatsoever.',
  '8. The Ministry may change these terms at any time, for any reason, or no reason.',
  '9. The Dictatorship of Ignas is a full democracy. Ignas has won every election since birth with 100% of the vote.',
]

// ---------------------------------------------------------------------------
// Deep link — ig.me can't prefill DM text, so the flow is: open the DM thread
// synchronously (avoids popup blocking), then best-effort copy the reference
// line to the clipboard so the applicant can paste it.
// ---------------------------------------------------------------------------

export const CONSULATE_HANDLE = 'ignas_simanavicius'
export const CONSULATE_DM_URL = `https://ig.me/m/${CONSULATE_HANDLE}`

export function buildReferenceLine(params: {
  visaType: string
  referenceCode: string
  slot: string
}): string {
  return `${params.visaType} ${params.referenceCode} — ${params.slot}`
}

// The reference № is already printed on the visa sticker itself, so there is
// no separate always-visible "reference line" box on /visa-issued anymore —
// tapping PROCEED best-effort copies it straight to the clipboard instead.
// COPY_FAILED_NOTE is only shown alongside the reference line itself (as
// small inline text) when the clipboard write actually failed.
export const COPY_INSTRUCTION = 'REFERENCE LINE COPIED — PASTE IT IN THE DM.'
export const COPY_FAILED_INSTRUCTION = 'COULD NOT COPY AUTOMATICALLY. COPY THE LINE BELOW AND PASTE IT INTO THE DM.'
