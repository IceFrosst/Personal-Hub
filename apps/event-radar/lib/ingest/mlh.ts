import type { IngestRow } from './devpost'

// MLH season pages:
//   https://www.mlh.com/seasons/2026/events
//   https://www.mlh.com/seasons/2027/events
// No public API — HTML cards and/or Inertia JSON. Tolerant parse: markup drift
// returns [] for that season; cron surfaces the error fingerprint.

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

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

  // MLH seasons span ~Sep(year-1)–Aug(year): months Sep–Dec belong to year-1.
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
    (str(r.website) ?? str(r.websiteUrl) ?? str(r.url) ?? str(r.event_url)) !== null &&
    (str(r.start_date) ?? str(r.starts_at) ?? str(r.startDate) ?? str(r.startsAt) ?? str(r.start)) !==
      null
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
  const url = str(e.website) ?? str(e.websiteUrl) ?? str(e.url) ?? str(e.event_url)
  if (!title || !url) return null
  const typeRaw =
    str(e.event_type) ??
    str(e.formatType) ??
    str(e.format) ??
    str(e.type) ??
    str(e.event_format) ??
    str(e.modality)
  const format = !typeRaw
    ? null
    : /digital|online|virtual/i.test(typeRaw)
      ? 'online'
      : /hybrid/i.test(typeRaw)
        ? 'hybrid'
        : /in[- ]?person/i.test(typeRaw)
          ? 'in_person'
          : null
  const venue = (e.venueAddress ?? {}) as JsonObject
  const city = str(e.city) ?? str(venue.city)
  const region = str(e.state) ?? str(e.country) ?? str(venue.state) ?? str(venue.country)
  return {
    source: 'mlh',
    source_id: e.id !== undefined && e.id !== null ? String(e.id) : null,
    title,
    url: url.startsWith('http') ? url : `https://www.mlh.com${url}`,
    starts_at: toISO(e.start_date ?? e.starts_at ?? e.startDate ?? e.startsAt ?? e.start),
    ends_at: toISO(e.end_date ?? e.ends_at ?? e.endDate ?? e.endsAt ?? e.end),
    location_raw: str(e.location) ?? ([city, region].filter(Boolean).join(', ') || null),
    format,
    prize_pool: null,
    themes: [],
  }
}

function inertiaCandidates(html: string): string[] {
  const attrs = [
    ...html.matchAll(/data-page="([^"]+)"/g),
    ...html.matchAll(/data-page='([^']+)'/g),
  ].map((m) => decodeEntities(m[1]))
  const scriptBodies = [
    ...html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1].trim())
  return [...attrs, ...scriptBodies]
}

function extractInertiaPayload(html: string): unknown {
  const byLength = inertiaCandidates(html).sort((a, b) => b.length - a.length)
  for (const candidate of byLength) {
    try {
      const parsed: unknown = JSON.parse(candidate)
      if (typeof parsed === 'object' && parsed !== null) return parsed
    } catch {
      /* try next */
    }
  }
  return null
}

export function parseMlhInertia(html: string): IngestRow[] {
  const page = extractInertiaPayload(html)
  if (page === null) return []
  const arrays: JsonObject[][] = []
  findEventArrays(page, arrays)
  if (arrays.length === 0) return []
  const seen = new Set<string>()
  const rows: IngestRow[] = []
  for (const arr of arrays) {
    for (const e of arr) {
      const row = mapInertiaEvent(e)
      if (!row) continue
      const key = row.source_id ?? row.url
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(row)
    }
  }
  return rows
}

function describeDrift(html: string): string {
  const anchors = (html.match(/<a[\s>]/gi) ?? []).length
  const hackathons = (html.match(/hackathon/gi) ?? []).length
  const candidates = inertiaCandidates(html)
  const maxLen = candidates.reduce((a, c) => Math.max(a, c.length), 0)
  const page = extractInertiaPayload(html)
  let inertia = `data-page candidates x${candidates.length} (max ${maxLen}b): `
  if (page !== null) {
    const p = page as JsonObject
    const props = (p.props ?? {}) as JsonObject
    inertia += `component=${String(p.component)}, props keys: ${Object.keys(props)
      .slice(0, 15)
      .join(',')}`
  } else {
    inertia += 'none parseable'
  }
  const sliceAt = (idx: number) =>
    idx < 0 ? '' : html.slice(Math.max(0, idx - 150), idx + 500).replace(/\s+/g, ' ')
  const first = html.search(/hackathon/i)
  const later = html.slice(first + 500).search(/hackathon/i)
  const slices = [sliceAt(first), later < 0 ? '' : sliceAt(first + 500 + later)]
    .filter(Boolean)
    .join(' ⋯ ')
  return `page ${html.length}b, ${anchors} anchors, "hackathon" x${hackathons}, ${inertia}; markup: ${slices}`
}

/** Seasons to scrape — always include current calendar year and the published next season. */
export function mlhSeasonYears(now = new Date()): number[] {
  const y = now.getUTCFullYear()
  // Explicit set so 2027 is never dropped when mid-year math is ambiguous.
  return [...new Set([y, y + 1, 2026, 2027])].filter((s) => s >= y - 1 && s <= y + 1).sort()
}

export async function fetchMlh(): Promise<IngestRow[]> {
  const seasons = mlhSeasonYears()
  const parsed: IngestRow[] = []
  let lastHtml: string | null = null
  const failures: string[] = []

  for (const season of seasons) {
    try {
      const res = await fetch(`https://www.mlh.com/seasons/${season}/events`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      })
      if (!res.ok) {
        failures.push(`${season}: HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      lastHtml = html
      const cards = parseMlhHtml(html, season)
      parsed.push(...(cards.length > 0 ? cards : parseMlhInertia(html)))
    } catch (err) {
      failures.push(`${season}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (lastHtml === null && failures.length > 0) throw new Error(failures.join('; '))
  if (lastHtml !== null && parsed.length === 0) {
    throw new Error(`parsed 0 events — ${describeDrift(lastHtml)}`)
  }

  const cutoff = Date.now() - 86400000
  return parsed.filter((r) => {
    const end = r.ends_at ?? r.starts_at
    return end === null || new Date(end).getTime() >= cutoff
  })
}
