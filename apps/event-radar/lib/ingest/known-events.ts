import type { IngestRow } from './devpost'
import { fetchTierAExtraSeeds } from './known-events-tier-a-extra'
import { fetchAfricaAuSeeds } from './known-events-africa-au'

/**
 * Only seed events with confirmed or near-term credible dates.
 * Do NOT invent next-year TreeHacks / PennApps rows — those stay
 * dormant until the travel-priority probe sees reg-open language.
 */
export function fetchKnownEvents(): IngestRow[] {
  const now = Date.now()
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
    // TreeHacks + PennApps: intentionally NOT seeded.
    // Last cycles: TreeHacks Feb 13–15 2026 (done), PennApps XXVI Sep 19–21 2025 (done).
    // Next cycle appears only after probe detects registration open.
    ...fetchTierAExtraSeeds(),
    ...fetchAfricaAuSeeds(),
  ]

  return rows.filter((r) => {
    if (!r.starts_at) return false
    return Date.parse(r.starts_at) > now
  })
}
