import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.window = {
  crypto: { randomUUID: () => `event-${Math.random()}` },
  addEventListener() {},
}
globalThis.document = {
  visibilityState: 'visible',
  addEventListener() {},
}

const audit = await import('../lib/draftAudit.ts')

test('draft audit keeps each text revision, including deletion', () => {
  audit.stopDraftAuditForTests()
  audit.recordDraftFieldChange('draft-1', 'businessPitch', '', 'A')
  audit.recordDraftFieldChange('draft-1', 'businessPitch', 'A', 'AB')
  audit.recordDraftFieldChange('draft-1', 'businessPitch', 'AB', '')
  assert.equal(audit.pendingDraftEventCount(), 3)
  audit.recordDraftFieldChange('draft-1', 'serial', null, 'internal')
  assert.equal(audit.pendingDraftEventCount(), 3)
  audit.stopDraftAuditForTests()
})

test('image and blob-like fields/values never enter the queue', () => {
  audit.stopDraftAuditForTests()
  audit.recordDraftFieldChange('draft-image', 'selfieDataUrl', null, 'data:image/jpeg;base64,abc')
  audit.recordDraftFieldChange('draft-image', 'photoInput', null, 'data:video/mp4;base64,abc')
  audit.recordDraftFieldChange('draft-image', 'businessPitch', null, 'data:application/octet-stream;base64,abc')
  audit.recordDraftFieldChange('draft-image', 'businessPitch', null, 'raw bytes ;base64,abc')
  audit.recordDraftFieldChange('draft-image', 'businessPitch', null, { selfieThumbnailUrl: 'data:image/jpeg;base64,abc' })
  audit.recordDraftFieldChange('draft-image', 'businessPitch', null, { blobPayload: 'raw bytes' })
  assert.equal(audit.pendingDraftEventCount(), 0)
  audit.stopDraftAuditForTests()
})

test('draft lifecycle events use the same draft queue', () => {
  audit.stopDraftAuditForTests()
  audit.recordDraftStarted('draft-2')
  audit.recordDraftIntel('draft-2', { connection: 'wifi 4g' })
  audit.recordDraftSubmitted('draft-2', 'RIG-ABCD')
  assert.equal(audit.pendingDraftEventCount(), 3)
  audit.stopDraftAuditForTests()
})

test('classification honors submitted events and server-time ordering', async () => {
  const ministry = await import('../lib/ministryDrafts.ts')
  const events = [
    { id: 2, event_id: 'b', draft_id: 'd', created_at: '2025-01-01T00:00:02Z', event_type: 'field_changed', sequence: 1 },
    { id: 1, event_id: 'a', draft_id: 'd', created_at: '2025-01-01T00:00:01Z', event_type: 'field_changed', sequence: 99 },
  ]
  assert.deepEqual(ministry.sortDraftEvents(events).map((event) => event.event_id), ['a', 'b'])
  assert.equal(ministry.submittedDraftIds([{ draft_id: 'd', event_type: 'submitted' }], []).has('d'), true)
  assert.equal(audit.isCurrentDraft('new', 'old'), false)
  assert.equal(audit.isCurrentDraft('new', 'new'), true)
})

test('submittedDraftIds also derives from application rows, not just submitted events', async () => {
  const ministry = await import('../lib/ministryDrafts.ts')
  // A completed application whose row already carries draft_id is
  // authoritative even if its `submitted` outbox event never arrived (or
  // arrived on a since-truncated page) — the row itself must still count.
  const ids = ministry.submittedDraftIds([], ['app-draft-1', null, undefined, 'app-draft-2'])
  assert.equal(ids.has('app-draft-1'), true)
  assert.equal(ids.has('app-draft-2'), true)
  assert.equal(ids.size, 2)
})

