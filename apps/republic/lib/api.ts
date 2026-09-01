// Backend stubs. The `republic` Supabase schema now exists for real, but only for
// one narrow purpose so far: the global applicant-number sequence/RPC (see
// supabase/migrations/0001_applicant_number_sequence.sql and getApplicantNumber
// below) — that path needs NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY
// configured and fails closed to `null` without them. Everything else in this file
// (recordApplication/recordAppointment/recordBribe) still targets the
// `applications`/`appointments`/`bribes` tables described in SIDEQUEST_PLAN.md,
// which have NOT been created yet — those best-effort POST to Supabase only if the
// env vars are set, wrapped in try/catch so a missing table never breaks the
// funnel, and otherwise fall back to localStorage so the whole experience works
// with zero backend.

import { computeSlots, type Slot } from './slots'
import type { ApplicationState } from './applicationContext'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SCHEMA = 'republic'

const LS_KEYS = {
  bribeCount: 'republic:bribe-count',
  applications: 'republic:applications-log',
  // Versioned key deliberately ignores the legacy random-number cache, so
  // every browser receives a genuine global sequence value after this rollout.
  applicantNumber: 'republic:applicant-number-v2',
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
// checked explicitly so a table that doesn't exist yet (true today for
// `applications`/`appointments`/`bribes` — the `republic` schema itself now
// exists, per the applicant-number migration, but only the sequence/RPC were
// ever created in it) is reported as a failure rather than treated as a silent
// success.
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
  idea?: string
  pitch?: string
  statement?: string
  interviewAnswers?: string[]
  dutyFreeItems?: string[]
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
    selfieCaptured: state.selfieCaptured,
    selfieSizeBytes: state.selfieDataUrl ? approxDataUrlBytes(state.selfieDataUrl) : undefined,
  }
  // `matter` (the removed SEEK ADVICE PERMIT's sub-step field) stays in the
  // record/table shape for forward-compat but is never populated anymore.
  if (state.visaType === 'tourist' && state.sidequestIdea) record.idea = state.sidequestIdea
  if (state.visaType === 'business' && state.businessPitch) record.pitch = state.businessPitch
  if (state.visaType === 'special' && state.specialStatement) record.statement = state.specialStatement
  if (state.visaType === 'fiance' && state.fianceAnswers.length) record.interviewAnswers = state.fianceAnswers
  if (state.dutyFreeItems.length) record.dutyFreeItems = state.dutyFreeItems
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
    idea: record.idea ?? null,
    pitch: record.pitch ?? null,
    statement: record.statement ?? null,
    interview_answers: record.interviewAnswers ?? null,
    duty_free_items: record.dutyFreeItems ?? null,
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

