import type { IngestRow } from './devpost'

// Devfolio — one of the largest hackathon platforms (global, India-heavy, plenty
// of in-person events). Its web app calls an undocumented-but-stable Elasticsearch
// proxy: POST https://api.devfolio.co/api/search/hackathons with a `type`. Only
// forward-looking buckets are useful to the radar:
//   - "application_open" — registration is live right now (the actionable set)
//   - "upcoming"         — announced, registration not open yet
// ("past" also exists — 1600+ ended events — deliberately never fetched.)
// Each hit carries exact start/end plus a `hackathon_setting.reg_ends_at`
// registration deadline, so these rows satisfy the fail-closed eligibility rule
// without waiting on enrichment.

const API = 'https://api.devfolio.co/api/search/hackathons'
const UA = 'Mozilla/5.0 (compatible; EventRadar/1.0; personal hackathon tracker)'
const TYPES = ['application_open', 'upcoming'] as const

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

// Themes arrive as [] in most payloads, but tolerate both a string list and a
// {name} object list in case the shape firms up later.
function parseThemes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => (typeof t === 'string' ? t : str((t as { name?: unknown })?.name)))
    .filter((t): t is string => !!t)
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

    rows.push({
      source: 'devfolio',
      source_id: str(h.uuid) ?? slug,
      title,
      // Every Devfolio hackathon lives on its own <slug>.devfolio.co subdomain.
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
      // The same hackathon can surface in both buckets around the reg-open flip.
      if (seen.has(row.url)) continue
      seen.add(row.url)
      rows.push(row)
    }
  }

  return rows
}
