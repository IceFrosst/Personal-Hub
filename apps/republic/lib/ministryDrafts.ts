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
