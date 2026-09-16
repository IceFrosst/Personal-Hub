import type { IngestRow } from './devpost'
import { COUNTRY_NAMES } from './hacktrack'

/**
 * Hackathon Hub (hackathonhub.eu) — curated directory of hackathons, challenges
 * and game jams across Europe, DACH-first, with English and German copy.
 *
 * Asked for by Ignas on 2026-09-16. Probed the same day: the `/events` page is
 * an app shell with a 45-row prerender and no server-side paging, and there is
 * no JSON API — but every event has a **Markdown twin** at
 * `/events/<slug>.md` with YAML front matter: title, date, end_date,
 * location ("City, CC"), format (onsite/online/hybrid), type
 * (hackathon/challenge/competition/gamejam), level, prize, tags, and `url`,
 * which is the organiser's registration link (luma.com, eventbrite.com, the
 * event's own site). `/sitemap-events.xml` lists all 509 event pages.
 *
 * So the source is: sitemap → keep slugs whose year suffix is this year or
 * later (a cheap pre-filter; the sitemap carries past editions back to 2024)
 * → fetch each `.md` (~1 KB) → keep type hackathon/gamejam, or anything whose
 * title says hackathon → future start.
 *
 * Two dedupe decisions:
 *   • Rows use the organiser's `url`, not the hackathonhub page. Dedupe is by
 *     URL alone (see CLAUDE.md), so this is what lets a Hub row converge on
 *     the Luma / Eventbrite row for the same event instead of doubling it.
 *   • Hub writes Luma links as `luma.com/<slug>`; our Luma source writes
 *     `lu.ma/<slug>`. Normalised to `lu.ma` here so they collide on purpose.
 *     Eventbrite TLDs (`.de` vs `.com`) are not normalised — the Eventbrite
 *     source keeps whatever TLD Eventbrite served, which we cannot predict.
 *
 * Date-only bounds get the same day-bounds treatment as Eventbrite: an
 * `end_date` at 00:00:00 is bumped to 23:59:59 so a two-day event reads as
 * multi-day and a one-day one does not.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const ORIGIN = 'https://hackathonhub.eu'
const SITEMAP = `${ORIGIN}/sitemap-events.xml`
const CONCURRENCY = 8
/** Hard ceiling on detail fetches per sweep — a runaway guard, not a coverage decision. */
export const MAX_DETAIL_FETCHES = 400

const HACK_RE = /\bhack|hackathon|hack[- ]?day|hack[- ]?night|game\s*jam|buildathon|hakaton|häkaton\b/i
const KEEP_TYPES = new Set(['hackathon', 'gamejam', 'game jam', 'game-jam'])

export type HubFrontMatter = {
  title: string | null
  date: string | null
  end_date: string | null
  location: string | null
  format: string | null
  type: string | null
  level: string | null
  prize: string | null
  tags: string | null
  url: string | null
  canonical: string | null
}

const unquote = (v: string): string =>
  v.trim().replace(/^"([\s\S]*)"$/, '$1').replace(/^'([\s\S]*)'$/, '$1').trim()

/** The YAML front matter is flat key: value lines — no nesting, no lists. */
export function parseFrontMatter(md: string): HubFrontMatter | null {
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(md)
  if (!m) return null
  const kv: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i <= 0) continue
    kv[line.slice(0, i).trim()] = unquote(line.slice(i + 1))
  }
  const get = (k: string): string | null => {
    const v = kv[k]
    return v && v !== 'N/A' && v !== 'null' ? v : null
  }
  return {
    title: get('title'),
    date: get('date'),
    end_date: get('end_date'),
    location: get('location'),
    format: get('format'),
    type: get('type'),
    level: get('level'),
    prize: get('prize'),
    tags: get('tags'),
    url: get('url'),
    canonical: get('canonical'),
  }
}

/** "Stubach, Salzburg, AT" → "Stubach, Salzburg, Austria" — names, because every downstream check is a substring test. */
export function expandLocation(loc: string | null): string | null {
  if (!loc) return null
  const parts = loc.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const last = parts[parts.length - 1]
  if (/^[A-Z]{2}$/.test(last)) parts[parts.length - 1] = COUNTRY_NAMES[last] ?? last
  return parts.join(', ')
}

