const DEFAULT_ADMIN_EMAIL = 'ign3107s@gmail.com'

export function isEventRadarAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmail = process.env.EVENT_RADAR_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL
  return email.trim().toLowerCase() === adminEmail.toLowerCase()
}
