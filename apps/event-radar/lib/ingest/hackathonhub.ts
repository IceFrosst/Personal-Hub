import type { IngestRow } from './devpost'
import { COUNTRY_NAMES } from './hacktrack'

/**
 * Hackathon Hub (hackathonhub.eu) — curated directory of hackathons, challenges
 * and game jams across Europe, DACH-first.
 *
 * Asked for by Ignas on 2026-09-16, with two rules the same day: **English
 * only** and **prize money only**.
 *
 * How it is read — and why not the HTML. The site is a Lovable-built React
 * shell over Supabase. Its `/events` page renders 45 rows and pages
 * client-side; the Markdown twins (`/events/<slug>.md`) carry dates and prize
 * but **not the language**, which only lives in the data the shell loads. That
 * data is the public PostgREST view `events_public`, read by every visitor's
 * browser with the anon key embedded in the site bundle (`assets/index-*.js`).
 * We read the same view the same way — one request, every field: exact
 * start/end instants, `application_deadline` (a real registration deadline,
 * which none of Luma/Eventbrite/HackTrack supply), `language`, `prize_money_eur`,
 * `location_type`, city/state/country, organiser `url`, and even
 * `travel_costs_covered` / `accommodation_provided` booleans (not yet carried —
 * see CLAUDE.md → Next).
 *
 * Same class of source as HackQuest (whose GraphQL operation was lifted from
 * its bundle): public data through the site's own public read path. The anon
 * key is theirs and can be rotated at any time; when that happens this source
 * throws with the HTTP status and the ingest summary shows it. Do not "fix" a
 * 401 by looking for another key — re-read the bundle constant `Nde` and
 * update `ANON_KEY`, or drop the source.
 *
 * Filters, in order: published · starts in the future · type hackathon/gamejam
 * or a hack-titled challenge · `language === 'en'` · a positive prize. On
 * 2026-09-16 that was 358 → 332 → 246 → 62 rows. The prize rule is the sharp
 * one: it leaves ~180 English European hackathons on the table. Ignas chose
 * it; the count is here so the trade is visible.
 *
 * Rows use the organiser's `url` (Luma links normalised `luma.com` → `lu.ma`)
 * so they merge with Luma/Eventbrite rows under the URL-only dedupe.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const SUPABASE_URL = 'https://czcrgiykicowicoufthv.supabase.co'
/** Public anon key from hackathonhub.eu's own bundle — RLS on their side gates what it can see. */
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6Y3JnaXlraWNvd2ljb3VmdGh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMTI5MTksImV4cCI6MjA3ODg4ODkxOX0.6t6d8obiFjsa_gTsQMn43_ACEC7VRRlC72l-IpFO6y0'
const VIEW = 'events_public'
const PAGE = 1000
export const MAX_PAGES = 5

const HACK_RE = /\bhack|hackathon|hack[- ]?day|hack[- ]?night|game\s*jam|buildathon|hakaton|häkaton\b/i
const KEEP_TYPES = new Set(['hackathon', 'gamejam'])

export type HubEvent = {
  id?: string
  slug?: string | null
  title?: string | null
  title_en?: string | null
  url?: string | null
  type?: string | null
  location_type?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  start_date?: string | null
  end_date?: string | null
  application_deadline?: string | null
  prize_money?: number | string | null
  prize_money_currency?: string | null
  prize_money_eur?: number | string | null
  language?: string | null
  tags?: unknown
  status?: string | null
  level?: string | null
}

const SELECT = [
  'id', 'slug', 'title', 'title_en', 'url', 'type', 'location_type', 'city', 'state', 'country',
  'start_date', 'end_date', 'application_deadline', 'prize_money', 'prize_money_currency',
  'prize_money_eur', 'language', 'tags', 'status', 'level',
].join(',')

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/** EUR-normalised amount when the Hub computed one, else the raw amount. Zero and null are "no prize". */
export function prizeEur(e: Pick<HubEvent, 'prize_money' | 'prize_money_eur'>): number | null {
  const eur = num(e.prize_money_eur)
  if (eur !== null && eur > 0) return eur
  const raw = num(e.prize_money)
  return raw !== null && raw > 0 ? raw : null
}

export function prizeLabel(
  e: Pick<HubEvent, 'prize_money' | 'prize_money_eur' | 'prize_money_currency'>
): string | null {
  const eur = num(e.prize_money_eur)
  if (eur !== null && eur > 0) return `€${Math.round(eur).toLocaleString('en-GB')}`
  const raw = num(e.prize_money)
  if (raw !== null && raw > 0)
    return `${Math.round(raw).toLocaleString('en-GB')} ${str(e.prize_money_currency) ?? ''}`.trim()
  return null
}

export function isHackathonShaped(e: Pick<HubEvent, 'type' | 'title' | 'title_en'>): boolean {
  if (KEEP_TYPES.has((e.type ?? '').toLowerCase())) return true
  return HACK_RE.test(e.title_en ?? e.title ?? '')
}

/** The Hub's `language` is a lower-case ISO code ('en', 'de', 'it'…, or 'mixed'). English means 'en', strictly. */
export function isEnglish(e: Pick<HubEvent, 'language'>): boolean {
  return (e.language ?? '').trim().toLowerCase() === 'en'
}

/** All of Ignas's rules plus the hackathon-shape test. */
export function isWanted(e: HubEvent): boolean {
  return isHackathonShaped(e) && isEnglish(e) && prizeEur(e) !== null
}

