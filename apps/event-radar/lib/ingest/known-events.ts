import type { IngestRow } from './devpost'
import { fetchTierAExtraSeeds } from './known-events-tier-a-extra'

/**
 * Only seed near-term events with open/credible registration deadlines.
 * No invented next-year placeholders. No Africa/AU seeds (out of scope).
 */
export function fetchKnownEvents(): IngestRow[] {
  const now = Date.now()
  const horizon = now + 240 * 86400000 // ~8 months

  const rows: IngestRow[] = [
    {
      source: 'known',
      source_id: 'junction-2026-main',
      title: 'Junction 2026',
      url: 'https://www.hackjunction.com/',
      starts_at: '2026-11-13T08:00:00.000Z',
      ends_at: '2026-11-15T18:00:00.000Z',
      location_raw: 'Espoo, Finland',
      format: 'in_person',
      prize_pool: '100000+ EUR',
      registration_deadline: '2026-10-15T23:59:59.000Z',
      themes: ['general', 'hardware', 'ai'],
    },
    {
      source: 'known',
      source_id: 'hackmit-2026',
      title: 'HackMIT 2026',
      url: 'https://hackmit.org/',
      starts_at: '2026-09-19T12:00:00.000Z',
      ends_at: '2026-09-20T22:00:00.000Z',
      location_raw: 'Cambridge, MA, USA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-08-31T23:59:59.000Z',
      themes: ['student', 'general'],
    },
    {
      source: 'known',
      source_id: 'hack-the-north-2026',
      title: 'Hack the North 2026',
      url: 'https://hackthenorth.com/',
      starts_at: '2026-09-18T12:00:00.000Z',
      ends_at: '2026-09-20T22:00:00.000Z',
      location_raw: 'Waterloo, Canada',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-08-15T23:59:59.000Z',
      themes: ['student', 'general'],
    },
    {
      source: 'known',
      source_id: 'calhacks-2026',
      title: 'CalHacks',
      url: 'https://calhacks.io/',
      starts_at: '2026-10-24T17:00:00.000Z',
      ends_at: '2026-10-26T05:00:00.000Z',
      location_raw: 'San Francisco, CA, USA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-09-30T23:59:59.000Z',
      themes: ['student', 'general'],
    },
    ...fetchTierAExtraSeeds(),
  ]

  return rows.filter((r) => {
    if (!r.starts_at || !r.registration_deadline) return false
    const start = Date.parse(r.starts_at)
    const deadline = Date.parse(r.registration_deadline)
    if (!Number.isFinite(start) || !Number.isFinite(deadline)) return false
    // Must still be open to register and not too far out
    return deadline > now && start > now && start <= horizon
  })
}