/** Organiser URL as the row URL, normalised so it collides with our other sources. */
export function normaliseUrl(raw: string | null, canonical: string | null): string | null {
  const pick = raw ?? canonical
  if (!pick) return null
  try {
    const u = new URL(pick)
    if (/^(www\.)?luma\.com$/i.test(u.hostname)) u.hostname = 'lu.ma'
    u.hash = ''
    // Tracking noise only — keep real query strings (some organisers route on them).
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^ref$|^aff$/i.test(k)) u.searchParams.delete(k)
    return u.toString().replace(/\/$/, '') || null
  } catch {
    return null
  }
}

export function dayBounds(start: string | null, end: string | null): { starts_at: string | null; ends_at: string | null } {
  const toDate = (s: string | null): Date | null => {
    if (!s) return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = toDate(start)
  let e = toDate(end) ?? s
  if (s && e) {
    if (e.getTime() < s.getTime()) e = s
    // A midnight end on a date-only feed means "that whole day".
    if (e.getUTCHours() === 0 && e.getUTCMinutes() === 0 && e.getUTCSeconds() === 0) {
      e = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate(), 23, 59, 59))
    }
  }
  return { starts_at: s ? s.toISOString() : null, ends_at: e ? e.toISOString() : null }
}

function formatOf(f: string | null): IngestRow['format'] {
  const v = (f ?? '').toLowerCase()
  if (v === 'online' || v === 'virtual') return 'online'
  if (v === 'hybrid') return 'hybrid'
  if (v === 'onsite' || v === 'on-site' || v === 'in-person' || v === 'offline') return 'in_person'
  return null
}

export function isWanted(fm: HubFrontMatter): boolean {
  const type = (fm.type ?? '').toLowerCase()
  if (KEEP_TYPES.has(type)) return true
  return HACK_RE.test(fm.title ?? '')
}

export function frontMatterToRow(fm: HubFrontMatter, slug: string): IngestRow | null {
  if (!fm.title) return null
  const url = normaliseUrl(fm.url, fm.canonical)
  if (!url) return null
  const { starts_at, ends_at } = dayBounds(fm.date, fm.end_date)
  const format = formatOf(fm.format)
  const tags = (fm.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6)
  return {
    source: 'hackathonhub',
    source_id: slug,
    title: fm.title,
    url,
    starts_at,
    ends_at,
    location_raw: format === 'online' ? null : expandLocation(fm.location),
    format,
    prize_pool: fm.prize,
    themes: tags,
  }
}

export function slugsFromSitemap(xml: string): string[] {
  const out: string[] = []
  const re = /<loc>\s*https?:\/\/hackathonhub\.eu\/events\/([^<\s]+?)\s*<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1])
  return out
}

/** Slugs end in the edition year ("…-berlin-2026"); anything older than this year cannot be upcoming. */
export function candidateSlugs(slugs: string[], now: Date = new Date()): string[] {
  const year = now.getUTCFullYear()
  return slugs.filter((s) => {
    const m = /-(20\d{2})$/.exec(s)
    return !m || parseInt(m[1], 10) >= year
  })
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/markdown, text/plain, application/xml, */*' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function fetchHackathonHub(now: Date = new Date()): Promise<IngestRow[]> {
  const xml = await fetchText(SITEMAP, 12000)
  if (!xml) throw new Error('hackathonhub: sitemap-events.xml unreachable')
  const all = slugsFromSitemap(xml)
  if (all.length === 0) throw new Error(`hackathonhub: sitemap has no /events/ URLs (${xml.length} bytes) — moved?`)

  const slugs = candidateSlugs(all, now).slice(0, MAX_DETAIL_FETCHES)
  const rows: IngestRow[] = []
  let fetched = 0
  let next = 0
  const worker = async () => {
    while (next < slugs.length) {
      const slug = slugs[next++]
      const md = await fetchText(`${ORIGIN}/events/${slug}.md`, 10000)
      if (!md) continue
      fetched++
      const fm = parseFrontMatter(md)
      if (!fm || !isWanted(fm)) continue
      const row = frontMatterToRow(fm, slug)
      if (row) rows.push(row)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, slugs.length) }, worker))

  // The sitemap answered but not one detail page did: the .md twins moved.
  if (slugs.length > 0 && fetched === 0) {
    throw new Error(`hackathonhub: 0 of ${slugs.length} .md pages fetched — markdown twins gone?`)
  }

  const t = now.getTime()
  const byUrl = new Map<string, IngestRow>()
  for (const r of rows) {
    const start = r.starts_at ? Date.parse(r.starts_at) : NaN
    if (!Number.isFinite(start) || start <= t) continue
    if (!byUrl.has(r.url)) byUrl.set(r.url, r)
  }
  return [...byUrl.values()]
}
