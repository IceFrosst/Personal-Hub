export interface MinistryDraftEvent {
  id: number
  event_id: string
  draft_id: string
  created_at: string
  event_type: string
  sequence: number
}

/** Server insertion time wins across reloads; sequence and stable IDs break ties. */
export function compareDraftEvents(a: MinistryDraftEvent, b: MinistryDraftEvent): number {
  return a.created_at.localeCompare(b.created_at) || a.sequence - b.sequence || a.event_id.localeCompare(b.event_id) || a.id - b.id
}

export function sortDraftEvents<T extends MinistryDraftEvent>(events: T[]): T[] {
  return [...events].sort(compareDraftEvents)
}

/** A submitted outbox event is authoritative when the application write lagged. */
export function submittedDraftIds(
  events: Pick<MinistryDraftEvent, 'draft_id' | 'event_type'>[],
  applicationDraftIds: (string | null | undefined)[]
): Set<string> {
  return new Set([
    ...applicationDraftIds.filter((id): id is string => Boolean(id)),
    ...events.filter((event) => event.event_type === 'submitted').map((event) => event.draft_id),
  ])
}

// ---------------------------------------------------------------------------
// Ministry queue tabs — ABANDONED / IN PROGRESS / PENDING / DECIDED.
// Pure, unit-tested classification so the desk UI is a thin render layer.
// ---------------------------------------------------------------------------

/** Drafts idle past this window read as ABANDONED rather than IN PROGRESS. */
export const DRAFT_ABANDONED_THRESHOLD_MS = 30 * 60 * 1000

export type DraftQueue = 'abandoned' | 'inProgress'

/** Normalizes an explicit `now` (epoch ms or a `Date`) to epoch ms; only falls back to a live clock read when the caller omits it entirely (e.g. ad-hoc test/CLI use). Render call sites should always pass an explicit value so classification updates on the caller's own clock, not once per render. */
function resolveNow(now: number | Date | undefined): number {
  if (now === undefined) return Date.now()
  return now instanceof Date ? now.getTime() : now
}

/** Pure classification of a single draft's most recent event timestamp. */
export function classifyDraft(lastEventCreatedAt: string, now?: number | Date): DraftQueue {
  const nowMs = resolveNow(now)
  return nowMs - new Date(lastEventCreatedAt).getTime() > DRAFT_ABANDONED_THRESHOLD_MS ? 'abandoned' : 'inProgress'
}

export interface DraftGroupLike {
  events: { created_at: string }[]
}

/** Splits already-grouped, already-submitted-filtered drafts into the two draft queues. `now` is an explicit epoch-ms timestamp or `Date` supplied by the caller (e.g. a periodically-refreshed React state value) so a draft's abandoned/in-progress classification advances as real time passes, not only when `groups` itself changes. */
export function partitionDraftGroups<G extends DraftGroupLike>(
  groups: G[],
  now?: number | Date
): { abandoned: G[]; inProgress: G[] } {
  const nowMs = resolveNow(now)
  const abandoned: G[] = []
  const inProgress: G[] = []
  for (const group of groups) {
    const last = group.events[group.events.length - 1]
    if (!last || classifyDraft(last.created_at, nowMs) === 'inProgress') inProgress.push(group)
    else abandoned.push(group)
  }
  return { abandoned, inProgress }
}

export type MinistryQueue = 'abandoned' | 'inProgress' | 'pending' | 'decided'

export interface MinistryQueueCounts {
  abandoned: number
  inProgress: number
  pending: number
  decided: number
}

/** Finalized applications: status 'pending' -> PENDING queue; anything else (approved/denied) -> DECIDED. */
export function isPendingApplicationStatus(status: string): boolean {
  return status === 'pending'
}

/** Pure count rollup for the four queue tab labels. */
export function computeQueueCounts(
  abandonedCount: number,
  inProgressCount: number,
  applicationStatuses: string[]
): MinistryQueueCounts {
  let pending = 0
  let decided = 0
  for (const status of applicationStatuses) {
    if (isPendingApplicationStatus(status)) pending += 1
    else decided += 1
  }
  return { abandoned: abandonedCount, inProgress: inProgressCount, pending, decided }
}

export interface MinistryQueueTab {
  key: MinistryQueue
  count: number
}

/**
 * Pure, render-agnostic tab ordering (ABANDONED / IN PROGRESS / PENDING / DECIDED)
 * over already-computed counts. Labels are copy-bank content (`lib/content.ts`),
 * intentionally not this module's concern — the page maps `key` to a label.
 * Always returns all four tabs, including when every count is zero, so the
 * queue-controls UI never has a reason to special-case an all-empty desk.
 */
export function buildQueueTabs(counts: MinistryQueueCounts): MinistryQueueTab[] {
  return [
    { key: 'abandoned', count: counts.abandoned },
    { key: 'inProgress', count: counts.inProgress },
    { key: 'pending', count: counts.pending },
    { key: 'decided', count: counts.decided },
  ]
}
