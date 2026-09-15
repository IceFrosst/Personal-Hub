import type { IngestRow } from './devpost'

/**
 * Google News RSS — press mentions of hackathons in the Baltics, Poland and the
 * Nordics, in English and Lithuanian only.
 *
 * Why: corporate, municipal and university hackathons in this region do not
 * self-list on Luma or Eventbrite; they announce through a press release that
 * Delfi, LRT, 15min or a city portal picks up. 145 Baltic and Nordic company
 * names returned zero on Luma (see lib/frontier-vendors.ts) while a single
 * Lithuanian news query returned 52 articles — a police hackathon, a Klaipėda
 * hackathon, Tech_Champ Kaunas, LT Game Jam, and "Google opens applications for
 * Warsaw student AI hackathon" three weeks before it was anywhere else.
 *
 * Language rule (Ignas, 2026-09-15): English and Lithuanian words only. If an
 * event cannot be found under either, English is unlikely to be its working
 * language, and it is not one to travel for.
 *
 * What this source can and cannot do — read this before "fixing" it:
 *
 *   • Google wraps every link in `news.google.com/rss/articles/<token>`. The
 *     token is opaque and the page is a 580 KB JS shell; the publisher URL is
 *     fetched client-side through a private RPC (`Fbv4je` / `garturlreq`).
 *     Measured 2026-09-15: that RPC returns error code 3 for these tokens in
 *     every payload variant the community decoder uses; Bing News exact-title
 *     search resolved 0 of 10 Google titles; GDELT is 429 behind a shared
 *     egress IP; Yahoo News RSS is unreachable; DuckDuckGo serves a bot
 *     challenge. So **rows carry the Google link as their URL**. It opens fine
 *     in a browser (Google redirects a real visitor), but nothing server-side
 *     can read the article.
 *   • Therefore no dates. `starts_at` stays null, and the fail-closed feed
 *     never shows these rows. They surface in the **New tab only**, which by
 *     design lists date-less arrivals for 72 h — a press-mentions stream the
 *     human clicks through. That is the deliverable; it is not a bug.
 *   • Enrichment is skipped for `news.google.com` URLs (run.ts) — reading a JS
 *     shell would burn one of the 30 LLM slots per run for a guaranteed null.
 *
 * Filters, because news is noisy: the title must carry the word (EN
 * "hackathon", LT "hakaton-" in any declension); retrospective titles are
 * dropped ("vykęs", "praūžė", "hosted", "winners"…); items older than
 * MAX_AGE_DAYS are dropped — an announcement older than that is about an
 * edition that already ran.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const BASE = 'https://news.google.com/rss/search'
export const MAX_AGE_DAYS = 45
const MAX_PER_QUERY = 15

export type NewsQuery = {
  /** Google News search string — English or Lithuanian words only. */
  q: string
  hl: string
  gl: string
  ceid: string
  /** Geography prior for the row when the query itself implies one. */
  location_raw: string | null
}

export const NEWS_QUERIES: readonly NewsQuery[] = [
  // Lithuanian — the word alone; declensions are matched by the title filter.
  { q: 'hakatonas', hl: 'lt', gl: 'LT', ceid: 'LT:lt', location_raw: 'Lithuania' },
  {
    q: 'hackathon (Lithuania OR Vilnius OR Kaunas OR Klaipėda)',
    hl: 'en',
    gl: 'LT',
    ceid: 'LT:en',
    location_raw: 'Lithuania',
  },
  {
    q: 'hackathon (Riga OR Tallinn OR Tartu OR Latvia OR Estonia)',
    hl: 'en',
    gl: 'LT',
    ceid: 'LT:en',
    location_raw: null,
  },
  {
    // English spellings on purpose (Krakow, not Kraków) — the language rule.
    q: 'hackathon (Warsaw OR Krakow OR Gdansk OR Wroclaw OR Poland)',
    hl: 'en',
    gl: 'LT',
    ceid: 'LT:en',
    location_raw: null,
  },
  {
    q: 'hackathon (Helsinki OR Stockholm OR Copenhagen OR Oslo)',
    hl: 'en',
    gl: 'LT',
    ceid: 'LT:en',
    location_raw: null,
  },
]

/** EN "hackathon"/"hack day"; LT "hakatonas/hakatone/hakatoną/hakatonai…". */
const HACK_RE = /hackathon|hack[- ]?day|hakaton/i

