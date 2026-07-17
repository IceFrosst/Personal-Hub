import type { IngestRow } from './devpost'

// MLH lists a season's events as static HTML cards at
// https://mlh.io/seasons/<year>/events. No API — this is a deliberately
// tolerant regex parse: when the markup drifts we return [] for the season
// rather than throwing, and the cron's per-source error reporting surfaces it.

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

// "Sep 12th - 14th" / "Oct 3rd - Nov 1st" plus a season year hint.
export function parseMlhDates(raw: string, year: number): [string | null, string | null] {
  const clean = raw.toLowerCase().replace(/(\d+)(st|nd|rd|th)/g, '$1')
  const parts = clean.split('-').map((p) => p.trim())

  const parsePart = (part: string, fallbackMonth: number | null): [number | null, number | null] => {
    const m = part.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})/)
    if (m && MONTHS[m[1]] !== undefined) return [MONTHS[m[1]], parseInt(m[2], 10)]
    const dayOnly = part.match(/^(\d{1,2})/)
    if (dayOnly && fallbackMonth !== null) return [fallbackMonth, parseInt(dayOnly[1], 10)]
    return [null, null]
  }

  const [m1, d1] = parsePart(parts[0], null)
  const [m2, d2] = parts.length > 1 ? parsePart(parts[1], m1) : [m1, d1]

  // MLH seasons span Sep(year-1)–Aug(year): months Sep–Dec belong to year-1.
  const resolveYear = (m: number | null) => (m !== null && m >= 8 ? year - 1 : year)
  const toISO = (m: number | null, d: number | null) =>
    m !== null && d !== null ? new Date(Date.UTC(resolveYear(m), m, d)).toISOString() : null

  return [toISO(m1, d1), toISO(m2, d2)]
}

function extract(block: string, re: RegExp): string | null {
  const m = block.match(re)
  return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || null : null
}

export function parseMlhHtml(html: string, seasonYear: number): IngestRow[] {
  const rows: IngestRow[] = []
  // Each event is an <a class="event-link" href="..."> card.
  const cardRe = /<a[^>]*class="[^"]*event-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = cardRe.exec(html)) !== null) {
    const [, href, block] = m
    const title = extract(block, /<h3[^>]*class="[^"]*event-name[^"]*"[^>]*>([\s\S]*?)<\/h3>/)
    if (!title || !href) continue

    const date = extract(block, /<p[^>]*class="[^"]*event-date[^"]*"[^>]*>([\s\S]*?)<\/p>/)
    const city = extract(block, /<span[^>]*itemprop="city"[^>]*>([\s\S]*?)<\/span>/)
    const state = extract(block, /<span[^>]*itemprop="state"[^>]*>([\s\S]*?)<\/span>/)
    const ribbon = extract(block, /<div[^>]*class="[^"]*event-hybrid-notes[^"]*"[^>]*>([\s\S]*?)<\/div>/)

    const [starts, ends] = date ? parseMlhDates(date, seasonYear) : [null, null]
    const digital = ribbon ? /digital|online/i.test(ribbon) : /everywhere/i.test(city ?? '')

    rows.push({
      source: 'mlh',
      source_id: null,
      title,
      url: href.startsWith('http') ? href : `https://mlh.io${href}`,
      starts_at: starts,
      ends_at: ends,
      location_raw: [city, state].filter(Boolean).join(', ') || null,
      format: digital ? 'online' : ribbon && /in[- ]person/i.test(ribbon) ? 'in_person' : null,
      prize_pool: null,
      themes: [],
    })
  }
  return rows
}

// ---- Inertia.js path ----
// MLH rebuilt their site on Inertia (Vite assets, no semantic classes): the
// whole page state is HTML-escaped JSON in a root element's data-page
// attribute. We don't hard-code the props path to the events — Inertia prop
// shapes move — instead we scan the payload for the largest array of objects
// that look like events and map field-name variants defensively.

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

type JsonObject = Record<string, unknown>

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function looksLikeEvent(o: unknown): o is JsonObject {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return false
  const r = o as JsonObject
  return (
    (str(r.name) ?? str(r.title)) !== null &&
    (str(r.website) ?? str(r.url) ?? str(r.event_url)) !== null &&
    (str(r.start_date) ?? str(r.starts_at) ?? str(r.startDate) ?? str(r.start)) !== null
  )
}

