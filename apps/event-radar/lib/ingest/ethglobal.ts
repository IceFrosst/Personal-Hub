import type { IngestRow } from './devpost'

// ETHGlobal events — the flagship travel-friendly circuit (frequent travel
// stipends/grants, exactly what the ranking rewards). ethglobal.com/events is
// a Next.js App Router page: the event catalog rides in the React Server
// Component "flight" stream, i.e. many inline `self.__next_f.push([1,"…"])`
// script chunks whose decoded concatenation contains `"events":[…]` arrays.
// Like the MLH parser, we don't hard-code a path to the data: decode the
// flight text and scan it for arrays of event-shaped objects.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
const PAGE = 'https://ethglobal.com/events'

type JsonObject = Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Decode every `self.__next_f.push([1,"…"])` chunk (the payload is a JS string
// literal — JSON.parse of the quoted form un-escapes it) and concatenate.
export function decodeFlightBlob(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)/g)]
  let blob = ''
  for (const m of chunks) {
    try {
      blob += JSON.parse(`"${m[1]}"`) as string
    } catch {
      // an unparseable chunk loses a slice of the stream, not the whole page
    }
  }
  return blob
}

// Extract every balanced `"events":[…]` array from the flight text. A plain
// regex can't match nested brackets, so walk the string tracking depth.
export function extractEventArrays(blob: string): JsonObject[] {
  const events: JsonObject[] = []
  for (const m of blob.matchAll(/"events":\[/g)) {
    const start = m.index + m[0].length - 1
    let depth = 0
    let inString = false
    let escaped = false
    let i = start
    while (i < blob.length) {
      const ch = blob[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else {
        if (ch === '"') inString = true
        else if (ch === '[') depth++
        else if (ch === ']') {
          depth--
          if (depth === 0) break
        }
      }
      i++
    }
    try {
      const arr: unknown = JSON.parse(blob.slice(start, i + 1))
      if (Array.isArray(arr)) {
        for (const e of arr) {
          if (typeof e === 'object' && e !== null && !Array.isArray(e)) events.push(e as JsonObject)
        }
      }
    } catch {
      // truncated or non-JSON slice — skip this candidate
    }
  }
  return events
}

function looksLikeEvent(e: JsonObject): boolean {
  return str(e.name) !== null && str(e.slug) !== null && toISO(e.startTime ?? e.startsAt) !== null
}

export function parseEthGlobal(html: string): IngestRow[] {
  const blob = decodeFlightBlob(html)
  const seen = new Set<string>()
  const rows: IngestRow[] = []

  for (const e of extractEventArrays(blob)) {
    if (!looksLikeEvent(e)) continue
    // The catalog mixes meetups/cafes/summits with hackathons; only hackathons
    // belong on the radar. Missing `type` is tolerated in case the field moves.
    const type = str(e.type)
    if (type !== null && type !== 'hackathon') continue
    const status = str(e.status)
    if (status === 'finished' || status === 'cancelled') continue

    const slug = str(e.slug)
    const title = str(e.name)
    if (!slug || !title) continue
    if (seen.has(slug)) continue
    seen.add(slug)

    const medium = str(e.medium)
    rows.push({
      source: 'ethglobal',
      source_id: e.id !== undefined && e.id !== null ? String(e.id) : slug,
      title,
      url: `https://ethglobal.com/events/${slug}`,
      starts_at: toISO(e.startTime ?? e.startsAt),
      ends_at: toISO(e.endTime ?? e.endsAt),
      location_raw: null,
      format:
        medium === 'virtual' || medium === 'remote'
          ? 'online'
          : medium === 'hybrid'
            ? 'hybrid'
            : medium === 'physical'
              ? 'in_person'
              : null,
      prize_pool: null,
      registration_deadline: toISO(e.signupDeadline ?? e.registrationDeadline),
      themes: [],
    })
  }
  return rows
}

export async function fetchEthGlobal(): Promise<IngestRow[]> {
  const res = await fetch(PAGE, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`ethglobal -> ${res.status}`)
  const html = await res.text()

  const rows = parseEthGlobal(html)
  if (rows.length === 0) {
    // Fingerprint the page so the cron report says where the data moved.
    const blob = decodeFlightBlob(html)
    throw new Error(
      `ethglobal: 0 hackathons parsed — page ${html.length}b, flight blob ${blob.length}b, ` +
        `"events": x${(blob.match(/"events":/g) ?? []).length}, ` +
        `"slug" x${(blob.match(/"slug"/g) ?? []).length}, ` +
        `"startTime" x${(blob.match(/"startTime"/g) ?? []).length}`
    )
  }
  return rows
}
