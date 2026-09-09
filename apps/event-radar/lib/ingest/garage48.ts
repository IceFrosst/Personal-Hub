import type { IngestRow } from './devpost'
import { continentOf } from '@/lib/continents'

/**
 * Garage48 — Estonia's hackathon organiser (48-hour builds since 2010; also
 * runs Hack the Crisis). Estonia is a priority country a bus ride from home,
 * and these are exactly the in-person, multi-day, student-friendly events the
 * radar is for — yet until now Garage48 existed in the catalog only as a
 * hand-maintained `watch` row with approximate dates.
 *
 * The site is a Voog CMS page. `/events` renders an "Upcoming events" block of
 * `.gr-event` cards, each with the title, a `/events/<slug>` link, and
 * `When … <strong>date</strong>` / `Where … <strong>place</strong>` lines.
 * Server-rendered, no auth. Past events sit in a separate `.gr-past-events`
 * block that we never read.
 *
 * Dates come in every shape a human would type — measured 2026-09-09:
 *   "16 - 18 October 2026"        "8 August 2026"
 *   "New date! October 16-18"     "17 April - 30 June, 2026"
 * `parseGarageDate` handles day-first and month-first, single and ranged, and
 * infers a missing year as the nearest one that keeps the event current.
 *
 * Garage48's Estonian venues are written without the country ("Jõhvi,
 * Ida-Viru", "EWERS Tehnomaja (Pärna tee 22, Väimela)"), while foreign
 * editions name theirs ("Bangkok, Thailand"). We append ", Estonia" only when
 * the continent classifier cannot place the string — so a Thai edition stays
 * Thai and the Regions filter treats it correctly.
 *
 * Every dated event is kept, not just hack-named ones: "Future of Wood 2026"
 * is a 3-day makeathon and would fail a title test. The organiser IS the
 * filter here. Events with no "When" (e.g. a programme still taking
 * applications) have no start and are dropped by the fail-closed feed anyway.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const ORIGIN = 'https://garage48.org'
const LIST_URL = `${ORIGIN}/events`

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?'

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type DM = { mo: number; day: number }

/** "16 October" / "October 16" / "16" (day only, month supplied by caller). */
function dayMonth(seg: string, fallbackMonth: number | null): DM | null {
  const dayFirst = seg.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s*(?:of\\s+)?${MONTH_RE}`, 'i'))
  if (dayFirst) return { day: parseInt(dayFirst[1], 10), mo: MONTHS[dayFirst[2].toLowerCase()] }
  const monthFirst = seg.match(new RegExp(`${MONTH_RE}\\s+(\\d{1,2})`, 'i'))
  if (monthFirst) return { mo: MONTHS[monthFirst[1].toLowerCase()], day: parseInt(monthFirst[2], 10) }
  const bare = seg.match(/^\s*(\d{1,2})\s*$/)
  if (bare && fallbackMonth !== null) return { mo: fallbackMonth, day: parseInt(bare[1], 10) }
  return null
}

/**
 * Parse a Garage48 "When" string into ISO bounds. Whole days: start is 00:00Z
 * of the first day, end 23:59:59Z of the last (same convention as the
 * Eventbrite source, so Multi-day reads the same for both).
 *
 * A missing year is the smallest year that puts the start no more than 30
 * days before `now` — an organiser only omits the year when it is obvious,
 * i.e. the upcoming edition.
 */
export function parseGarageDate(
  raw: string,
  now: Date = new Date()
): { starts_at: string; ends_at: string } | null {
  const text = decode(raw)
    .replace(/new date!?/i, '')
    .replace(/[–—]/g, '-')
    .trim()
  if (!text) return null

  const yearMatch = text.match(/\b(20\d{2})\b/)
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null
  const body = text.replace(/,?\s*\b20\d{2}\b/, '').trim()

  const parts = body.split(/\s*-\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0 || parts.length > 2) return null

  // "October 16-18": the month sits on the first part only; "16 - 18 October":
  // the month sits on the last part only. Resolve whichever side has one and
  // lend it to the bare-number side.
  const monthOf = (seg: string): number | null => {
    const m = seg.match(new RegExp(MONTH_RE, 'i'))
    return m ? MONTHS[m[1].toLowerCase()] : null
  }
  const startMonth = monthOf(parts[0])
  const endMonth = parts.length === 2 ? monthOf(parts[1]) : startMonth
  const s = dayMonth(parts[0], startMonth ?? endMonth)
  const e = parts.length === 2 ? dayMonth(parts[1], endMonth ?? startMonth) : s
  if (!s || !e) return null

  let y = year
  if (y === null) {
    const floor = now.getTime() - 30 * 86400000
    y = now.getUTCFullYear() - 1
    while (Date.UTC(y, s.mo, s.day) < floor) y++
  }
  let endYear = y
  if (e.mo < s.mo || (e.mo === s.mo && e.day < s.day)) endYear = y + 1

  const starts = new Date(Date.UTC(y, s.mo, s.day, 0, 0, 0))
  const ends = new Date(Date.UTC(endYear, e.mo, e.day, 23, 59, 59))
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return null
  return { starts_at: starts.toISOString(), ends_at: ends.toISOString() }
}

/** Append the country Garage48 leaves implicit, unless the string already places itself. */
export function placeOf(where: string | null): string | null {
  if (!where) return null
  const w = decode(where)
  if (!w) return null
  if (/^online\b/i.test(w)) return w
  return continentOf({ country: null, city: null, location_raw: w, title: '' }) ? w : `${w}, Estonia`
}

export type GarageCard = { title: string; slug: string; when: string | null; where: string | null }

/** The upcoming block only — past events live in a sibling block we skip. */
export function extractUpcomingCards(html: string): { cards: GarageCard[]; totalCards: number } {
  const totalCards = (html.match(/class="gr-event"/g) ?? []).length
  // The class list is `gr-events gr-site-horizontal-pad-80 gr-future-events`;
  // match by the two classes that matter, whatever sits between them.
  const startMatch = /class="gr-events [^"]*gr-future-events"/.exec(html)
  if (!startMatch) return { cards: [], totalCards }
  const start = startMatch.index
  const endIdx = html.indexOf('gr-past-events', start)
  const block = html.slice(start, endIdx > 0 ? endIdx : undefined)

  const cards: GarageCard[] = []
  // Split on the card opener and read each chunk — the cards are flat siblings.
  const chunks = block.split('<div class="gr-event">').slice(1)
  for (const chunk of chunks) {
    const title = chunk.match(/class="gr-event__title">([\s\S]*?)<\/h4>/)
    const link = chunk.match(/href="\/events\/([^"/?#]+)"/)
    if (!title || !link) continue
    const when = chunk.match(/When\s*(?:&nbsp;?)?\s*<strong>([\s\S]*?)<\/strong>/i)
    const where = chunk.match(/Where\s*(?:&nbsp;?)?\s*<strong>([\s\S]*?)<\/strong>/i)
    cards.push({
      title: decode(title[1]),
      slug: link[1],
      when: when ? decode(when[1]) || null : null,
      where: where ? decode(where[1]) || null : null,
    })
  }
  return { cards, totalCards }
}

export function parseGarage48(html: string, now: Date = new Date()): IngestRow[] {
  const { cards } = extractUpcomingCards(html)
  const rows: IngestRow[] = []
  for (const c of cards) {
    const dates = c.when ? parseGarageDate(c.when, now) : null
    const place = placeOf(c.where)
    rows.push({
      source: 'garage48',
      source_id: c.slug,
      title: c.title,
      url: `${ORIGIN}/events/${c.slug}`,
      starts_at: dates?.starts_at ?? null,
      ends_at: dates?.ends_at ?? null,
      location_raw: place,
      format: place && /^online\b/i.test(place) ? 'online' : place ? 'in_person' : null,
      prize_pool: null,
      themes: ['garage48'],
    })
  }
  return rows
}

export async function fetchGarage48(): Promise<IngestRow[]> {
  let res: Response
  try {
    res = await fetch(LIST_URL, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
  } catch (err) {
    throw new Error(`garage48: fetch failed — ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!res.ok) throw new Error(`garage48 -> ${res.status}`)
  const html = await res.text()

  // Zero cards on the WHOLE page (past block included) means the markup moved;
  // zero upcoming with a populated past block is a quiet season, not an error.
  const { totalCards } = extractUpcomingCards(html)
  if (totalCards === 0) {
    throw new Error(`garage48: no .gr-event cards on /events (${html.length} bytes) — markup moved?`)
  }

  const now = Date.now()
  return parseGarage48(html).filter((r) => {
    const start = r.starts_at ? Date.parse(r.starts_at) : NaN
    return Number.isFinite(start) && start > now
  })
}
