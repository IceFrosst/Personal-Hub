import type { IngestRow } from './devpost'

// Why this exists
// ───────────────
// The pre-insert dedupe in `run.ts` matches existing rows by URL alone, so the
// FIRST source to claim a URL owns that row forever. Aggregators (MLH, Devpost)
// usually get there first and often carry NO registration deadline — and the
// feed's eligibility rule is fail-closed, so a deadline-less row is invisible.
//
// `known` / `watch` seeds exist precisely to supply hand-verified dates for the
// events we care most about (Tier A travel circuits). Dropping them as
// "duplicates" therefore silently defeats their whole purpose: Hack the North,
// HackRice and BigRed//Hacks were all in the catalog via MLH with a null or
// long-past deadline, and none of them could ever appear in the feed.
//
// So instead of discarding a colliding seed, we let it UPGRADE the existing row:
// fill the fields the aggregator left blank (or left stale) without touching any
// value the real source actually provided.

export type ExistingRow = {
  id: string
  url: string
  registration_deadline: string | null
  format: string | null
  location_raw: string | null
}

const SEED_SOURCES = new Set(['known', 'watch'])

function futureTimestamp(value: string | null | undefined, now: Date): number | null {
  if (!value) return null
  const t = Date.parse(value)
  if (!Number.isFinite(t)) return null
  return t > now.getTime() ? t : null
}

/**
 * Build the patch a colliding seed should apply to the row that already owns its
 * URL, or null when there is nothing worth changing.
 *
 * Deliberately conservative:
 * - only `known` / `watch` rows may upgrade anything;
 * - the deadline is replaced ONLY when the existing one is missing, unparseable
 *   or already past — a valid future deadline from the real source always wins;
 * - `format` / `location_raw` are only ever filled in when null, never overwritten.
 */
export function buildSeedPatch(
  existing: ExistingRow,
  seed: IngestRow,
  now: Date = new Date()
): Record<string, unknown> | null {
  if (!SEED_SOURCES.has(seed.source)) return null

  const patch: Record<string, unknown> = {}

  const seedDeadline = futureTimestamp(seed.registration_deadline, now)
  if (seedDeadline !== null && futureTimestamp(existing.registration_deadline, now) === null) {
    patch.registration_deadline = seed.registration_deadline
  }

  if (existing.format === null && seed.format) patch.format = seed.format
  if (existing.location_raw === null && seed.location_raw) patch.location_raw = seed.location_raw

  return Object.keys(patch).length > 0 ? patch : null
}
