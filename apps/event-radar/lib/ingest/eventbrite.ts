import type { IngestRow } from './devpost'

/**
 * Eventbrite — per-country "hackathon" search pages, read through their
 * server-rendered JSON-LD.
 *
 * Why it matters: measured from open egress on 2026-09-09, the first result
 * page for each of 20 European countries carried ~55 genuine in-person
 * hackathons — Cumulocity AIoT (Leipzig), Healthcare Hackathon Bayern, Eclipse
 * SDV, Social Hackathon Bonn, Odoo Hackathon (BE), Recharge Eindhoven, TechEx
 * Amsterdam, herHACK (Zürich), Mage-OS Bologna, SIKA Hackathon (Madrid),
 * Liverpool City Region Innovation Hackathon… Almost none were in the catalog.
 * These are corporate, municipal and university hackathons that never touch
 * Devpost, MLH or Luma; Eventbrite is simply where mainland Europe sells the
 * ticket. It is the second EU-shaped source after HackTrack, and far broader.
 *
 * How: `https://www.eventbrite.com/d/<country>/hackathon/?page=N` is public,
 * no auth, and embeds an `ItemList` of schema.org `Event`s (name, date-only
 * start/end, `Place` with `PostalAddress`, attendance mode, URL). Twenty events
 * a page, relevance-ranked — so page 2 is mostly barcamps and job fairs.
 *
 * Two deliberate filters, because the search is fuzzy:
 *   • the same name test the Luma source applies (a "hackathon" query returns
 *     LinkedIn bootcamps and rave nights once the real matches run out), and
 *   • an exclusion list for recruiting formats that wear the word — HackerX
 *     and WomenHack "Employer Ticket" listings are hiring fairs, not hackathons,
 *     and they were 40 of the 95 name matches in the probe.
 *
 * Paging stops the moment a page yields nothing we keep: relevance ranking
 * means a dry page is followed by drier ones, so reading on spends 700 KB a
 * page for nothing (Germany page 2 = three HackerX rows). MAX_PAGES is a guard.
 *
 * Limits, both known: no registration deadline in the payload (rows wait on
 * enrichment, like HackTrack and allhackathons), and dates are calendar days,
 * not times — see `dayBounds`. The Eventbrite event page itself is server-
 * rendered with a full description, so enrichment has something to read.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const BASE = 'https://www.eventbrite.com/d'
export const MAX_PAGES = 3
const CONCURRENCY = 4

/**
 * Country slug → the name every geography check downstream expects. The
 * priority countries first, then the rest of Europe that showed events.
 * Everything here is one request per sweep when its first page is dry.
 */
export const EVENTBRITE_COUNTRIES: ReadonlyArray<readonly [slug: string, name: string]> = [
  ['lithuania', 'Lithuania'],
  ['latvia', 'Latvia'],
  ['estonia', 'Estonia'],
  ['poland', 'Poland'],
  ['finland', 'Finland'],
  ['germany', 'Germany'],
  ['netherlands', 'Netherlands'],
  ['sweden', 'Sweden'],
  ['denmark', 'Denmark'],
  ['norway', 'Norway'],
  ['italy', 'Italy'],
  ['czech-republic', 'Czechia'],
  ['united-kingdom', 'United Kingdom'],
  ['belgium', 'Belgium'],
  ['austria', 'Austria'],
  ['hungary', 'Hungary'],
  ['switzerland', 'Switzerland'],
  ['france', 'France'],
  ['spain', 'Spain'],
  ['portugal', 'Portugal'],
  ['ireland', 'Ireland'],
  ['romania', 'Romania'],
  ['greece', 'Greece'],
  ['croatia', 'Croatia'],
  ['slovakia', 'Slovakia'],
  ['slovenia', 'Slovenia'],
  ['bulgaria', 'Bulgaria'],
  ['luxembourg', 'Luxembourg'],
  ['serbia', 'Serbia'],
  ['iceland', 'Iceland'],
]

/** Same name test as `parseLumaPage` — the two must agree on what counts. */
const HACK_RE = /\bhack|hackathon|hack[- ]?day|hack[- ]?night|game\s*jam|buildathon|hakaton|häkaton\b/i

/** Formats that use the word without being one. */
const EXCLUDE_RE =
  /hackerx|womenhack|employer ticket|job fair|masterclass|bootcamp|watch party|information session|info session/i

type LdEvent = {
  '@type'?: unknown
  name?: unknown
  url?: unknown
  startDate?: unknown
  endDate?: unknown
  eventAttendanceMode?: unknown
  description?: unknown
  location?: unknown
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function isEvent(o: unknown): o is LdEvent {
  if (!o || typeof o !== 'object') return false
  const t = (o as LdEvent)['@type']
  return t === 'Event' || (Array.isArray(t) && t.includes('Event'))
}

/** Every schema.org Event in every JSON-LD block, however nested. */
export function extractLdEvents(html: string): LdEvent[] {
  const out: LdEvent[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let json: unknown
    try {
      json = JSON.parse(m[1])
    } catch {
      continue
    }
    const walk = (o: unknown) => {
      if (Array.isArray(o)) {
        for (const v of o) walk(v)
        return
      }
      if (!o || typeof o !== 'object') return
      if (isEvent(o)) out.push(o)
      for (const v of Object.values(o as Record<string, unknown>)) walk(v)
    }
    walk(json)
  }
  return out
}

/**
 * The list JSON-LD gives calendar days ("2026-09-21"), not instants. A bare
 * date parses as 00:00 UTC, which would make a two-day event 24h long and a
 * one-day event 0h — and the feed's Multi-day chip asks for > 24h. So the
 * start is the beginning of its day and the end is the END of its day: a
 * two-day hackathon reads as ~48h (multi-day), a one-day one as ~24h (not).
 * When the source does give a time, it is passed through untouched.
 */
export function dayBounds(
  start: string | null,
  end: string | null
): { starts_at: string | null; ends_at: string | null } {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/
  const toISO = (s: string | null, endOfDay: boolean): string | null => {
    if (!s) return null
    if (dateOnly.test(s)) return `${s}T${endOfDay ? '23:59:59.000' : '00:00:00.000'}Z`
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const starts_at = toISO(start, false)
  let ends_at = toISO(end ?? start, true)
  if (starts_at && ends_at && Date.parse(ends_at) < Date.parse(starts_at)) ends_at = toISO(start, true)
  return { starts_at, ends_at }
}

function formatOf(mode: unknown): IngestRow['format'] {
  const m = str(mode)?.toLowerCase() ?? ''
  if (m.includes('online')) return 'online'
  if (m.includes('mixed')) return 'hybrid'
  if (m.includes('offline')) return 'in_person'
  return null
}

/** Canonical event URL: no tracking params, keep whatever TLD Eventbrite used. */
export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    if (!/(^|\.)eventbrite\.[a-z.]+$/i.test(u.hostname)) return null
    return `${u.origin}${u.pathname}`
  } catch {
    return null
  }
}

