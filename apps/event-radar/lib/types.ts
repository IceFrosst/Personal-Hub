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

export type NotificationSettings = {
  enabled: boolean
  min_score: number
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  min_score: 60,
}
