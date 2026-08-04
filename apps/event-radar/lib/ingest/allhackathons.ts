import type { IngestRow } from './devpost'

/**
 * allhackathons.com — server-rendered international hackathon listing.
 *
 * Picked after an open-egress probe (2026-07-26) knocked out the alternatives:
 * dev.events answers a Cloudflare interstitial (403) even from a GitHub runner,
 * and hackathon.com returns "no upcoming hackathons" for every country tried,
 * Turkey and Germany included. This one is plain Bootstrap HTML with no JS
 * shell, so a fetch actually sees the events.
 *
 * It is a GENERAL source, not a Turkey fix. The Turkish subdomain
 * (tr.allhackathons.com) exists and does carry real TR events, but every one of
 * them is past — Scrapyard İstanbul (Mar 2025), İGA Social Hack (Mar 2020),
 * Turkish Airlines Travel Hackathon (Dec 2017). Nothing upcoming to ingest, so
 * only the main domain is fetched; the country field carries Turkey when a
 * Turkish edition eventually appears.
 *
 * No registration deadline anywhere in the listing, so rows arrive with
 * `registration_deadline: null` and stay invisible to the fail-closed feed
 * until enrichment reads one off the event's own page. That is deliberate —
 * unlike Luma (whose RSVPs genuinely stay open until the event starts, hence
 * its documented exception), these are third-party events whose deadlines are
 * real and unknown, so claiming "open" would be a guess.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const LIST_URL = 'https://allhackathons.com/hackathons/'
/**
 * Ceiling only — the crawl stops when a page no longer advertises the next one,
 * so this never forces extra requests. It was 5; raised for the same reason
 * DoraHacks' was, so the site's own pager decides where the list ends rather
 * than a number we picked before knowing how long the list is.
 */
const MAX_PAGES = 30

/**
 * Django's `N` date filter — AP style, so the long months are spelled out and
 * carry no trailing period while the short ones are abbreviated with one.
 */
const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  aug: 7,
  sept: 8,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "Sept. 12, 2026" → UTC ISO. Returns null on anything unexpected. */
export function parseListDate(raw: string, endOfDay = false): string | null {
  const m = /^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})$/.exec(raw.trim())
  if (!m) return null
  const month = MONTHS[m[1].toLowerCase()]
  if (month === undefined) return null
  const day = Number(m[2])
  const year = Number(m[3])
  if (!Number.isFinite(day) || day < 1 || day > 31) return null
  const d = new Date(
    Date.UTC(year, month, day, endOfDay ? 23 : 8, endOfDay ? 59 : 0, endOfDay ? 59 : 0)
  )
  // Date.UTC rolls overflow forward (Feb 31 → Mar 3); reject rather than invent.
  if (d.getUTCMonth() !== month || d.getUTCDate() !== day) return null
  return d.toISOString()
}

function mapFormat(badge: string): IngestRow['format'] {
  const b = badge.toLowerCase()
  if (b.includes('online')) return 'online'
  if (b.includes('hybrid')) return 'hybrid'
  // 'IN-PERSON' (en) / 'YÜZ YÜZE' (tr)
  if (b.includes('person') || b.includes('yüz')) return 'in_person'
  return null
}

/**
 * Each listing card is a `<div class="row align-items-center bg-white …">`
 * block introduced by an `<!-- Job -->` comment (the theme this site is built
 * on was a job board). Splitting on the comment is more robust than trying to
 * balance nested divs with a regex.
 */
