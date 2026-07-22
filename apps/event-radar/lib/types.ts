import { decodeTravelPolicyFromThemes } from './travel-policy-store'

export type HackathonFormat = 'online' | 'in_person' | 'hybrid'

/** Who the travel stipend/reimbursement is aimed at. */
export type TravelScope =
  | 'none'
  | 'domestic'
  | 'regional'
  | 'international'
  | 'selective'
  | 'global'

export type Hackathon = {
  id: string
  source: string
  source_id: string | null
  title: string
  url: string
  starts_at: string | null
  ends_at: string | null
  registration_deadline: string | null
  format: HackathonFormat | null
  city: string | null
  country: string | null
  location_raw: string | null
  prize_pool: string | null
  travel_covered: boolean | null
  /** Structured travel policy — from columns (0003) or themes tokens. */
  travel_scope: TravelScope | null
  travel_regions: string[]
  travel_cap: string | null
  travel_notes: string | null
  accommodation_covered: boolean | null
  open_to_business_students: boolean | null
  themes: string[]
  raw_description: string | null
  enriched_at: string | null
  notified_at: string | null
  last_seen_at: string
  created_at: string
}

export type UserStatus = 'interested' | 'applying' | 'applied' | 'hidden'

export type UserHackathonStatus = {
  user_id: string
  hackathon_id: string
  status: UserStatus
  notes: string | null
  updated_at: string
}

/**
 * Screenshot deals from LT (Jul 2026) treated as return-capable under ~70€.
 * All listed countries are available in Settings; defaults include the full set.
 */
export const CHEAP_FROM_LT_COUNTRIES: Array<{ value: string; label: string; note?: string }> = [
  { value: 'lithuania', label: 'Lithuania', note: 'Home' },
  { value: 'latvia', label: 'Latvia', note: 'Bus/train' },
  { value: 'estonia', label: 'Estonia', note: 'Flight / bus' },
  { value: 'finland', label: 'Finland', note: 'Screenshot deal' },
  { value: 'norway', label: 'Norway', note: 'Screenshot deal' },
  { value: 'poland', label: 'Poland', note: 'Screenshot deal' },
  { value: 'denmark', label: 'Denmark', note: 'Screenshot deal' },
  { value: 'sweden', label: 'Sweden', note: 'Screenshot deal' },
  { value: 'italy', label: 'Italy', note: 'Screenshot deal' },
  { value: 'czechia', label: 'Czechia', note: 'Screenshot deal' },
  { value: 'czech', label: 'Czech Republic', note: 'alias' },
  { value: 'netherlands', label: 'Netherlands', note: 'Screenshot deal' },
  { value: 'united kingdom', label: 'United Kingdom', note: 'Screenshot deal' },
  { value: 'germany', label: 'Germany', note: 'Screenshot deal' },
  { value: 'belgium', label: 'Belgium', note: 'Screenshot deal' },
  { value: 'hungary', label: 'Hungary', note: 'Screenshot deal' },
  { value: 'georgia', label: 'Georgia', note: 'Screenshot deal' },
  { value: 'austria', label: 'Austria', note: 'Screenshot deal' },
]

/** Full screenshot set + Baltics — user confirmed RT deals. */
export const DEFAULT_PRIORITY_COUNTRIES = [
  'lithuania',
  'latvia',
  'estonia',
  'finland',
  'norway',
  'poland',
  'denmark',
  'sweden',
  'italy',
  'czechia',
  'netherlands',
  'united kingdom',
  'germany',
  'belgium',
  'hungary',
  'georgia',
  'austria',
]

export const DEFAULT_HOME_BASE = 'lithuania'

export type NotificationSettings = {
  enabled: boolean
  min_score: number
  priority_countries: string[]
  /** Country the user is based in — drives travel-for-me scoring. */
  home_base: string
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  min_score: 60,
  priority_countries: DEFAULT_PRIORITY_COUNTRIES,
  home_base: DEFAULT_HOME_BASE,
}

