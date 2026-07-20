import type { IngestRow } from './devpost'

// Devfolio — only pull registration-open events (not "upcoming" pre-announce).
// India-located events are dropped (user not targeting India).

const API = 'https://api.devfolio.co/api/search/hackathons'
const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
// application_open only — "upcoming" is exactly the dormant pre-reg bucket
const TYPES = ['application_open'] as const

const INDIA = /\b(india|indian|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|kolkata|noida|gurgaon|gurugram)\b/i

type DevfolioSetting = {
  reg_ends_at?: string | null
} | null

type DevfolioSource = {
  uuid?: string | null
  slug?: string | null
  name?: string | null
  starts_at?: string | null
  ends_at?: string | null
  is_online?: boolean | null
  city?: string | null
  country?: string | null
  location?: string | null
  themes?: unknown
  hackathon_setting?: DevfolioSetting
}

type DevfolioHit = { _source?: DevfolioSource | null }

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null

function toISO(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseThemes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => (typeof t === 'string' ? t : str((t as { name?: unknown })?.name)))
    .filter((t): t is string => !!t)
}

function isIndiaRow(h: DevfolioSource, location: string | null): boolean {
  const country = str(h.country) ?? ''
  const city = str(h.city) ?? ''
  return INDIA.test(country) || INDIA.test(city) || INDIA.test(location ?? '')
}

export function parseDevfolioHits(hits: DevfolioHit[]): IngestRow[] {
  const rows: IngestRow[] = []
  for (const hit of hits) {
    const h = hit?._source
    if (!h) continue
    const slug = str(h.slug)
    const title = str(h.name)
    if (!slug || !title) continue

    const location =
      str(h.location) ?? ([str(h.city), str(h.country)].filter(Boolean).join(', ') || null)

    if (isIndiaRow(h, location)) continue

    rows.push({
      source: 'devfolio',
      source_id: str(h.uuid) ?? slug,
      title,
      url: `https://${slug}.devfolio.co`,
      starts_at: toISO(h.starts_at),
      ends_at: toISO(h.ends_at),
      location_raw: location,
      format: h.is_online === true ? 'online' : h.is_online === false ? 'in_person' : null,
      prize_pool: null,
      registration_deadline: toISO(h.hackathon_setting?.reg_ends_at),
      themes: parseThemes(h.themes),
    })
  }
  return rows
}

export async function fetchDevfolio(): Promise<IngestRow[]> {
  const seen = new Set<string>()
  const rows: IngestRow[] = []

  for (const type of TYPES) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ type, from: 0, size: 100 }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`devfolio ${type} -> ${res.status}`)
    const body = (await res.json()) as { hits?: { hits?: DevfolioHit[] } }
    for (const row of parseDevfolioHits(body.hits?.hits ?? [])) {
      if (seen.has(row.url)) continue
      seen.add(row.url)
      rows.push(row)
    }
  }

  return rows
}
