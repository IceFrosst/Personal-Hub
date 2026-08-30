// Backend stubs. When NEXT_PUBLIC_SUPABASE_URL is set, these best-effort POST to
// the (not-yet-created) `republic` Supabase schema described in SIDEQUEST_PLAN.md
// — wrapped in try/catch so a missing table never breaks the funnel. When it's
// absent (the default, today), everything falls back to localStorage so the
// whole experience works with zero backend. No migrations, no credentials required.

import { computeSlots, type Slot } from './slots'
import type { ApplicationState } from './applicationContext'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SCHEMA = 'republic'

const LS_KEYS = {
  applicantSeq: 'republic:applicant-seq',
  bribeCount: 'republic:bribe-count',
  applications: 'republic:applications-log',
} as const

function isBrowser() {
  return typeof window !== 'undefined'
}

function readLocal<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal<T>(key: string, value: T) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or disabled — no-op, this is a joke site, not a bank
  }
}

// PostgREST custom-schema requests use the *unqualified* table name in the URL
// path plus a `Content-Profile` (write) / `Accept-Profile` (read) header naming
// the schema — `rest/v1/republic.applications` (dot-qualified in the path) is
// not a valid PostgREST route and would 404 silently forever. `response.ok` is
// checked explicitly so a schema/table that doesn't exist yet (true today,
// since no `republic` schema has been provisioned) is reported as a failure
// rather than treated as a silent success.
async function tryRest(table: string, body: Record<string, unknown>): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal',
        'Content-Profile': SUPABASE_SCHEMA,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok && process.env.NODE_ENV !== 'production') {
      console.warn(`[republic] best-effort write to ${table} failed: ${response.status}`)
    }
    return response.ok
  } catch {
    // best-effort only — the funnel never blocks on this
    return false
  }
}

// ---------------------------------------------------------------------------
// Applications — ONE record per completed funnel, created exactly once, at
// the point the reference code is generated (see lib/applicationContext's
// consumer in app/processing/page.tsx). It links every piece of the
// application: identity (name + handle), visa type, sub-step answers, the
// chosen appointment slot, the reference code, and selfie metadata (never the
// raw image — see `buildApplicationRecord`).
// ---------------------------------------------------------------------------

export interface ApplicationRecord {
  applicantName: string
  instagramHandle: string
  visaType: string
  slot: string
  referenceCode: string
  matter?: string
  pitch?: string
  statement?: string
  interviewAnswers?: string[]
  selfieCaptured: boolean
  selfieSizeBytes?: number
}

/** Rough decoded byte size of a base64 data URL, without holding onto the image itself. */
function approxDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round((base64.length * 3) / 4)
}

/**
 * Builds the single, final application record from the funnel's accumulated
 * context state once a reference code exists. Only the sub-step field that's
 * actually relevant to the chosen visa type is included; the selfie itself is
 * never embedded — only whether one was captured and its approximate size.
 */
export function buildApplicationRecord(state: ApplicationState, referenceCode: string): ApplicationRecord {
  const record: ApplicationRecord = {
    applicantName: state.applicantName,
    instagramHandle: state.instagramHandle,
    visaType: state.visaType ?? 'tourist',
    slot: state.slot ?? '',
    referenceCode,
    selfieCaptured: Boolean(state.selfieDataUrl),
    selfieSizeBytes: state.selfieDataUrl ? approxDataUrlBytes(state.selfieDataUrl) : undefined,
  }
  if (state.visaType === 'consultation' && state.consultationMatter) record.matter = state.consultationMatter
  if (state.visaType === 'business' && state.businessPitch) record.pitch = state.businessPitch
  if (state.visaType === 'special' && state.specialStatement) record.statement = state.specialStatement
  if (state.visaType === 'fiance' && state.fianceAnswers.length) record.interviewAnswers = state.fianceAnswers
  return record
}

/**
 * Persists the ONE finalized application record. Idempotent by
 * `referenceCode`: since a reference code is generated exactly once per
 * completed application, a duplicate call (e.g. a dev/StrictMode double
 * effect invocation that slipped past the caller's own guard) is a no-op
 * rather than a second log entry or a second network write.
 */
export async function recordApplication(record: ApplicationRecord): Promise<void> {
  const log = readLocal<ApplicationRecord[]>(LS_KEYS.applications, [])
  if (log.some((r) => r.referenceCode === record.referenceCode)) return
  writeLocal(LS_KEYS.applications, [...log, record])
  void tryRest('applications', {
    applicant_name: record.applicantName,
    instagram_handle: record.instagramHandle,
    visa_type: record.visaType,
    slot: record.slot,
    reference_code: record.referenceCode,
    matter: record.matter ?? null,
    pitch: record.pitch ?? null,
    statement: record.statement ?? null,
    interview_answers: record.interviewAnswers ?? null,
    selfie_captured: record.selfieCaptured,
    selfie_size_bytes: record.selfieSizeBytes ?? null,
  })
}

export async function recordAppointment(params: {
  visaType: string
  slot: string
  referenceCode: string
}): Promise<void> {
  void tryRest('appointments', {
    visa_type: params.visaType,
    slot: params.slot,
    reference_code: params.referenceCode,
  })
}

export async function recordBribe(): Promise<number> {
  const current = readLocal<number>(LS_KEYS.bribeCount, 0)
  const next = current + 1
  writeLocal(LS_KEYS.bribeCount, next)
  void tryRest('bribes', { count: 1 })
  return next
}

export function getBribeCount(): number {
  return readLocal<number>(LS_KEYS.bribeCount, 0)
}

// Applicant counter — starts at a lore-appropriate base and increments per
// browser. A real Supabase counter (mentioned in the plan) would replace this
// with a shared value; until then it's a believable placeholder.
const APPLICANT_BASE = 1043

export function getApplicantNumber(): number {
  const seq = readLocal<number>(LS_KEYS.applicantSeq, 0)
  if (seq > 0) return APPLICANT_BASE + seq
  const assigned = Math.floor(Math.random() * 40) + 1
  writeLocal(LS_KEYS.applicantSeq, assigned)
  return APPLICANT_BASE + assigned
}

// Appointment slots — hardcoded joke pool with deterministic weekly scarcity
// today (lib/slots.ts); shaped as an async call so a real Google
// Calendar-backed source can replace the body later without touching callers.
export async function getAvailableSlots(visaType: ApplicationState['visaType']): Promise<Slot[]> {
  return computeSlots(visaType)
}

// No Supabase Storage bucket exists yet — this always resolves to the local
// data URL used for the canvas composite. Kept async + typed so a real
// private-bucket upload can replace the body later without touching call sites.
export async function uploadPhoto(dataUrl: string): Promise<string | null> {
  return dataUrl
}