/** "Stubach", "Salzburg", "AT" → "Stubach, Salzburg, Austria" — names, because downstream checks are substring tests. */
export function placeOf(e: Pick<HubEvent, 'city' | 'state' | 'country'>): string | null {
  const country = str(e.country)
  const name = country ? (COUNTRY_NAMES[country.toUpperCase()] ?? country) : null
  const parts = [str(e.city), str(e.state), name].filter((p): p is string => !!p)
  // Drop a state that merely repeats the city ("Berlin, Berlin, Germany").
  const dedup = parts.filter((p, i) => i === 0 || p.toLowerCase() !== parts[i - 1].toLowerCase())
  return dedup.join(', ') || null
}

/** Organiser URL as the row URL, normalised so it collides with our other sources. */
export function normaliseUrl(raw: string | null | undefined, slug: string | null | undefined): string | null {
  const pick = str(raw) ?? (slug ? `https://hackathonhub.eu/events/${slug}` : null)
  if (!pick) return null
  try {
    const u = new URL(pick)
    if (/^(www\.)?luma\.com$/i.test(u.hostname)) u.hostname = 'lu.ma'
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^ref$|^aff$/i.test(k)) u.searchParams.delete(k)
    return u.toString().replace(/\/$/, '') || null
  } catch {
    return null
  }
}

/** Real instants from the view; a midnight end on a multi-day span means "that whole day". */
export function dayBounds(start: string | null | undefined, end: string | null | undefined) {
  const toDate = (s: string | null | undefined): Date | null => {
    if (!s) return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = toDate(start)
  let e = toDate(end) ?? s
  if (s && e) {
    if (e.getTime() < s.getTime()) e = s
    if (e.getUTCHours() === 0 && e.getUTCMinutes() === 0 && e.getUTCSeconds() === 0) {
      e = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59))
    }
  }
  return { starts_at: s ? s.toISOString() : null, ends_at: e ? e.toISOString() : null }
}

function formatOf(t: string | null | undefined): IngestRow['format'] {
  const v = (t ?? '').toLowerCase()
  if (v === 'online' || v === 'virtual' || v === 'remote') return 'online'
  if (v === 'hybrid') return 'hybrid'
  if (v === 'onsite' || v === 'on-site' || v === 'in-person' || v === 'offline') return 'in_person'
  return null
}

export function toRow(e: HubEvent): IngestRow | null {
  const title = str(e.title_en) ?? str(e.title)
  const url = normaliseUrl(e.url, e.slug)
  if (!title || !url) return null
  const { starts_at, ends_at } = dayBounds(e.start_date, e.end_date)
  // The Hub sometimes files an online event as onsite with city "Online" (seen:
  // BR41N.IO, country AT). The city word is the truer signal.
  const format = /^online$/i.test(e.city ?? '') ? 'online' : formatOf(e.location_type)
  const tags = Array.isArray(e.tags)
    ? e.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 6)
    : []
  const deadline = str(e.application_deadline)
  return {
    source: 'hackathonhub',
    source_id: str(e.slug) ?? str(e.id),
    title,
    url,
    starts_at,
    ends_at,
    location_raw: format === 'online' ? null : placeOf(e),
    format,
    prize_pool: prizeLabel(e),
    // The one aggregator that states it — rows go straight past the fail-closed gate.
    registration_deadline:
      deadline && !Number.isNaN(Date.parse(deadline)) ? new Date(deadline).toISOString() : null,
    themes: tags,
  }
}

export function selectRows(events: HubEvent[], now: Date = new Date()): IngestRow[] {
  const t = now.getTime()
  const byUrl = new Map<string, IngestRow>()
  for (const e of events) {
    if ((e.status ?? 'published') !== 'published') continue
    if (!isWanted(e)) continue
    const row = toRow(e)
    if (!row) continue
    const start = row.starts_at ? Date.parse(row.starts_at) : NaN
    if (!Number.isFinite(start) || start <= t) continue
    if (!byUrl.has(row.url)) byUrl.set(row.url, row)
  }
  return [...byUrl.values()]
}

export function queryUrl(now: Date, page: number): string {
  const p = new URLSearchParams({
    select: SELECT,
    status: 'eq.published',
    start_date: `gte.${now.toISOString()}`,
    order: 'start_date.asc',
    limit: String(PAGE),
    offset: String(page * PAGE),
  })
  return `${SUPABASE_URL}/rest/v1/${VIEW}?${p.toString()}`
}

export async function fetchHackathonHub(now: Date = new Date()): Promise<IngestRow[]> {
  const all: HubEvent[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    let res: Response
    try {
      res = await fetch(queryUrl(now, page), {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          Accept: 'application/json',
          'User-Agent': UA,
        },
        signal: AbortSignal.timeout(15000),
      })
    } catch (err) {
      throw new Error(`hackathonhub: fetch failed — ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!res.ok) {
      // 401/403 here almost certainly means the site rotated its anon key — see header.
      throw new Error(`hackathonhub: events_public -> ${res.status}`)
    }
    const body = (await res.json()) as unknown
    if (!Array.isArray(body)) throw new Error('hackathonhub: response is not an array — view shape drifted?')
    all.push(...(body as HubEvent[]))
    if (body.length < PAGE) break
  }
  // Upcoming published events are never zero on a live directory of this size.
  if (all.length === 0) throw new Error('hackathonhub: 0 upcoming published events — filter or view drifted?')
  return selectRows(all, now)
}
