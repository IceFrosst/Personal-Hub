/**
 * Paging for the feed's catalog read.
 *
 * PostgREST caps any single response at 1000 rows (Supabase's `db-max-rows`
 * default), and the feed used to ask for exactly that many — the newest 1000
 * by `created_at`. Measured 2026-09-16: the catalog held 1927 rows and **182
 * upcoming, feed-eligible events sat in the older half**, invisible for no
 * reason but their age in the database. The catalog only grows (past rows
 * are never deleted), so that number was going to grow with it.
 *
 * `fetchAllPages` walks `[from, to]` windows of `PAGE_SIZE` until a short
 * page comes back. Callers pass the query as a function so this stays free of
 * Supabase types and testable with a fake. `MAX_PAGES` is a runaway guard,
 * not a coverage decision — if it ever binds, the catalog has 20k+ upcoming
 * rows and the feed needs a server-side design, not a bigger number.
 */
export const PAGE_SIZE = 1000
export const MAX_PAGES = 20

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = PAGE_SIZE,
  maxPages: number = MAX_PAGES
): Promise<T[]> {
  const out: T[] = []
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize
    const rows = await fetchPage(from, from + pageSize - 1)
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

/**
 * The feed reads rows that can still matter: anything that has not started.
 * Past editions stay in the database for dedupe and history but nothing in
 * the UI lists them — except rows the user has a status on (Applied tab),
 * which the feed fetches separately by id. Rounded down to the hour so the
 * PostgREST query string is cache-friendly across a session.
 */
export function feedStartCutoff(now: Date = new Date()): string {
  const d = new Date(now.getTime())
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}
