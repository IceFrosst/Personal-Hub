// Devpost's public (undocumented but stable) JSON API. No auth needed.
// https://devpost.com/api/hackathons?page=N&status[]=upcoming&status[]=open

export type IngestRow = {
  source: string
  source_id: string | null
  title: string
  url: string
  starts_at: string | null
  ends_at: string | null
  location_raw: string | null
  format: 'online' | 'in_person' | 'hybrid' | null
  prize_pool: string | null
  themes: string[]
}

const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

// Devpost date ranges look like "Jul 10 - Aug 20, 2026" or
// "Aug 05 - 07, 2026" or "Sep 01, 2026". Returns [startISO, endISO].
export function parseDevpostDates(raw: string | null): [string | null, string | null] {
  if (!raw) return [null, null]
  const yearMatch = raw.match(/(\d{4})/)
  if (!yearMatch) return [null, null]
  const year = parseInt(yearMatch[1], 10)

  const parts = raw.split('-').map((p) => p.trim())
  const parsePart = (part: string, fallbackMonth: number | null): [number | null, number | null] => {
    const m = part.toLowerCase().match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})/)
    if (m && MONTHS[m[1]] !== undefined) return [MONTHS[m[1]], parseInt(m[2], 10)]
    const dayOnly = part.match(/^(\d{1,2})/)
    if (dayOnly && fallbackMonth !== null) return [fallbackMonth, parseInt(dayOnly[1], 10)]
    return [null, null]
  }

  const [m1, d1] = parsePart(parts[0], null)
  const [m2, d2] = parts.length > 1 ? parsePart(parts[1], m1) : [m1, d1]

  const toISO = (m: number | null, d: number | null) =>
    m !== null && d !== null ? new Date(Date.UTC(year, m, d)).toISOString() : null

  return [toISO(m1, d1), toISO(m2, d2)]
}

function stripTags(html: string | null): string | null {
  if (!html) return null
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || null
}

type DevpostApiHackathon = {
  id: number
  title: string
  url: string
  submission_period_dates: string | null
  themes: { name: string }[] | null
  prize_amount: string | null
  displayed_location: { location: string } | null
  open_state: string | null
}

export async function fetchDevpost(pages = 3): Promise<IngestRow[]> {
  const rows: IngestRow[] = []

  for (let page = 1; page <= pages; page++) {
    const url = `https://devpost.com/api/hackathons?page=${page}&status[]=upcoming&status[]=open`
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`devpost page ${page} -> ${res.status}`)
    const body = (await res.json()) as { hackathons?: DevpostApiHackathon[] }
    const items = body.hackathons ?? []
    if (items.length === 0) break

    for (const h of items) {
      if (!h.url || !h.title) continue
      const location = h.displayed_location?.location ?? null
      const [starts, ends] = parseDevpostDates(h.submission_period_dates)
      rows.push({
        source: 'devpost',
        source_id: String(h.id),
        title: h.title.trim(),
        url: h.url,
        starts_at: starts,
        ends_at: ends,
        location_raw: location,
        format: location && /online/i.test(location) ? 'online' : null,
        prize_pool: stripTags(h.prize_amount),
        themes: (h.themes ?? []).map((t) => t.name).filter(Boolean),
      })
    }
  }

  return rows
}
