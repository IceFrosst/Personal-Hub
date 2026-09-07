'use client'

/**
 * Anonymous, append-only draft audit outbox. Every accepted field transition
 * is retained (including deletions) up to MAX_OUTBOX_EVENTS. Values are
 * whitelist- and payload-bounded; image/blob/data-URL values are rejected.
 * Normal writes are debounced in batches of 10. Lifecycle flushes send as many
 * queued rows as fit below MAX_REQUEST_BYTES in one keepalive request.
 */

export const AUDITABLE_FIELDS = new Set([
  'applicantName',
  'instagramHandle',
  'gender',
  'visaType',
  'sidequestIdea',
  'sidequestSupplies',
  'specialOtherness',
  'specialStatement',
  'businessPitch',
  'fianceAnswers',
  'slot',
  'declaredIq',
  'declaredConfidence',
  'screeningQuestion',
  'screeningAnswer',
  'dutyFreeItems',
  'selfieRetakes',
])

const INTEL_FIELDS = new Set([
  'ip',
  'country',
  'region',
  'city',
  'ipTimezone',
  'deviceTimezone',
  'referrer',
  'fromInstagram',
  'battery',
  'connection',
])
const EVENT_TYPES = new Set(['draft_started', 'field_changed', 'intel_collected', 'submitted'])
const BATCH_SIZE = 10
const FLUSH_DELAY_MS = 450
/** Hard client-side cap: preserves 4096 revisions, then rejects new events.
 *  Exported read-only for tests (test/draftAudit.test.mjs) — no enqueue
 *  surface is widened by exposing the constant itself. */
export const MAX_OUTBOX_EVENTS = 4096
/** Keepalive requests stay comfortably below browser/proxy ~64KB limits.
 *  Exported read-only for tests, same rationale as MAX_OUTBOX_EVENTS above. */
export const MAX_REQUEST_BYTES = 56 * 1024
/** No individual JSON value can consume the whole keepalive budget.
 *  Exported read-only for tests, same rationale as MAX_OUTBOX_EVENTS above. */
export const MAX_VALUE_BYTES = 12 * 1024

export interface DraftAuditEvent {
  eventId: string
  draftId: string
  clientAt: string
  eventType: string
  field: string | null
  previousValue: unknown
  value: unknown
  sequence: number
}

// Named SUPABASE_URL (not the shorter `URL`) so it never shadows the global
// `URL` constructor — nothing here currently constructs a `new URL(...)`,
// but the shadow was a latent footgun for any future edit in this file.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
let queue: DraftAuditEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let interval: ReturnType<typeof setInterval> | null = null
let listenersBound = false
let flushing = false
let keepalivePending = false
const sequences = new Map<string, number>()

function browser(): boolean {
  return typeof window !== 'undefined'
}

function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function id(): string {
  if (browser() && typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID()
  return fallbackUuid()
}

export function isCurrentDraft(currentDraftId: string | null, expectedDraftId: string): boolean {
  return Boolean(expectedDraftId) && currentDraftId === expectedDraftId
}

export function newDraftId(): string | null {
  if (!browser()) return null
  if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID()
  return fallbackUuid()
}

function nextSequence(draftId: string): number {
  const next = (sequences.get(draftId) ?? 0) + 1
  sequences.set(draftId, next)
  return next
}

function bindLifecycle(): void {
  if (!browser() || listenersBound) return
  listenersBound = true
  const flushKeepalive = () => void flush(true)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushKeepalive()
  })
  window.addEventListener('pagehide', flushKeepalive)
  interval = setInterval(() => void flush(false), 2000)
}

function schedule(): void {
  bindLifecycle()
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void flush(false)
  }, FLUSH_DELAY_MS)
}

function forbiddenKey(key: string): boolean {
  return key !== 'selfieRetakes' && /(?:selfie|photo|blob|thumbnail|dataurl)/i.test(key)
}