export function coerceNotificationSettings(raw: unknown): NotificationSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  let countries: string[] = DEFAULT_PRIORITY_COUNTRIES
  if (Array.isArray(o.priority_countries)) {
    countries = o.priority_countries
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
      .map((c) => c.toLowerCase().trim())
  } else if (typeof o.priority_country === 'string' && o.priority_country.trim()) {
    countries = [o.priority_country.toLowerCase().trim()]
  }

  let home_base = DEFAULT_HOME_BASE
  if (typeof o.home_base === 'string' && o.home_base.trim()) {
    home_base = o.home_base.toLowerCase().trim()
    if (home_base === 'czech' || home_base === 'czech republic') home_base = 'czechia'
  }

  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_NOTIFICATION_SETTINGS.enabled,
    min_score:
      typeof o.min_score === 'number' && Number.isFinite(o.min_score)
        ? o.min_score
        : DEFAULT_NOTIFICATION_SETTINGS.min_score,
    priority_countries: countries,
    home_base,
  }
}

/** Coerce DB row into a full Hackathon (columns or themes-encoded policy). */
export function coerceHackathon(row: Record<string, unknown>): Hackathon {
  const themes = Array.isArray(row.themes)
    ? row.themes.filter((t): t is string => typeof t === 'string')
    : []

  const fromThemes = decodeTravelPolicyFromThemes(themes)

  const scopeRaw = typeof row.travel_scope === 'string' ? row.travel_scope : null
  const scopeOk =
    scopeRaw === 'none' ||
    scopeRaw === 'domestic' ||
    scopeRaw === 'regional' ||
    scopeRaw === 'international' ||
    scopeRaw === 'selective' ||
    scopeRaw === 'global'
      ? scopeRaw
      : null

  let regions: string[] = []
  if (Array.isArray(row.travel_regions)) {
    regions = row.travel_regions.filter((r): r is string => typeof r === 'string')
  }

  const travel_scope = scopeOk ?? fromThemes.travel_scope
  const travel_regions = regions.length > 0 ? regions : fromThemes.travel_regions
  const travel_cap =
    row.travel_cap == null || row.travel_cap === ''
      ? fromThemes.travel_cap
      : String(row.travel_cap)
  const travel_notes =
    row.travel_notes == null || row.travel_notes === ''
      ? fromThemes.travel_notes
      : String(row.travel_notes)

  return {
    id: String(row.id),
    source: String(row.source ?? ''),
    source_id: row.source_id == null ? null : String(row.source_id),
    title: String(row.title ?? ''),
    url: String(row.url ?? ''),
    starts_at: row.starts_at == null ? null : String(row.starts_at),
    ends_at: row.ends_at == null ? null : String(row.ends_at),
    registration_deadline:
      row.registration_deadline == null ? null : String(row.registration_deadline),
    format:
      row.format === 'online' || row.format === 'in_person' || row.format === 'hybrid'
        ? row.format
        : null,
    city: row.city == null ? null : String(row.city),
    country: row.country == null ? null : String(row.country),
    location_raw: row.location_raw == null ? null : String(row.location_raw),
    prize_pool: row.prize_pool == null ? null : String(row.prize_pool),
    travel_covered: typeof row.travel_covered === 'boolean' ? row.travel_covered : null,
    travel_scope,
    travel_regions,
    travel_cap,
    travel_notes,
    accommodation_covered:
      typeof row.accommodation_covered === 'boolean' ? row.accommodation_covered : null,
    open_to_business_students:
      typeof row.open_to_business_students === 'boolean' ? row.open_to_business_students : null,
    themes,
    raw_description: row.raw_description == null ? null : String(row.raw_description),
    enriched_at: row.enriched_at == null ? null : String(row.enriched_at),
    notified_at: row.notified_at == null ? null : String(row.notified_at),
    last_seen_at: String(row.last_seen_at ?? new Date().toISOString()),
    created_at: String(row.created_at ?? new Date().toISOString()),
  }
}
