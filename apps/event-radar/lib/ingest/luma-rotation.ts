/**
 * Rotating query window for the Luma discovery sweep.
 *
 * The region packs grew to 108 unique queries, which at up to 2 pages each is
 * ~216 back-to-back requests per sweep. Luma rate-limits long before that: an
 * open-egress probe on 2026-07-26 got clean results for ~40 requests and then
 * HTTP 403 for every single one after, and `fetchLumaQuery` treats a non-OK
 * response as "no more pages" and moves on silently. So the later packs never
 * actually ran.
 *
 * The live catalog agrees. Luma rows are dominated by the early generic queries
 * (California 28, UK 15, India 13, Germany 11) while the region countries that
 * sit late in the list are almost absent — Sweden 2, Denmark 2, Norway 1,
 * Austria 1, and nothing at all from France, Spain, Portugal, the Netherlands,
 * Belgium, Poland, Lithuania, Czechia, Hungary or Italy. Coverage was nominal,
 * not real.
 *
 * Fix: run a bounded window per sweep and rotate it, so every query gets its
 * turn across the day instead of the tail being permanently starved. Ingest
 * runs ~5×/day (Vercel cron + GitHub Actions), so a window of 35 cycles the
 * whole list roughly twice a day.
 *
 * Adding a query is therefore cheap now — it joins the rotation rather than
 * pushing another one past the rate limit.
 */

/** Queries per sweep, on top of the always-run primary. */
export const LUMA_WINDOW = 35

/** How often the window advances. Ingest runs more often than this is coarse. */
const ROTATION_SLOT_MS = 3 * 60 * 60 * 1000

export function rotationSlot(now: Date = new Date()): number {
  return Math.floor(now.getTime() / ROTATION_SLOT_MS)
}

/**
 * A window of `size` queries starting at an offset derived from the clock, so
 * consecutive runs pick up where the previous one left off. Wraps around the
 * end of the list. Deterministic — same slot in, same window out.
 */
export function selectQueryWindow<T>(
  queries: readonly T[],
  size: number = LUMA_WINDOW,
  slot: number = rotationSlot()
): T[] {
  if (queries.length === 0) return []
  if (queries.length <= size) return [...queries]

  // Step a whole window per slot, not one query — otherwise consecutive runs
  // overlap by size-1 and the list takes ~as many runs as it has entries to
  // cycle, which is the starvation this exists to fix.
  const raw = slot * size
  const start = ((raw % queries.length) + queries.length) % queries.length
  const out: T[] = []
  for (let i = 0; i < size; i++) {
    out.push(queries[(start + i) % queries.length])
  }
  return out
}