export function parseAllHackathonsList(html: string): IngestRow[] {
  const rows: IngestRow[] = []
  const blocks = html.split(/<!--\s*Job\s*-->/i).slice(1)

  for (const block of blocks) {
    const link = /<a\s+href="\/hackathon\/([^"]+?)\/?"\s+class="h5[^"]*"\s*>([\s\S]*?)<\/a>/i.exec(
      block
    )
    if (!link) continue
    const slug = link[1]
    const title = stripTags(link[2])
    if (!title) continue

    // Everything below the title anchor: dates <p>, status <div>, blurb <p>.
    const rest = block.slice(link.index + link[0].length)
    const dateText = /<p>([^<]+)<\/p>/i.exec(rest)?.[1] ?? ''
    const [startRaw, endRaw] = dateText.split(/\s+-\s+/).map((s) => s.trim())

    const starts_at = startRaw ? parseListDate(startRaw) : null
    // Single-day events render one date; treat it as both ends.
    const ends_at = endRaw ? parseListDate(endRaw, true) : parseListDate(startRaw ?? '', true)

    const badge = /<span class="badge[^"]*"\s*>\s*([^<]+?)\s*<\/span>/i.exec(block)?.[1] ?? ''

    // The themes footer ends with a bare country name after the theme links:
    //   <a href="/themes/ai/">ai </a> · … · Germany
    const themeBlock = /<div class="font-size-sm[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1]
    let country: string | null = null
    const themes: string[] = []
    if (themeBlock) {
      for (const t of themeBlock.matchAll(/\/themes\/([^/"]+)\//g)) themes.push(t[1])
      const tail = themeBlock.replace(/<a[\s\S]*<\/a>/i, '')
      // Whatever separator markup survives, the country is the tail text.
      const cleaned = stripTags(tail)
        .replace(/^[·•|,\s]+/, '')
        .trim()
      if (cleaned && cleaned.length < 60) country = cleaned
    }

    rows.push({
      source: 'allhackathons',
      source_id: slug,
      title,
      url: `https://allhackathons.com/hackathon/${slug}/`,
      starts_at,
      ends_at,
      location_raw: country,
      format: mapFormat(badge),
      prize_pool: null,
      themes,
    })
  }

  return rows
}

async function fetchPage(page: number): Promise<{ ok: boolean; status: number; html: string }> {
  const url = page === 1 ? LIST_URL : `${LIST_URL}?page=${page}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  })
  return { ok: res.ok, status: res.status, html: await res.text() }
}

export async function fetchAllHackathons(): Promise<IngestRow[]> {
  const first = await fetchPage(1)
  if (!first.ok) throw new Error(`allhackathons -> ${first.status}`)

  const seen = new Set<string>()
  const rows: IngestRow[] = []
  const collect = (batch: IngestRow[]) => {
    for (const row of batch) {
      if (seen.has(row.url)) continue
      seen.add(row.url)
      rows.push(row)
    }
  }

  const firstBatch = parseAllHackathonsList(first.html)
  if (firstBatch.length === 0) {
    // Fetched fine but produced nothing — that is markup drift, not an empty
    // site. Say where it broke instead of quietly contributing zero rows.
    throw new Error(
      `allhackathons: 0 cards parsed from ${first.html.length}b ` +
        `(job-blocks=${first.html.split(/<!--\s*Job\s*-->/i).length - 1}, ` +
        `hackathon-links=${(first.html.match(/\/hackathon\//g) ?? []).length})`
    )
  }
  collect(firstBatch)

  // Walk forward only while the page we just read advertises the next one —
  // checking page 1's markup for a "?page=4" link would stop the crawl early,
  // since the pager only ever shows a couple of steps ahead.
  let previousHtml = first.html
  for (let page = 2; page <= MAX_PAGES; page++) {
    if (!new RegExp(`\\?page=${page}"`).test(previousHtml)) break
    let next: Awaited<ReturnType<typeof fetchPage>>
    try {
      next = await fetchPage(page)
    } catch {
      break
    }
    if (!next.ok) break
    const batch = parseAllHackathonsList(next.html)
    if (batch.length === 0) break
    collect(batch)
    previousHtml = next.html
  }

  // Past events are the bulk of the archive — drop them here so the catalog
  // is not flooded, same as fetchMlh does with its 250+ past events.
  const now = Date.now()
  return rows.filter((r) => {
    const start = r.starts_at ? Date.parse(r.starts_at) : NaN
    return Number.isFinite(start) && start > now
  })
}
