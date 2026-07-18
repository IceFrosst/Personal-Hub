import type { IngestRow } from './devpost'

// Devfolio — one of the largest hackathon platforms (global, very heavy in
// India/APAC). Public JSON API used by their own listing page:
//   https://api.devfolio.co/api/hackathons?filter=application_open&page=N
// Response is a flat `result[]` array; each event's public site is
// https://<slug>.devfolio.co/. We deliberately do NOT make the per-event
// /prizes call the reference scrapers do — that's one HTTP request per row and
// enrichment fills prize/format from the event page anyway. `filter=
// application_open` already scopes to events taking registrations, but the
// shared fail-closed eligibility rule still re-checks the dates at read time.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://api.devfolio.co/api/hackathons'
const MAX_PAGES = 3

type JsonObject = Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function asObject(v: unknown): JsonObject {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {}
}

export function parseDevfolio(result: unknown[]): IngestRow[] {
  const rows: IngestRow[] = []
  for (const raw of result) {
    const item = asObject(raw)
    const title = str(item.name)
    const slug = str(item.slug)
    if (!title || !slug) continue

    rows.push({
      source: 'devfolio',
      source_id: slug,
      title,
      url: `https://${slug}.devfolio.co/`,
      starts_at: toISO(item.starts_at),
      ends_at: toISO(item.ends_at),
      location_raw: str(item.location),
      // The list only distinguishes online vs. not; enrichment refines the rest.
      format: item.is_online === true ? 'online' : str(item.location) ? 'in_person' : null,
      prize_pool: null,
      themes: [],
    })
  }
  return rows
}

export async function fetchDevfolio(): Promise<IngestRow[]> {
  const rows: IngestRow[] = []
  let sawItems = false

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${BASE}?filter=application_open&page=${page}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`devfolio page ${page} -> ${res.status}`)

    const body = (await res.json()) as { result?: unknown[] }
    const items = body.result
    if (!Array.isArray(items)) {
      throw new Error(
        `devfolio page ${page}: expected result[] array, got ${typeof items} (top keys: ${Object.keys(
          body ?? {}
        )
          .slice(0, 8)
          .join(',')})`
      )
    }
    if (items.length === 0) break
    sawItems = true
    rows.push(...parseDevfolio(items))
  }

  if (rows.length === 0) {
    throw new Error(
      `devfolio: 0 events mapped (sawItems=${sawItems}) — field names (name/slug) drifted?`
    )
  }
  return rows
}