function sourceIdOf(url: string): string | null {
  const m = /-(\d{6,})\/?$/.exec(url)
  return m ? m[1] : null
}

export function isHackathonName(name: string): boolean {
  return HACK_RE.test(name) && !EXCLUDE_RE.test(name)
}

/**
 * Parse one search page. `total` is every Event on the page (for the
 * stop-on-dry and drift checks); `rows` is what survives the name filter.
 * The queried country wins over the card's own country code: Eventbrite
 * placed the event under that country, and the codes are noisy in exactly the
 * cases that matter (a Vienna hackathon tagged "AU", a Berlin one "NL").
 */
export function parseEventbritePage(
  html: string,
  countryName: string
): { rows: IngestRow[]; total: number } {
  const events = extractLdEvents(html)
  const rows: IngestRow[] = []
  for (const e of events) {
    const name = str(e.name)
    const rawUrl = str(e.url)
    if (!name || !rawUrl || !isHackathonName(name)) continue
    const url = canonicalUrl(rawUrl)
    if (!url) continue

    const loc = (e.location ?? null) as { address?: { addressLocality?: unknown } } | null
    const locality = str(loc?.address?.addressLocality)
    const format = formatOf(e.eventAttendanceMode)
    const { starts_at, ends_at } = dayBounds(str(e.startDate), str(e.endDate))

    rows.push({
      source: 'eventbrite',
      source_id: sourceIdOf(url),
      title: name,
      url,
      starts_at,
      ends_at,
      location_raw:
        format === 'online' ? null : [locality, countryName].filter(Boolean).join(', ') || null,
      format,
      prize_pool: null,
      themes: [],
    })
  }
  return { rows, total: events.length }
}

async function fetchPage(slug: string, page: number): Promise<string> {
  const url = `${BASE}/${slug}/hackathon/${page > 1 ? `?page=${page}` : ''}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`eventbrite ${slug} p${page} -> ${res.status}`)
  return res.text()
}

type CountryResult = { rows: IngestRow[]; pagesOk: number; error?: string; emptyPage?: boolean }

async function sweepCountry(slug: string, name: string): Promise<CountryResult> {
  const rows: IngestRow[] = []
  let pagesOk = 0
  for (let page = 1; page <= MAX_PAGES; page++) {
    let html: string
    try {
      html = await fetchPage(slug, page)
    } catch (err) {
      if (pagesOk === 0) return { rows, pagesOk, error: err instanceof Error ? err.message : String(err) }
      break
    }
    pagesOk++
    const { rows: kept, total } = parseEventbritePage(html, name)
    if (total === 0) {
      // A 200 with no JSON-LD events at all is markup drift, not "no events":
      // Eventbrite always pads a country page with fuzzy matches.
      return { rows, pagesOk, emptyPage: true }
    }
    rows.push(...kept)
    // Relevance order: once a page has nothing we keep, the next has less.
    if (kept.length === 0 || total < 20) break
  }
  return { rows, pagesOk }
}

export async function fetchEventbrite(
  countries: ReadonlyArray<readonly [string, string]> = EVENTBRITE_COUNTRIES
): Promise<IngestRow[]> {
  const results: CountryResult[] = new Array(countries.length)
  let next = 0
  const worker = async () => {
    while (next < countries.length) {
      const i = next++
      const [slug, name] = countries[i]
      results[i] = await sweepCountry(slug, name)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, countries.length) }, worker))

  const fetchedOk = results.filter((r) => r.pagesOk > 0)
  if (fetchedOk.length === 0) {
    const reasons = results.map((r) => r.error ?? 'unknown').slice(0, 5).join('; ')
    throw new Error(`eventbrite: every country page failed — ${reasons}`)
  }
  if (fetchedOk.every((r) => r.emptyPage)) {
    throw new Error(
      'eventbrite: pages fetch OK but carry no JSON-LD events on any country — markup moved?'
    )
  }

  // One event can sit on two country pages (a Luxembourg listing shows up
  // under Belgium too). Dedupe on URL here so the runner's URL-based insert
  // filter never sees two candidates for one row.
  const now = Date.now()
  const byUrl = new Map<string, IngestRow>()
  for (const r of results) {
    for (const row of r.rows) {
      const start = row.starts_at ? Date.parse(row.starts_at) : NaN
      if (!Number.isFinite(start) || start <= now) continue
      if (!byUrl.has(row.url)) byUrl.set(row.url, row)
    }
  }
  return [...byUrl.values()]
}