/**
 * Past-tense / recap markers. Lithuanian forms are the unambiguous ones only:
 * "bus surengtas" (will be held) shares a stem with "surengtas", so that stem
 * is deliberately absent. "vyksta" (is happening) is present tense and kept.
 */
const RETROSPECTIVE_RE =
  /\b(vyko|vykęs|vykusi|vykusio|vykusiame|įvyko|baigėsi|pasibaigė|laimėjo|nugalėjo|nugalėtoj|apdovanoj|praūž|pristatė|hosted|held|took place|winners?\b|won\b|wrapped|recap|concluded|crowned|looks back|highlights)/i

const decode = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()

export type NewsItem = {
  title: string
  link: string
  guid: string | null
  pubDate: string | null
  publisher: string | null
}

const tag = (block: string, name: string): string | null => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return m ? decode(m[1]) : null
}

export function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  const re = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]
    const title = tag(block, 'title')
    const link = tag(block, 'link')
    if (!title || !link) continue
    items.push({
      title,
      link,
      guid: tag(block, 'guid'),
      pubDate: tag(block, 'pubDate'),
      publisher: tag(block, 'source'),
    })
  }
  return items
}

export function isAnnouncement(title: string): boolean {
  return HACK_RE.test(title) && !RETROSPECTIVE_RE.test(title)
}

/** Google appends " - Publisher" to every title; keep it, but as a clean dash. */
export function cleanTitle(title: string, publisher: string | null): string {
  let t = title
  if (publisher && t.endsWith(` - ${publisher}`)) t = t.slice(0, -(publisher.length + 3)).trim()
  return publisher ? `${t} — ${publisher}` : t
}

export function itemsToRows(
  items: NewsItem[],
  query: NewsQuery,
  now: Date = new Date()
): IngestRow[] {
  const floor = now.getTime() - MAX_AGE_DAYS * 86400000
  const rows: IngestRow[] = []
  for (const it of items) {
    if (!isAnnouncement(it.title)) continue
    const published = it.pubDate ? Date.parse(it.pubDate) : NaN
    if (!Number.isFinite(published) || published < floor || published > now.getTime() + 86400000)
      continue
    let url: string
    try {
      const u = new URL(it.link)
      if (!/(^|\.)news\.google\.com$/.test(u.hostname)) continue
      url = `${u.origin}${u.pathname}` // drop ?oc=5 and locale params — stable per article
    } catch {
      continue
    }
    rows.push({
      source: 'newsrss',
      source_id: it.guid ?? null,
      title: cleanTitle(it.title, it.publisher),
      url,
      starts_at: null,
      ends_at: null,
      location_raw: query.location_raw,
      format: null,
      prize_pool: null,
      themes: ['news'],
    })
    if (rows.length >= MAX_PER_QUERY) break
  }
  return rows
}

export function queryUrl(q: NewsQuery): string {
  const p = new URLSearchParams({ q: q.q, hl: q.hl, gl: q.gl, ceid: q.ceid })
  return `${BASE}?${p.toString()}`
}

export async function fetchNewsRss(
  queries: readonly NewsQuery[] = NEWS_QUERIES,
  now: Date = new Date()
): Promise<IngestRow[]> {
  const byUrl = new Map<string, IngestRow>()
  let ok = 0
  const errors: string[] = []
  for (const q of queries) {
    try {
      const res = await fetch(queryUrl(q), {
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(12000),
        redirect: 'follow',
      })
      if (!res.ok) {
        errors.push(`${q.q} -> ${res.status}`)
        continue
      }
      const xml = await res.text()
      if (!/<rss[\s>]/i.test(xml)) {
        errors.push(`${q.q} -> not RSS (${xml.length} bytes)`)
        continue
      }
      ok++
      for (const row of itemsToRows(parseRss(xml), q, now)) {
        if (!byUrl.has(row.url)) byUrl.set(row.url, row)
      }
    } catch (err) {
      errors.push(`${q.q} -> ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  // Every query failing is a real error (egress, markup). Zero announcements
  // with feeds fetching fine is just a quiet fortnight.
  if (ok === 0) throw new Error(`newsrss: every query failed — ${errors.slice(0, 3).join('; ')}`)
  return [...byUrl.values()]
}
