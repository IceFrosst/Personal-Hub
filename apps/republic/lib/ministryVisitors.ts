// Officer-only unique-visitor counter (/ministry).
//
// The count itself is computed entirely inside a narrow SECURITY DEFINER
// Postgres RPC (republic.count_unique_visitor_ips, migration
// 0009_ministry_unique_visitors.sql) — it checks republic.is_ministry()
// itself, so this file never sees a raw IP, never SELECTs application/draft
// rows for this purpose, and fails closed to `null` (rendered as an
// "unavailable" dash by the desk) rather than denying the whole desk.

export interface MinistrySupabaseLike {
  // supabase-js's real `.rpc(...)` return type is a thenable query builder,
  // not a plain Promise — PromiseLike is the narrowest shape both it and a
  // plain test double satisfy.
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

/** Matches a numeric string with no leading/trailing whitespace, no decimal/exponent
 * notation, and no thousands separators — rejects `''`/`'  '` (which `Number('')` would
 * otherwise silently coerce to `0`) as well as `'1.5'`/`'1e3'`/`'1,000'`. */
const STRICT_INTEGER_STRING = /^-?\d+$/

/**
 * Parses the RPC's bigint return value into a safe non-negative count.
 *
 * PostgREST/postgrest-js may deliver a `bigint` as a JSON number, a numeric
 * string (its usual bigint-precision-safe encoding), or — for a defensive
 * caller passing a real JS `bigint` through a non-JSON path — a native
 * `bigint`. A single-row RPC response may also arrive wrapped in an array;
 * exactly one element is accepted, never zero or more than one. Anything
 * blank, negative, non-integer, or outside `Number.MAX_SAFE_INTEGER` fails
 * closed to `null` rather than surfacing a misleading number.
 */
export function parseUniqueVisitorCount(value: unknown): number | null {
  let raw: unknown = value
  if (Array.isArray(raw)) {
    if (raw.length !== 1) return null
    raw = raw[0]
  }
  if (typeof raw === 'bigint') {
    // BigInt literals (`0n`) require ES2020+; this app targets ES2017, so use
    // the `BigInt(...)` call form instead.
    if (raw < BigInt(0) || raw > BigInt(Number.MAX_SAFE_INTEGER)) return null
    return Number(raw)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed === '' || !STRICT_INTEGER_STRING.test(trimmed)) return null
    raw = Number(trimmed)
  }
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) return null
  return raw
}

/** Fail-closed: any RPC error, missing client, or malformed payload resolves null, never throws. */
export async function fetchUniqueVisitorCount(supabase: MinistrySupabaseLike | null): Promise<number | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.rpc('count_unique_visitor_ips')
    if (error) return null
    return parseUniqueVisitorCount(data)
  } catch {
    return null
  }
}
