// All editable copy/config for the Dictatorship of Ignas lives here.
// Deadpan is the law — do not punch up the jokes, just keep them straight-faced.

export type VisaType = 'tourist' | 'consultation' | 'fiance' | 'business' | 'special'

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
// relative order (tourist, consultation, fiance, special).
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
    slug: 'consultation',
    icon: '📋',
    name: 'SEEK ADVICE PERMIT',
    tagline: '',
    lines: ['Advice quality: unknown'],
  },
  {
    slug: 'fiance',
    icon: '💍',
    name: 'DATE VISA',
    tagline: '',
    lines: [],
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
  priorityStamp: 'PRIORITY',
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

export const DENIAL = {
  stamp: 'ENTRY DENIED',
  reasonPrefix: 'REASON:',
  status: 'STATUS: WASTING OFFICER\'S TIME.',
  appeal: 'FILE AN APPEAL (wait, actually…)',
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
// Consultation permit
// ---------------------------------------------------------------------------

export const CONSULTATION = {
  prompt: 'STATE YOUR MATTER, APPLICANT.',
  placeholder: 'Type your matter here. Be concise. The Ministry has other applicants.',
  submit: 'SUBMIT MATTER',
}

export const PRELIMINARY_RULINGS = [
  'PRELIMINARY RULING: you already know the answer. FULL VERDICT: via DM, 1–3 business moods.',
  'PRELIMINARY RULING: this is above the officer\'s pay grade. Escalated to the Minister. FULL VERDICT: via DM.',
  'PRELIMINARY RULING: inconclusive. The Ministry needs to think about it over a coffee. FULL VERDICT: via DM.',
  'PRELIMINARY RULING: sounds like a you problem, but a fixable one. FULL VERDICT: via DM, 1–3 business moods.',
]

// ---------------------------------------------------------------------------
// Fiancé visa — vibe check interview
// ---------------------------------------------------------------------------

export const FIANCE_INTRO =
  'ROUTINE QUESTION. ANSWER HONESTLY. DISHONESTY IS CUTE BUT ILLEGAL.'

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
// pool further down this file. Per-visa rules: SEEK ADVICE PERMIT
// (consultation) skips the time step entirely — picking a day IS the whole
// appointment — and only the SIDEQUEST VISA (tourist) additionally offers
// FULL DAY and MULTI-DAY expedition durations.
const BASE_APPOINTMENT_PERIODS: string[] = ['MORNING', 'AFTERNOON', 'EVENING']
const SIDEQUEST_APPOINTMENT_PERIODS: string[] = [...BASE_APPOINTMENT_PERIODS, 'FULL DAY', 'MULTI-DAY']

/**
 * Time-of-day options for a visa, or null when the visa requires no time at
 * all (picking a day completes the appointment immediately).
 */
export function appointmentPeriodsFor(visaType: VisaType): string[] | null {
  if (visaType === 'consultation') return null
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
 * period it's "SAT, 14 JUN 2025 — MORNING"; without one (visas that need no
 * time, i.e. consultation) it's just the date label.
 */
export function formatSlot(dateIso: string, period?: string): string {
  const label = formatSlotDateLabel(dateIso)
  return period ? `${label} — ${period}` : label
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

export const SCREENING = {
  heading: 'SECONDARY SCREENING',
  sub: 'YOU HAVE BEEN RANDOMLY SELECTED FOR ADDITIONAL QUESTIONING. EVERYONE IS.',
  iqHeading: 'COGNITIVE SELF-ASSESSMENT',
  iqInstruction: 'DECLARE YOUR IQ. THE MINISTRY WILL NOT VERIFY IT, BUT IT WILL JUDGE.',
  iqImageAlt: 'IQ bell curve distribution chart, official Ministry issue',
  iqMin: 55,
  iqMax: 145,
  iqDefault: 100,
  iqValueSuffix: ' — SELF-DECLARED, UNVERIFIED',
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

export const APPROVED = {
  stamp: 'APPROVED',
  granted: 'VISA GRANTED.',
  validValue: 'until further notice',
  conditionsValue: 'bring snacks',
  valid: 'VALID: until further notice.',
  conditions: 'CONDITIONS: bring snacks.',
  download: 'DOWNLOAD VISA',
  proceed: 'REPORT TO THE MINISTRY',
  rendering: 'RENDERING VISA…',
  filePrefix: 'visa-',
  fallbackFileSlug: 'dictatorship-of-ignas',
}

// ---------------------------------------------------------------------------
// Shared visa document + downloadable canvas label copy
// ---------------------------------------------------------------------------

export const STICKER_LABELS = {
  republicTitle: 'DICTATORSHIP OF IGNAS',
  visaPrefix: 'VISA — ',
  name: 'NAME:',
  passport: 'PASSPORT №:',
  visaType: 'VISA TYPE:',
  sex: 'SEX:',
  serial: 'SERIAL №:',
  reference: 'REFERENCE №:',
  issued: 'ISSUED:',
  valid: 'VALID:',
  conditions: 'CONDITIONS:',
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
// typed/selected content the chosen visa's sub-step collected (consultation
// matter, business pitch, special-purpose sworn statement, or the fiancé
// interview answers) — tourist has no sub-step, so it never renders one.
// Same pattern as APPOINTMENT: not a sticker field, shown once the relevant
// context field is non-empty, one label per visa type below so a single
// generic "ANSWER:" doesn't get confusingly reused across very different
// content. Fiancé's answer is rendered in one compact line (see
// components/DocumentProgress.tsx) and, like every other value in this card,
// CSS-truncated if too long for one line — never discarded from state.
// ---------------------------------------------------------------------------

export const DOCUMENT_PROGRESS = {
  appointmentLabel: 'APPOINTMENT:',
  matterLabel: 'MATTER:',
  pitchLabel: 'PITCH:',
  statementLabel: 'STATEMENT:',
  interviewAnswersLabel: 'INTERVIEW:',
  screeningLabel: 'SCREENING:',
  iqLabel: 'DECLARED IQ:',
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
  button: '💵 OFFER BRIBE',
  response: 'BRIBE ACCEPTED. IT CHANGES NOTHING. THE MINISTRY THANKS YOU.',
  countSuffix: 'attempted, this device',
}

export function formatBribeStatus(count: number): string {
  return `${BRIBE.response} (${count} ${BRIBE.countSuffix})`
}

// The peeking cash-emoji tab (components/HiddenBribe.tsx) — collapsed state
// aria-label; the revealed state reuses BRIBE.button above.
export const HIDDEN_BRIBE_ARIA_LABEL = 'Something is peeking out. Tap to investigate.'

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

export const DUTY_FREE_ITEMS: { name: string; status: string }[] = [
  { name: "Ignas's attention — 15 min", status: 'SOLD OUT' },
  { name: 'One (1) good morning text', status: 'restocked weekly' },
  { name: 'A well-timed compliment', status: 'pay at consulate' },
  { name: 'Unsolicited life advice', status: 'always in stock, ask no one' },
  { name: 'Playlist recommendation', status: 'SOLD OUT' },
  { name: 'A single (1) hug, terms apply', status: 'pay at consulate' },
  { name: 'Priority boarding on future sidequests', status: 'SOLD OUT' },
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
  '10. © Ministry of Interior, Dictatorship of Ignas. Unauthorized fun prohibited.',
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
