import type { IngestRow } from './devpost'

// Startup Lithuania (https://www.startuplithuania.com) — the national startup
// ecosystem's events calendar. It's a WordPress site whose events live in the
// `cpstart_events` custom post type, exposed by the standard WP REST API:
//   GET /wp-json/wp/v2/cpstart_events?per_page=100  (public, no auth)
// The list is overwhelmingly conferences / meetups / workshops, so we keep only
// the handful of entries whose title reads as a hackathon (Ignas asked for
// hackathons specifically). Lithuania is the home base + top-priority country,
// so a covered hackathon here is the most valuable kind of match.
//
// The REST payload does NOT carry a structured event date (the ACF fields are
// not exposed to REST, and `date` is the post's *publish* time). The event date
// is only rendered, yearless, in the detail page's <h1 class="single-article__title">
// as a `listing__date` (e.g. "Nov 24, 10:00 - Nov 28, 16:00"). So for each
// hackathon-matched entry we fetch its detail page, read that date, and infer the
// year by anchoring to the REST publish date (an event is published shortly
// *before* it happens) — this reconstructs the real edition year, so past
// editions resolve to the past and get dropped by the fail-closed eligibility
// rule instead of masquerading as fake future events.

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const REST = 'https://www.startuplithuania.com/wp-json/wp/v2/cpstart_events'
const PER_PAGE = 100
const MAX_PAGES = 3
// Only a few hackathons ever exist at once; cap detail fetches so a drifted
// filter can never blow the cron's gather budget.
const MAX_DETAIL_FETCHES = 12
const DETAIL_CONCURRENCY = 4