function safeValue(value: unknown, key?: string, seen = new WeakSet<object>(), depth = 0): unknown | undefined {
  if (key && forbiddenKey(key)) return undefined
  if (depth > 8) return undefined
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return typeof value === 'number' && !Number.isFinite(value) ? undefined : value
  }
  if (typeof value === 'string') return /(?:data:|;base64,|^blob:)/i.test(value) ? undefined : value
  if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined
  if (typeof value === 'object') {
    if (seen.has(value)) return undefined
    seen.add(value)
    try {
      if (Array.isArray(value)) {
        const result: unknown[] = []
        for (const item of value) {
          const safe = safeValue(item, undefined, seen, depth + 1)
          if (safe === undefined && item !== undefined) return undefined
          result.push(safe ?? null)
        }
        return result
      }
      const result: Record<string, unknown> = {}
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        const safe = safeValue(childValue, childKey, seen, depth + 1)
        if (safe === undefined && childValue !== undefined) return undefined
        if (safe !== undefined) result[childKey] = safe
      }
      return result
    } finally {
      seen.delete(value)
    }
  }
  return undefined
}

function validPayload(value: unknown): unknown | undefined {
  const safe = safeValue(value)
  if (safe === undefined && value !== undefined) return undefined
  try {
    if (new TextEncoder().encode(JSON.stringify(safe ?? null)).byteLength > MAX_VALUE_BYTES) return undefined
  } catch {
    return undefined
  }
  return safe ?? null
}

function enqueue(input: {
  draftId: string
  eventType: string
  field?: string | null
  previousValue?: unknown
  value?: unknown
}): void {
  if (!input.draftId || !EVENT_TYPES.has(input.eventType)) return
  if (input.eventType === 'field_changed' && (!input.field || !AUDITABLE_FIELDS.has(input.field))) return
  if (input.eventType !== 'field_changed' && input.field != null) return
  const previousValue = validPayload(input.previousValue)
  const value = validPayload(input.value)
  if (previousValue === undefined || value === undefined || queue.length >= MAX_OUTBOX_EVENTS) return
  bindLifecycle()
  queue.push({
    eventId: id(),
    draftId: input.draftId,
    clientAt: new Date().toISOString(),
    eventType: input.eventType,
    field: input.field ?? null,
    previousValue,
    value,
    sequence: nextSequence(input.draftId),
  })
  schedule()
}

export function recordDraftStarted(draftId: string): void {
  enqueue({ draftId, eventType: 'draft_started' })
}

export function recordDraftIntel(draftId: string, intel: unknown): void {
  if (!intel || typeof intel !== 'object' || Array.isArray(intel)) return
  const input = intel as Record<string, unknown>
  if (Object.keys(input).some((key) => !INTEL_FIELDS.has(key))) return
  enqueue({ draftId, eventType: 'intel_collected', value: input })
}

export function recordDraftSubmitted(draftId: string, referenceCode: string): void {
  enqueue({ draftId, eventType: 'submitted', value: referenceCode })
}

export function recordDraftFieldChange(draftId: string, field: string, previousValue: unknown, value: unknown): void {
  if (!AUDITABLE_FIELDS.has(field) || Object.is(previousValue, value)) return
  if (previousValue && value && typeof previousValue === 'object' && typeof value === 'object') {
    try {
      if (JSON.stringify(previousValue) === JSON.stringify(value)) return
    } catch {
      return
    }
  }
  enqueue({ draftId, eventType: 'field_changed', field, previousValue, value })
}

function wireEvent(event: DraftAuditEvent): Record<string, unknown> {
  return {
    event_id: event.eventId,
    draft_id: event.draftId,
    client_at: event.clientAt,
    event_type: event.eventType,
    field: event.field,
    previous_value: event.previousValue,
    value: event.value,
    sequence: event.sequence,
  }
}

type SendResult = 'ok' | 'duplicate' | 'retry'

/**
 * A plain INSERT has no upsert's duplicate tolerance because upsert would
 * require anonymous SELECT. Only the event_id unique violation is safe to
 * consume: another 409 (or another 23505) must remain retryable.
 */