function findEventArrays(node: unknown, out: JsonObject[][]): void {
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every(looksLikeEvent)) out.push(node as JsonObject[])
    else node.forEach((n) => findEventArrays(n, out))
  } else if (typeof node === 'object' && node !== null) {
    Object.values(node).forEach((v) => findEventArrays(v, out))
  }
}

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function mapInertiaEvent(e: JsonObject): IngestRow | null {
  const title = str(e.name) ?? str(e.title)
  const url = str(e.website) ?? str(e.url) ?? str(e.event_url)
  if (!title || !url) return null
  const typeRaw =
    str(e.event_type) ?? str(e.format) ?? str(e.type) ?? str(e.event_format) ?? str(e.modality)
  const format = !typeRaw
    ? null
    : /digital|online|virtual/i.test(typeRaw)
      ? 'online'
      : /hybrid/i.test(typeRaw)
        ? 'hybrid'
        : /in[- ]?person/i.test(typeRaw)
          ? 'in_person'
          : null
  const city = str(e.city)
  const region = str(e.state) ?? str(e.country)
  return {
    source: 'mlh',
    source_id: e.id !== undefined && e.id !== null ? String(e.id) : null,
    title,
    url: url.startsWith('http') ? url : `https://mlh.io${url}`,
    starts_at: toISO(e.start_date ?? e.starts_at ?? e.startDate ?? e.start),
    ends_at: toISO(e.end_date ?? e.ends_at ?? e.endDate ?? e.end),
    location_raw: str(e.location) ?? ([city, region].filter(Boolean).join(', ') || null),
    format,
    prize_pool: null,
    themes: [],
  }
}

export function parseMlhInertia(html: string): IngestRow[] {
  const m = html.match(/data-page="([^"]+)"/)
  if (!m) return []
  let page: unknown
  try {
    page = JSON.parse(decodeEntities(m[1]))
  } catch {
    return []
  }
  const arrays: JsonObject[][] = []
  findEventArrays(page, arrays)
  if (arrays.length === 0) return []
  const best = arrays.reduce((a, b) => (b.length > a.length ? b : a))
  return best.map(mapInertiaEvent).filter((r): r is IngestRow => r !== null)
}

// When the parser stops matching, the error should describe the page we did
// get, in enough detail to relocate the event data without pulling the full
// HTML out of production (mlh.io is unreachable from Claude Code sessions).
function describeDrift(html: string): string {
  const anchors = (html.match(/<a[\s>]/gi) ?? []).length
  const hackathons = (html.match(/hackathon/gi) ?? []).length
  const pageAttr = html.match(/data-page="([^"]+)"/)
  let inertia = 'data-page absent'
  if (pageAttr) {
    try {
      const page = JSON.parse(decodeEntities(pageAttr[1])) as JsonObject
      const props = (page.props ?? {}) as JsonObject
      inertia = `inertia component=${String(page.component)}, props keys: ${Object.keys(props)
        .slice(0, 15)
        .join(',')}`
    } catch {
      inertia = `data-page present but unparseable (${pageAttr[1].length}b)`
    }
  }
  return `page ${html.length}b, ${anchors} anchors, "hackathon" x${hackathons}, ${inertia}`
}

export async function fetchMlh(): Promise<IngestRow[]> {
  // Mid-season the current year still has upcoming events and the next season
  // is already published — fetch both, tolerating a failure on either. But
  // "nothing ingested" must never be silent: if NO season yields a page the
  // error carries the HTTP statuses (fetch/blocking problem), and if pages
  // arrive but zero cards parse the error carries a markup fingerprint
  // (regex drift). A plain [] here would look like "no events listed".
  const year = new Date().getUTCFullYear()
  const seasons = [year, year + 1]
  const rows: IngestRow[] = []
  let lastHtml: string | null = null
  const failures: string[] = []

  for (const season of seasons) {
    try {
      const res = await fetch(`https://mlh.io/seasons/${season}/events`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        failures.push(`${season}: HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      lastHtml = html
      const parsed = parseMlhHtml(html, season)
      rows.push(...(parsed.length > 0 ? parsed : parseMlhInertia(html)))
    } catch (err) {
      failures.push(`${season}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (lastHtml === null && failures.length > 0) throw new Error(failures.join('; '))
  if (lastHtml !== null && rows.length === 0) {
    throw new Error(`parsed 0 events — ${describeDrift(lastHtml)}`)
  }
  return rows
}
