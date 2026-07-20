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

/** Stored in user_preferences.notification_settings JSON (no migration). */
export type NotificationSettings = {
  enabled: boolean
  min_score: number
  /** ISO-ish country name fragment, e.g. "lithuania", "poland". Empty = none. */
  priority_country: string
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  min_score: 60,
  priority_country: 'lithuania',
}

/** Common priority-country choices for the settings UI. */
export const PRIORITY_COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'None' },
  { value: 'lithuania', label: 'Lithuania' },
  { value: 'latvia', label: 'Latvia' },
  { value: 'estonia', label: 'Estonia' },
  { value: 'poland', label: 'Poland' },
  { value: 'finland', label: 'Finland' },
  { value: 'germany', label: 'Germany' },
  { value: 'sweden', label: 'Sweden' },
  { value: 'denmark', label: 'Denmark' },
  { value: 'netherlands', label: 'Netherlands' },
  { value: 'spain', label: 'Spain' },
  { value: 'france', label: 'France' },
  { value: 'united kingdom', label: 'United Kingdom' },
  { value: 'united states', label: 'United States' },
  { value: 'canada', label: 'Canada' },
]

export function coerceNotificationSettings(raw: unknown): NotificationSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULT_NOTIFICATION_SETTINGS.enabled,
    min_score:
      typeof o.min_score === 'number' && Number.isFinite(o.min_score)
        ? o.min_score
        : DEFAULT_NOTIFICATION_SETTINGS.min_score,
    priority_country:
      typeof o.priority_country === 'string'
        ? o.priority_country.toLowerCase().trim()
        : DEFAULT_NOTIFICATION_SETTINGS.priority_country,
  }
}
