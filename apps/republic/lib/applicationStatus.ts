export type ApplicationDecisionStatus = 'pending' | 'approved' | 'denied'

export interface ApplicationStatus {
  status: ApplicationDecisionStatus
  decidedAt: string | null
}

/** Strip display punctuation and normalize the handle exactly as the lookup RPC does. */
export function normalizeInstagramHandle(value: string): string {
  return value.trim().replace(/^@+/, '').trim().toLowerCase()
}

/** Parse only the narrow status payload returned by lookup_application_status. */
export function parseApplicationStatus(value: unknown): ApplicationStatus | null {
  const row = Array.isArray(value) ? value[0] : value
  if (typeof row !== 'object' || row === null) return null
  const candidate = row as Record<string, unknown>
  const status = candidate.status
  if (status !== 'pending' && status !== 'approved' && status !== 'denied') return null
  const decidedAt = candidate.decided_at
  if (decidedAt !== null && typeof decidedAt !== 'string') return null
  return { status, decidedAt: decidedAt ?? null }
}
