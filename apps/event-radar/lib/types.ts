export type HackathonFormat = 'online' | 'in_person' | 'hybrid'

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
 * Countries reachable from Lithuania on a typical budget airline deal
 * (screenshot-based, ~Jul 2026) with estimated RT under ~70 EUR, plus
 * home + Baltic neighbours (bus/train often cheaper than flights).
 */
export const CHEAP_FROM_LT_COUNTRIES: Array<{ value: string; label: string; note?: string }> = [
  { value: 'lithuania', label: 'Lithuania', note: 'Home' },
  { value: 'latvia', label: 'Latvia', note: 'Bus/train' },
  { value: 'estonia', label: 'Estonia', note: '~36€ flight / bus' },
  { value: 'finland', label: 'Finland', note: '~25€ OW' },
  { value: 'norway', label: 'Norway', note: '~26€ OW' },
  { value: 'poland', label: 'Poland', note: '~29€ OW' },
  { value: 'denmark', label: 'Denmark', note: '~30€ OW' },
  { value: 'sweden', label: 'Sweden', note: '~30€ OW' },
  { value: 'italy', label: 'Italy', note: '~30€ OW' },
  { value: 'czechia', label: 'Czechia', note: '~35€ OW' },
  { value: 'czech', label: 'Czech Republic', note: 'alias' },
  { value: 'netherlands', label: 'Netherlands', note: '~36€ OW — borderline 70€ RT' },
  // Optional / slightly over 70€ RT — available to toggle on
  { value: 'united kingdom', label: 'United Kingdom', note: '~37€ OW' },
  { value: 'germany', label: 'Germany', note: '~39€ OW' },
  { value: 'belgium', label: 'Belgium', note: '~44€ OW' },
  { value: 'hungary', label: 'Hungary', note: '~47€ OW' },
  { value: 'georgia', label: 'Georgia', note: '~50€ OW' },
  { value: 'austria', label: 'Austria', note: '~56€ OW' },
]

/** Default priority set: clear under-~70€ RT + Baltics. */
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
]

/** Stored in user_preferences.notification_settings JSON (no migration). */
export type NotificationSettings = {
  enabled: boolean
  min_score: number
  /**
   * Countries that get the priority-country score boost.
   * Legacy `priority_country` (string) is migrated in coerceNotificationSettings.
   */
  priority_countries: string[]
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  min_score: 60,
  priority_countries: DEFAULT_PRIORITY_COUNTRIES,
}

export function coerceNotificationSettings(raw: unknown): NotificationSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  let countries: string[] = DEFAULT_PRIORITY_COUNTRIES
  if (Array.isArray(o.priority_countries)) {
    countries = o.priority_countries
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
      .map((c) => c.toLowerCase().trim())
  } else if (typeof o.priority_country === 'string' && o.priority_country.trim()) {
    // Migrate old single-country setting
    countries = [o.priority_country.toLowerCase().trim()]
  }

  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_NOTIFICATION_SETTINGS.enabled,
    min_score:
      typeof o.min_score === 'number' && Number.isFinite(o.min_score)
        ? o.min_score
        : DEFAULT_NOTIFICATION_SETTINGS.min_score,
    priority_countries: countries,
  }
}
