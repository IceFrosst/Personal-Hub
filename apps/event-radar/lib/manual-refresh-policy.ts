import { isEventRadarAdmin } from './owner'

export type ManualRefreshRejection = {
  error: 'unauthorized' | 'forbidden' | 'invalid_action' | 'refresh_in_progress'
  status: 401 | 403 | 409
}

export function manualRefreshRejection({
  signedIn,
  email,
  action,
  refreshInFlight,
}: {
  signedIn: boolean
  email: string | null | undefined
  action: string | null
  refreshInFlight: boolean
}): ManualRefreshRejection | null {
  if (!signedIn) return { error: 'unauthorized', status: 401 }
  if (!isEventRadarAdmin(email)) return { error: 'forbidden', status: 403 }
  if (action !== 'refresh-sources') return { error: 'invalid_action', status: 403 }
  if (refreshInFlight) return { error: 'refresh_in_progress', status: 409 }
  return null
}
