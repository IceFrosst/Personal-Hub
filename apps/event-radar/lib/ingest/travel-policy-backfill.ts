import { decodeTravelPolicyFromThemes, encodeTravelPolicyThemes } from '@/lib/travel-policy-store'
import type { CircuitTravelPolicy } from '@/lib/travel-priority'

/**
 * Applying a newly verified circuit policy to rows that are ALREADY enriched.
 *
 * Enrichment only revisits rows where `enriched_at is null` or both
 * `travel_covered` and `format` are null. A Tier A row has travel_covered =
 * true, so it is never re-enriched — meaning a policy added to the registry
 * today would never reach the events already sitting in the catalog, and the
 * Travel filter would stay empty until each event's next edition was inserted
 * fresh. This pass closes that gap with no LLM call and no page fetch: it is
 * pure data movement from the registry onto the row.
 *
 * Deliberately conservative — it only ever FILLS a gap:
 *   • a scope already on the row (from a real page extraction) always wins;
 *   • travel_covered is only touched when the registry says 'none', because
 *     "we cannot provide travel reimbursements" is evidence that outranks the
 *     tier prior that set it true in the first place.
 */
export type BackfillRow = {
  id: string
  themes: string[]
  travel_covered: boolean | null
}

export type BackfillPatch = {
  themes: string[]
  travel_covered?: boolean
}

export function buildTravelPolicyPatch(
  row: BackfillRow,
  policy: CircuitTravelPolicy
): BackfillPatch | null {
  const existing = decodeTravelPolicyFromThemes(row.themes)

  // A scope extracted from the event's own page is per-edition truth; the
  // registry is a standing generalisation. Never overwrite the former.
  if (existing.travel_scope !== null) return null

  const themes = encodeTravelPolicyThemes(row.themes, {
    travel_scope: policy.scope,
    travel_regions: policy.regions ?? [],
    travel_cap: policy.cap ?? existing.travel_cap,
    travel_notes: policy.quote.slice(0, 160),
  })

  const patch: BackfillPatch = { themes }

  if (policy.scope === 'none' && row.travel_covered !== false) {
    patch.travel_covered = false
  } else if (policy.scope !== 'none' && row.travel_covered === null) {
    patch.travel_covered = true
  }

  return patch
}
