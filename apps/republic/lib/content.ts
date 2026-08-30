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
export const VISAS: VisaDefinition[] = [
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
    slug: 'business',
    icon: '💼',
    name: 'BUSINESS VISA',
    tagline: '',
    lines: ['Purpose: money talk, projects'],
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
  subtitle: 'BORDER CONTROL',
  formCode: 'FORM 1G-NAS — ENTRY DECLARATION',
  applicantNumberPrefix: 'APPLICANT №',
  // Shown until lib/api.ts#getApplicantNumber resolves inside a client effect
  // (never during render — see the hydration-safety Gotcha in CLAUDE.md).
  applicantNumberPlaceholder: '————',
  question: 'DO YOU HAVE SOMETHING TO DECLARE?',
  yes: 'YES',
  no: 'NO',
  priorityStamp: 'PRIORITY',
  passportStampsLabel: 'PASSPORT STAMPS ON FILE:',
}

/** Zero-padded to 4 digits — matches the 47–4999 range in lib/api.ts#getApplicantNumber. */
export function formatApplicantNumber(n: number): string {
  return String(n).padStart(4, '0')
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
  'ROUTINE QUESTIONS. ANSWER HONESTLY. DISHONESTY IS CUTE BUT ILLEGAL.'

export interface InterviewQuestion {
  question: string
  options: string[]
}

export const FIANCE_QUESTIONS: InterviewQuestion[] = [
  {
    question: 'Purpose of visit?',
    options: ['Romance', 'Chaos, but the fun kind', 'Unclear, but I paid the fee', 'Diplomatic immunity via charm'],
  },
  {
    question: 'Are you carrying any red flags?',
    options: ['No', 'A couple, tastefully hidden', 'They are more of a collection', 'I AM the red flag'],
  },
  {
    question: 'Favorite food — answer carefully, this is binding.',
    options: ['Whatever he\'s having', 'Something expensive', 'Whatever\'s cheapest on the menu', 'Snacks, generally'],
  },
]

export const FIANCE_HIGH_RISK = 'HIGH RISK'

export const FIANCE_RESULT = {
  title: 'VIBE CHECK: PASSED',
  note: '(the outcome was never in doubt. the Ministry finds you delightful.)',
}

export function formatFianceProgress(current: number, total: number): string {
  return `QUESTION ${current} OF ${total}`
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
// Consulate appointment — the candidate slot *pools* live in lib/slots.ts
// (deterministic weekly scarcity, seeded so it's stable but rotates), which is
// what lib/api.ts#getAvailableSlots reads from. This file just keeps the
// static appointment-screen copy.
// ---------------------------------------------------------------------------

export const APPOINTMENT = {
  heading: 'CONSULATE APPOINTMENT',
  sub: 'SELECT A TIME SLOT. THE CONSULATE THANKS YOU FOR YOUR PATIENCE, WHICH IS MANDATORY.',
  loading: 'LOADING SLOTS…',
  slotLabelPrefix: 'SLOT:',
  confirmedTitle: 'APPOINTMENT CONFIRMED.',
  confirmedLines: ['BRING: yourself, snacks.', 'DO NOT BRING: the vibe you had at entry.'],
  continue: 'PROCEED TO BIOMETRICS',
}

// ---------------------------------------------------------------------------
// Appointment slot label pool — the *selection logic* (deterministic weekly
// scarcity) lives in lib/slots.ts; this is just the joke copy per slot.
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
// Biometric verification
// ---------------------------------------------------------------------------

export const BIOMETRIC = {
  heading: 'BIOMETRIC VERIFICATION',
  instruction: 'LOOK DIRECTLY AT THE CAMERA. NO SMILING. THIS IS A GOVERNMENT DOCUMENT.',
  retake: 'RETAKE',
  submit: 'SUBMIT BIOMETRICS',
  submitting: 'SUBMITTING…',
  noPhoto: 'NO PHOTO ON FILE',
  takePhoto: 'TAKE PHOTO',
  photoAlt: 'Applicant selfie preview',
  purgeNotice:
    'UNCLAIMED BIOMETRIC DATA IS INCINERATED AFTER 72 HOURS. THE MINISTRY DOES NOT KEEP SOUVENIRS.',
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

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
  proceed: 'PROCEED TO CONSULATE',
  rendering: 'RENDERING VISA…',
  filePrefix: 'visa-',
  fallbackFileSlug: 'dictatorship-of-ignas',
}

// ---------------------------------------------------------------------------
// Visa sticker (canvas composite) label copy
// ---------------------------------------------------------------------------

export const STICKER_LABELS = {
  republicTitle: 'DICTATORSHIP OF IGNAS',
  visaPrefix: 'VISA — ',
  name: 'NAME:',
  passport: 'PASSPORT №:',
  visaType: 'VISA TYPE:',
  serial: 'SERIAL №:',
  reference: 'REFERENCE №:',
  issued: 'ISSUED:',
  valid: 'VALID:',
  conditions: 'CONDITIONS:',
  unknownName: 'APPLICANT UNKNOWN',
  // Shown in the oval photo frame when neither the full-resolution capture
  // nor its persisted thumbnail survived a refresh (see
  // lib/applicationContext.tsx and app/visa-issued/page.tsx).
  photoPlaceholder: 'PHOTO ON FILE',
}

// ---------------------------------------------------------------------------
// Persistent document progress card (components/DocumentProgress.tsx) — shown
// on every funnel page from /identity onward. Labels only; which rows are
// visible/filled and the free-text truncation logic live in the component.
// ---------------------------------------------------------------------------

export const DOCUMENT_PROGRESS = {
  title: 'PASSPORT',
  declarationLabel: 'DECLARATION:',
  declarationValue: 'SOMETHING TO DECLARE',
  nameLabel: 'NAME:',
  passportLabel: 'PASSPORT №:',
  visaTypeLabel: 'VISA TYPE:',
  fianceAnsweredValue: 'ANSWERED',
  appointmentLabel: 'APPOINTMENT:',
  biometricsLabel: 'BIOMETRICS:',
  biometricsValue: 'CAPTURED',
  statusLabel: 'STATUS:',
  statusValue: 'STAMPED: APPROVED',
}

export const DOCUMENT_PROGRESS_SUBSTEP_LABELS: Partial<Record<VisaType, string>> = {
  consultation: 'MATTER:',
  business: 'PITCH:',
  special: 'STATEMENT:',
  fiance: 'INTERVIEW:',
}

// Purely decorative machine-readable-zone flavor line for the passport-styled
// components/DocumentProgress.tsx — not functionally parsed, just dressing.
// Padded to the real TD3 MRZ line length (44 chars) with `<` filler.
export const PASSPORT_MRZ_LINE = 'P<IGNDICTATORSHIP<OF<IGNAS'.padEnd(44, '<')

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
// Passport / returning visitor
// ---------------------------------------------------------------------------

export const RETURNING_VISITOR = 'WELCOME BACK. YOUR FILE HAS BEEN FLAGGED.'
export const LOYALTY_MESSAGE =
  'FREQUENT APPLICANT STATUS GRANTED. PERKS: none. RECOGNITION: eternal.'

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
// Terms & Conditions (paragraph 7 easter egg)
// ---------------------------------------------------------------------------

export const TERMS_HEADING = 'TERMS & CONDITIONS'
export const TERMS_SUBHEADING = 'READ CAREFULLY. NO ONE ELSE DOES.'

export const TERMS_PARAGRAPHS: string[] = [
  '1. By using this site you acknowledge the Dictatorship of Ignas as a sovereign, if entirely fictional, state.',
  '2. All visas are issued at the sole discretion of the Ministry, which is one (1) person.',
  '3. The Ministry reserves the right to deny entry for reasons including but not limited to vibes.',
  '4. Bribes are accepted but change nothing. See Bribe Policy, which does not exist.',
  '5. Biometric data (your selfie) is used only to composite your visa sticker and is not sold, because nobody is buying.',
  '6. Unclaimed biometric data is incinerated after 72 hours. The Ministry does not keep souvenirs.',
  '7. If you actually read this far: screenshot this paragraph and DM it to the Ministry for its eternal respect. No prize. Just respect.',
  '8. This document is legally binding in no jurisdiction whatsoever.',
  '9. The Ministry may change these terms at any time, for any reason, or no reason.',
  '10. The Dictatorship of Ignas is a full democracy. Ignas has won every election since birth with 100% of the vote.',
  '11. © Ministry of Interior, Dictatorship of Ignas. Unauthorized fun prohibited.',
]

// ---------------------------------------------------------------------------
// Deep link — ig.me can't prefill DM text, so the flow is: copy the reference
// line to the clipboard, then open the DM thread and paste it.
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

export const REFERENCE_LINE_LABEL = 'YOUR REFERENCE LINE (for the DM):'
export const COPY_BUTTON_LABEL = 'COPY REFERENCE LINE'
export const COPY_INSTRUCTION =
  'REFERENCE LINE COPIED. PASTE IT INTO THE DM. THE MINISTRY DOES NOT PRE-FILL FORMS IT DID NOT WRITE.'
export const COPY_FAILED_INSTRUCTION =
  'COULD NOT COPY AUTOMATICALLY. COPY THE REFERENCE LINE ABOVE MANUALLY AND PASTE IT INTO THE DM.'