test('recordDraftIntel accepts exactly the runtime INTEL_FIELDS whitelist and rejects any extra key', () => {
  audit.stopDraftAuditForTests()
  // Kept in sync with lib/draftAudit.ts's INTEL_FIELDS (which must in turn
  // match apps/republic/supabase/migrations/0007_draft_audit.sql's
  // draft_events_intel_keys_check) — if the runtime whitelist ever drifts
  // from either, this test starts failing rather than silently going stale.
  const validIntel = {
    ip: '1.2.3.4',
    country: 'LT',
    region: 'Vilnius County',
    city: 'Vilnius',
    ipTimezone: 'Europe/Vilnius',
    deviceTimezone: 'Europe/Vilnius',
    referrer: 'https://instagram.com',
    fromInstagram: 'yes (referrer)',
    battery: '80% (charging)',
    connection: 'wifi 4g ~12Mbps',
  }
  audit.recordDraftIntel('draft-intel', validIntel)
  assert.equal(audit.pendingDraftEventCount(), 1)
  // A single unknown key rejects the WHOLE event, not just that key.
  audit.recordDraftIntel('draft-intel', { ...validIntel, evil: 'x' })
  assert.equal(audit.pendingDraftEventCount(), 1)
  audit.recordDraftIntel('draft-intel', { ssid: 'HomeWifi' })
  assert.equal(audit.pendingDraftEventCount(), 1)
  audit.stopDraftAuditForTests()
})

test('oversized field values are rejected before entering the queue (validPayload size guard)', () => {
  audit.stopDraftAuditForTests()
  audit.recordDraftFieldChange('draft-huge', 'businessPitch', '', 'x'.repeat(audit.MAX_VALUE_BYTES + 1))
  assert.equal(audit.pendingDraftEventCount(), 0)
  // A value right at the boundary is accepted.
  audit.recordDraftFieldChange('draft-huge', 'businessPitch', '', 'x'.repeat(audit.MAX_VALUE_BYTES - 100))
  assert.equal(audit.pendingDraftEventCount(), 1)
  audit.stopDraftAuditForTests()
})

test('the outbox caps at MAX_OUTBOX_EVENTS and rejects further events past it', () => {
  audit.stopDraftAuditForTests()
  for (let i = 0; i < audit.MAX_OUTBOX_EVENTS + 20; i += 1) {
    audit.recordDraftFieldChange('draft-cap', 'businessPitch', String(i), String(i + 1))
  }
  assert.equal(audit.pendingDraftEventCount(), audit.MAX_OUTBOX_EVENTS)
  audit.stopDraftAuditForTests()
})

test('requestBatch keeps a keepalive batch under the request byte budget and leaves the rest queued', () => {
  audit.stopDraftAuditForTests()
  for (let i = 0; i < 50; i += 1) {
    audit.recordDraftFieldChange('draft-batch', 'businessPitch', String(i), 'x'.repeat(2000))
  }
  const totalQueued = audit.pendingDraftEventCount()
  const batch = audit.requestBatch(true)
  // Mirrors lib/draftAudit.ts's internal wire-format mapping (snake_case
  // keys) so the byte check reflects what actually goes over the wire.
  const wire = batch.map((event) => ({
    event_id: event.eventId,
    draft_id: event.draftId,
    client_at: event.clientAt,
    event_type: event.eventType,
    field: event.field,
    previous_value: event.previousValue,
    value: event.value,
    sequence: event.sequence,
  }))
  const bytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength
  assert.ok(bytes <= audit.MAX_REQUEST_BYTES, `batch bytes ${bytes} exceeded the ${audit.MAX_REQUEST_BYTES} budget`)
  assert.ok(batch.length > 0, 'batch should not be empty')
  assert.ok(batch.length < totalQueued, 'batch should stop short of the full queue once the byte budget is hit')
  // Non-keepalive batches use the plain debounced BATCH_SIZE cap instead.
  const normalBatch = audit.requestBatch(false)
  assert.equal(normalBatch.length, 10)
  audit.stopDraftAuditForTests()
})
