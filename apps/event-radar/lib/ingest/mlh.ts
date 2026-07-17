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

// When the parser stops matching, the error should describe the page we did
// get, in enough detail to relocate the event data without pulling the full
// HTML out of production (mlh.io is unreachable from Claude Code sessions).
// The current MLH rebuild is Tailwind/React, so the interesting question is
// where the data lives: server-rendered cards, embedded JSON, or client fetch.
function describeDrift(html: string): string {
  const anchors = (html.match(/<a[\s>]/gi) ?? []).length
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  const rscChunks = (html.match(/__next_f/g) ?? []).length
  const itemprops = (html.match(/itemprop=/g) ?? []).length
  const hackathons = (html.match(/hackathon/gi) ?? []).length
  const hrefs = [
    ...new Set([...html.matchAll(/href="([^"]{1,80})"/g)].map((m) => m[1])),
  ].filter((h) => !/^(#|mailto:)/.test(h))
  return (
    `page ${html.length}b, ${anchors} anchors, __NEXT_DATA__ ${
      nextData ? `${nextData[1].length}b` : 'absent'
    }, __next_f x${rscChunks}, itemprop x${itemprops}, "hackathon" x${hackathons}, ` +
    `hrefs: ${hrefs.slice(0, 12).join(' | ')}`
  )
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
      rows.push(...parseMlhHtml(html, season))
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