type WpEvent = {
  id?: number
  link?: string
  date_gmt?: string
  title?: { rendered?: string }
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function decodeEntities(s: string): string {
  return s
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ')
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// Same hackathon vocabulary as the Luma source, plus Lithuanian "hakatonas".
export function matchesHackathon(title: string): boolean {
  return /\bhack|hackathon|hack[- ]?day|hack[- ]?night|game\s*jam|buildathon|hakaton|häkaton\b/i.test(
    title
  )
}

// Pull the event's own date out of the detail page. It's rendered inside the
// article title's <h1 class="single-article__title"> as a `listing__date`; the
// same class reappears lower down for related events / news, so we scope to the
// title and take the first one.
export function extractDetailDate(html: string): string | null {
  const titleIdx = html.indexOf('single-article__title')
  const scope = titleIdx >= 0 ? html.slice(titleIdx, titleIdx + 2000) : html
  const m = scope.match(/class="listing__date">([\s\S]*?)<\/div>\s*<\/div>/)
  if (!m) return null
  const text = stripTags(m[1])
  return text || null
}

type DayMonth = { mo: number; day: number }

function monthDay(seg: string): DayMonth | null {
  const m = seg.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/i)
  if (!m) return null
  return { mo: MONTHS[m[1].toLowerCase()], day: parseInt(m[2], 10) }
}

function times(seg: string): Array<[number, number]> {
  return [...seg.matchAll(/(\d{1,2}):(\d{2})/g)].map(
    (m) => [parseInt(m[1], 10), parseInt(m[2], 10)] as [number, number]
  )
}

// Parse a yearless `listing__date` into ISO start/end. The year is anchored to
// the publish date: pick the smallest year that puts the start on/after
// (publish - 30d). Handles single-day ("Apr 24, 10:00, 19:00"), day-only
// ("May 14 - May 16"), and multi-day-with-times ("Nov 24, 10:00 - Nov 28, 16:00")
// forms, including a Dec->Jan year rollover for the end date.
export function parseEventDate(
  raw: string,
  publishedAtISO: string | null
): { starts_at: string; ends_at: string } | null {
  const parts = raw.split(/\s-\s/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null

  const startPart = parts[0]
  const endPart = parts.length >= 2 ? parts[1] : parts[0]
  const s = monthDay(startPart)
  if (!s) return null
  const e = monthDay(endPart) ?? s

  let sh = 0, sm = 0, eh = 23, em = 59
  if (parts.length >= 2) {
    const st = times(startPart)
    const et = times(endPart)
    if (st[0]) [sh, sm] = st[0]
    if (et[0]) [eh, em] = et[0]
  } else {
    // Single segment: any times listed are [start, end] on the same day.
    const t = times(startPart)
    if (t[0]) [sh, sm] = t[0]
    if (t[1]) [eh, em] = t[1]
  }

  const anchorMs = publishedAtISO ? Date.parse(publishedAtISO) : NaN
  const anchor = Number.isFinite(anchorMs)
    ? new Date(anchorMs - 30 * 24 * 60 * 60 * 1000)
    : new Date()

  let year = anchor.getUTCFullYear()
  let start = new Date(Date.UTC(year, s.mo, s.day, sh, sm))
  if (start.getTime() < anchor.getTime()) {
    year += 1
    start = new Date(Date.UTC(year, s.mo, s.day, sh, sm))
  }
  const endYear = e.mo < s.mo ? year + 1 : year
  const end = new Date(Date.UTC(endYear, e.mo, e.day, eh, em))

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { starts_at: start.toISOString(), ends_at: end.toISOString() }
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`startuplithuania -> ${res.status}`)
  return res.json()
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function fetchStartupLithuania(): Promise<IngestRow[]> {
  // 1. Gather the full event list from the REST API (paginated).
  const events: WpEvent[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    let body: unknown
    try {
      body = await fetchJson(`${REST}?per_page=${PER_PAGE}&page=${page}&_fields=id,link,date_gmt,title`)
    } catch (err) {
      // WordPress 400s on pages past the last one — a normal stop, not drift.
      if (page > 1) break
      throw err
    }
    if (!Array.isArray(body)) {
      if (page === 1) throw new Error('startuplithuania: unexpected REST shape')
      break
    }
    events.push(...(body as WpEvent[]))
    if (body.length < PER_PAGE) break
  }

  // Zero events at all means the feed shape/endpoint drifted — surface it.
  if (events.length === 0) {
    throw new Error('startuplithuania: 0 events from REST — endpoint or post type drifted?')
  }

  // 2. Keep only hackathon-titled entries.
  const hackathons = events
    .map((e) => ({
      id: e.id != null ? String(e.id) : null,
      title: str(e.title?.rendered) ? decodeEntities(str(e.title!.rendered!)!) : null,
      link: str(e.link),
      publishedAt: str(e.date_gmt),
    }))
    .filter((e) => e.title && e.link && matchesHackathon(e.title))
    .slice(0, MAX_DETAIL_FETCHES)

  // Legitimately empty: the site simply has no hackathons listed right now.
  if (hackathons.length === 0) return []

  // 3. Fetch each detail page for its (yearless) event date, in small batches.
  const rows: IngestRow[] = []
  const now = Date.now()
  for (let i = 0; i < hackathons.length; i += DETAIL_CONCURRENCY) {
    const batch = hackathons.slice(i, i + DETAIL_CONCURRENCY)
    const settled = await Promise.all(
      batch.map(async (h) => {
        const html = await fetchText(h.link!)
        if (!html) return null
        const raw = extractDetailDate(html)
        if (!raw) return null
        const dates = parseEventDate(raw, h.publishedAt)
        if (!dates) return null
        return { h, dates }
      })
    )
    for (const r of settled) {
      if (!r) continue
      // Drop editions that have already ended — keeps dead rows out of the catalog
      // (the fail-closed feed filter would hide them anyway).
      if (Date.parse(r.dates.ends_at) < now) continue
      rows.push({
        source: 'startuplithuania',
        source_id: r.h.id,
        title: r.h.title!,
        url: r.h.link!,
        starts_at: r.dates.starts_at,
        ends_at: r.dates.ends_at,
        location_raw: null, // venue is free-text only; enrichment fills city/country
        format: null, // let enrichment decide (most are in-person, some hybrid)
        prize_pool: null,
        themes: [],
      })
    }
  }

  return rows
}
