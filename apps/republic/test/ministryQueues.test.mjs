import assert from 'node:assert/strict'
import test from 'node:test'

const {
  DRAFT_ABANDONED_THRESHOLD_MS,
  buildQueueTabs,
  classifyDraft,
  computeQueueCounts,
  isPendingApplicationStatus,
  partitionDraftGroups,
} = await import('../lib/ministryDrafts.ts')

const NOW = Date.parse('2026-09-05T12:00:00Z')

test('classifyDraft reads exactly at the 30-minute idle boundary as in progress, past it as abandoned', () => {
  const justUnderThreshold = new Date(NOW - (DRAFT_ABANDONED_THRESHOLD_MS - 1)).toISOString()
  const exactlyAtThreshold = new Date(NOW - DRAFT_ABANDONED_THRESHOLD_MS).toISOString()
  const pastThreshold = new Date(NOW - (DRAFT_ABANDONED_THRESHOLD_MS + 1)).toISOString()
  assert.equal(classifyDraft(justUnderThreshold, NOW), 'inProgress')
  assert.equal(classifyDraft(exactlyAtThreshold, NOW), 'inProgress')
  assert.equal(classifyDraft(pastThreshold, NOW), 'abandoned')
})

test('partitionDraftGroups splits already-submitted-filtered drafts by last-event recency, no duplicates', () => {
  const groups = [
    { id: 'fresh', events: [{ created_at: new Date(NOW - 60_000).toISOString() }] },
    { id: 'stale', events: [{ created_at: new Date(NOW - DRAFT_ABANDONED_THRESHOLD_MS - 60_000).toISOString() }] },
    {
      id: 'multi-event-fresh',
      events: [
        { created_at: new Date(NOW - DRAFT_ABANDONED_THRESHOLD_MS - 60_000).toISOString() },
        { created_at: new Date(NOW - 1_000).toISOString() },
      ],
    },
  ]
  const { abandoned, inProgress } = partitionDraftGroups(groups, NOW)
  assert.deepEqual(abandoned.map((g) => g.id), ['stale'])
  assert.deepEqual(inProgress.map((g) => g.id), ['fresh', 'multi-event-fresh'])
  // Every input group appears in exactly one queue.
  assert.equal(abandoned.length + inProgress.length, groups.length)
})

test('partitionDraftGroups treats an eventless group as in progress rather than crashing', () => {
  const { abandoned, inProgress } = partitionDraftGroups([{ id: 'empty', events: [] }], NOW)
  assert.equal(abandoned.length, 0)
  assert.equal(inProgress.length, 1)
})

test('isPendingApplicationStatus only matches the literal pending status', () => {
  assert.equal(isPendingApplicationStatus('pending'), true)
  assert.equal(isPendingApplicationStatus('approved'), false)
  assert.equal(isPendingApplicationStatus('denied'), false)
})

test('computeQueueCounts classifies finalized applications: pending -> PENDING, approved/denied -> DECIDED', () => {
  const counts = computeQueueCounts(2, 3, ['pending', 'pending', 'approved', 'denied', 'approved'])
  assert.deepEqual(counts, { abandoned: 2, inProgress: 3, pending: 2, decided: 3 })
})

test('computeQueueCounts with no applications reports zero pending/decided, preserving draft counts', () => {
  assert.deepEqual(computeQueueCounts(1, 0, []), { abandoned: 1, inProgress: 0, pending: 0, decided: 0 })
})

// Regression: /ministry must always render all four queue controls, including
// with zero counts across the board (empty applications + no drafts at all) —
// there must be no code path that special-cases an all-empty desk out of the
// tab controls themselves.
test('buildQueueTabs always returns all four queue tabs, with all-zero counts when the desk is entirely empty', () => {
  const counts = computeQueueCounts(0, 0, [])
  assert.deepEqual(counts, { abandoned: 0, inProgress: 0, pending: 0, decided: 0 })
  const tabs = buildQueueTabs(counts)
  assert.deepEqual(tabs, [
    { key: 'abandoned', count: 0 },
    { key: 'inProgress', count: 0 },
    { key: 'pending', count: 0 },
    { key: 'decided', count: 0 },
  ])
})

// Regression: the same underlying draft group must move from IN PROGRESS to
// ABANDONED purely because `now` (the caller-supplied clock, not an internal
// `Date.now()` read frozen at some earlier render) has crossed the 30-minute
// idle threshold — the classification is not stuck at whatever it was when
// the draft group was first computed.
test('partitionDraftGroups reclassifies the same draft from in progress to abandoned as `now` crosses the threshold', () => {
  const lastEventAt = new Date(NOW - 60_000).toISOString() // 1 minute old at NOW
  const groups = [{ id: 'aging-draft', events: [{ created_at: lastEventAt }] }]

  const justBeforeThreshold = NOW + (DRAFT_ABANDONED_THRESHOLD_MS - 60_000) - 1
  const before = partitionDraftGroups(groups, justBeforeThreshold)
  assert.deepEqual(before.inProgress.map((g) => g.id), ['aging-draft'])
  assert.equal(before.abandoned.length, 0)

  const justAfterThreshold = NOW + (DRAFT_ABANDONED_THRESHOLD_MS - 60_000) + 1
  const after = partitionDraftGroups(groups, justAfterThreshold)
  assert.deepEqual(after.abandoned.map((g) => g.id), ['aging-draft'])
  assert.equal(after.inProgress.length, 0)
})

test('classifyDraft and partitionDraftGroups accept a Date instance for `now`, equivalent to its epoch-ms value', () => {
  const lastEventAt = new Date(NOW - DRAFT_ABANDONED_THRESHOLD_MS - 1_000).toISOString()
  assert.equal(classifyDraft(lastEventAt, new Date(NOW)), classifyDraft(lastEventAt, NOW))
  const groups = [{ id: 'x', events: [{ created_at: lastEventAt }] }]
  assert.deepEqual(partitionDraftGroups(groups, new Date(NOW)), partitionDraftGroups(groups, NOW))
})
