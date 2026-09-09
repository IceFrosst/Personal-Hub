import { isRegionKey, type RegionKey } from './continents'

/**
 * Per-user feed preferences, stored in `user_preferences.filters` (jsonb).
 *
 * That column has been in the schema since 0001 as "reserved" — this is its
 * first use, so no migration. It is a separate column from
 * `notification_settings` on purpose: the settings panel upserts that column
 * and the feed upserts this one, and PostgREST's upsert only writes the
 * columns present in the payload, so the two surfaces cannot clobber each
 * other's state.
 *
 * `hidden_regions` stores what is switched OFF, not on. A new continent key
 * (or a fresh user) is therefore visible by default, and an older client that
 * never heard of a key simply ignores it — the additive rule for jsonb.
 */
export type FeedPrefs = {
  hidden_regions: RegionKey[]
}

export const DEFAULT_FEED_PREFS: FeedPrefs = { hidden_regions: [] }

export function coerceFeedPrefs(raw: unknown): FeedPrefs {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >
  const hidden = Array.isArray(o.hidden_regions)
    ? o.hidden_regions.filter(isRegionKey)
    : []
  return { hidden_regions: [...new Set(hidden)] }
}

/**
 * Merge our keys into whatever else the jsonb already holds, so a future key
 * written by a newer client survives a round-trip through this one.
 */
export function mergeFeedPrefs(existing: unknown, next: FeedPrefs): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {}
  return { ...base, hidden_regions: next.hidden_regions }
}