// Applicant number — a real global sequential count, shared by every
// visitor, backed by the `republic.next_applicant_number()` Supabase RPC
// (see apps/republic/supabase/migrations/0001_applicant_number_sequence.sql
// — a Postgres sequence wrapped in a SECURITY DEFINER function, granted to
// anon/authenticated so the browser can call it directly). Each browser/
// device only ever calls the RPC ONCE — the very first time it resolves a
// number, the result is cached in localStorage and every later call (this
// session or any future one, same device) reads the cache instead, so
// reloading the landing page never burns another number. There is
// deliberately NO random/fake fallback: if the RPC is unreachable (no
// Supabase env vars configured, network failure, missing/misconfigured
// schema exposure — see SCHEMA_RULES.md's Data API exposure note) this
// resolves to `null` and app/page.tsx just keeps showing
// LANDING.applicantNumberPlaceholder until a later visit succeeds. Nothing
// is ever fabricated locally.
async function fetchNextApplicantNumber(): Promise<number | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    // RPC calls are POSTs, so — same as tryRest's table writes above — the
    // schema is named via the `Content-Profile` header (not a dot-qualified
    // path segment); `republic.next_applicant_number` is called as
    // unqualified `next_applicant_number` at `rest/v1/rpc/...`.
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/next_applicant_number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Profile': SUPABASE_SCHEMA,
      },
      body: '{}',
    })
    if (!response.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[republic] next_applicant_number RPC failed: ${response.status}`)
      }
      return null
    }
    // The function returns a bare scalar (bigint), not a row object — the
    // response body is just the JSON-encoded number itself.
    const raw: unknown = await response.json()
    const parsed = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null
    return parsed
  } catch {
    // Best-effort only — same as every other network call in this file, a
    // failure here must never break the funnel; the caller keeps the
    // placeholder instead of inventing a number.
    return null
  }
}

// Same-tab in-flight dedup for the very first allocation: React StrictMode
// (dev only) mounts effects twice — mount → cleanup → mount — synchronously
// before either call's first `await` resolves, so without this, two
// near-simultaneous calls to getApplicantNumber() would both see no cached
// value yet and each fire their own fetchNextApplicantNumber(), burning two
// sequence values for one visitor instead of one. This module-level promise
// is set synchronously (before the first `await` inside getApplicantNumber)
// so a second call arriving before the first resolves reuses the same
// in-flight request instead of starting a new one; it's cleared once that
// request settles (success or `null`) so a genuinely later call can retry.
// This is purely a same-tab/same-module safeguard — it does nothing across
// tabs/windows, which is what the localStorage cache (below) is for.
let inFlightApplicantNumberRequest: Promise<number | null> | null = null

/**
 * Resolves this browser/device's applicant number: the cached value if one
 * was already assigned, otherwise a fresh call to the global sequence RPC
 * (cached immediately on success, deduped in-flight — see
 * `inFlightApplicantNumberRequest` above). Returns `null` — never a
 * fabricated number — if no cached value exists and the RPC call fails;
 * callers should keep showing their placeholder in that case (see
 * app/page.tsx).
 */
export async function getApplicantNumber(): Promise<number | null> {
  const cached = readLocal<number | null>(LS_KEYS.applicantNumber, null)
  if (cached !== null && Number.isInteger(cached) && cached > 0) {
    return cached
  }
  if (!inFlightApplicantNumberRequest) {
    inFlightApplicantNumberRequest = fetchNextApplicantNumber().finally(() => {
      inFlightApplicantNumberRequest = null
    })
  }
  const assigned = await inFlightApplicantNumberRequest
  if (assigned === null) return null
  writeLocal(LS_KEYS.applicantNumber, assigned)
  return assigned
}

// Appointment slots — SUPERSEDED for the live appointment flow by
// getAvailableDates below (a real Google Calendar-backed source), but kept
// as-is (not deleted) as a fallback/demo-mode reference — see the matching
// comment in lib/content.ts above BASE_SLOT_LABELS. Nothing currently calls
// this.
export async function getAvailableSlots(visaType: ApplicationState['visaType']): Promise<Slot[]> {
  return computeSlots(visaType)
}

/**
 * Free calendar dates for the appointment day-picker
 * (app/appointment/page.tsx) — calls the server-only
 * app/api/available-dates route (Google Calendar freeBusy under the hood,
 * see lib/googleCalendar.ts; never called directly from the client, and no
 * credentials ever reach the browser). Defensively validates the response
 * shape before trusting it: a malformed body, a non-2xx response, or a
 * network failure all resolve an empty array, exactly like a
 * genuinely-fully-booked calendar — the appointment page can't tell the
 * difference and shouldn't try to; it just shows "no appointments
 * available" either way rather than ever inventing a bookable date.
 */
export async function getAvailableDates(): Promise<string[]> {
  try {
    const response = await fetch('/api/available-dates', { cache: 'no-store' })
    if (!response.ok) return []
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return []
    const rawDates = (body as Record<string, unknown>).dates
    if (!Array.isArray(rawDates)) return []
    return rawDates.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
  } catch {
    return []
  }
}

// No Supabase Storage bucket exists yet — this always resolves to the local
// data URL used for the canvas composite. Kept async + typed so a real
// private-bucket upload can replace the body later without touching call sites.
export async function uploadPhoto(dataUrl: string): Promise<string | null> {
  return dataUrl
}