async function isEventIdDuplicate(response: Response): Promise<boolean> {
  if (response.status !== 409) return false
  try {
    const body = (await response.json()) as unknown
    if (!body || typeof body !== 'object' || (body as { code?: unknown }).code !== '23505') return false
    const details = body as { constraint?: unknown; details?: unknown; message?: unknown }
    const text = [details.constraint, details.details, details.message]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
    return /draft_events_event_id_key|key\s*\(\s*event_id\s*\)\s*=/i.test(text)
  } catch {
    return false
  }
}

async function send(batch: DraftAuditEvent[], keepalive: boolean): Promise<SendResult> {
  if (!SUPABASE_URL || !ANON_KEY || !batch.length) return 'ok'
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/draft_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        // This is intentionally a plain INSERT. `resolution=ignore-duplicates`
        // turns the request into an upsert, which makes PostgREST require
        // SELECT on the table; anonymous applicants are deliberately INSERT-only.
        Prefer: 'return=minimal',
        'Content-Profile': 'republic',
      },
      body: JSON.stringify(batch.map(wireEvent)),
      ...(keepalive ? { keepalive: true } : {}),
    })
    if (response.ok) return 'ok'
    return (await isEventIdDuplicate(response)) ? 'duplicate' : 'retry'
  } catch {
    return 'retry'
  }
}

/**
 * Duplicate fallback work is deliberately capped. A keepalive flush normally
 * uses one request; if that request contains a replayed event, retry at most
 * one ordinary batch's worth individually so a pagehide cannot fan out into
 * unbounded network work. Any untouched events remain queued for a later
 * foreground/interval flush.
 */
const MAX_DUPLICATE_FALLBACK_EVENTS = BATCH_SIZE

function removeCompleted(events: DraftAuditEvent[]): void {
  if (!events.length) return
  const completed = new Set(events.map((event) => event.eventId))
  queue = queue.filter((event) => !completed.has(event.eventId))
}

/** Pure query over the current outbox — exported for tests
 *  (test/draftAudit.test.mjs) since `flush()` is network-gated (a no-op
 *  without Supabase env vars) and can't otherwise be used to observe the
 *  keepalive byte-budget behavior. Read-only: it doesn't mutate `queue` or
 *  otherwise widen the enqueue surface (that's still only reachable through
 *  the whitelisted `recordDraft*` functions below). */
export function requestBatch(keepalive: boolean): DraftAuditEvent[] {
  if (!keepalive) return queue.slice(0, BATCH_SIZE)
  const batch: DraftAuditEvent[] = []
  for (const event of queue) {
    const candidate = [...batch, event]
    if (new TextEncoder().encode(JSON.stringify(candidate.map(wireEvent))).byteLength > MAX_REQUEST_BYTES) break
    batch.push(event)
  }
  return batch
}

export async function flush(keepalive = false): Promise<void> {
  if (flushing) {
    if (keepalive) keepalivePending = true
    return
  }
  if (!queue.length || !SUPABASE_URL || !ANON_KEY) return
  flushing = true
  try {
    const batch = requestBatch(keepalive)
    const result = await send(batch, keepalive)
    if (result === 'ok') {
      if (queue.slice(0, batch.length).every((event, index) => event.eventId === batch[index].eventId)) {
        queue.splice(0, batch.length)
      }
    } else if (result === 'duplicate') {
      // A mixed INSERT batch fails atomically on one duplicate. Retry a bounded
      // prefix individually so duplicates are consumed without dropping NEW
      // events; failures and any untouched suffix stay in the outbox.
      const fallback = batch.slice(0, MAX_DUPLICATE_FALLBACK_EVENTS)
      const completed: DraftAuditEvent[] = []
      for (const event of fallback) {
        const eventResult = await send([event], keepalive)
        if (eventResult === 'ok' || eventResult === 'duplicate') completed.push(event)
      }
      removeCompleted(completed)
    }
    if (queue.length) schedule()
  } finally {
    flushing = false
    if (keepalivePending) {
      keepalivePending = false
      void flush(true)
    }
  }
}

export function pendingDraftEventCount(): number {
  return queue.length
}

export function stopDraftAuditForTests(): void {
  if (timer) clearTimeout(timer)
  if (interval) clearInterval(interval)
  timer = null
  interval = null
  queue = []
  sequences.clear()
  flushing = false
  keepalivePending = false
}
