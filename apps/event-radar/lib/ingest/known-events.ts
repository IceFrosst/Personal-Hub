import type { IngestRow } from './devpost'
import { fetchTierAExtraSeeds } from './known-events-tier-a-extra'
import promotedFromDormant from './promoted-from-dormant.json'

/**
 * Only seed near-term events with open/credible registration deadlines.
 * TreeHacks / PennApps stay in dormant-tier-a until promoted.
 */
export function fetchKnownEvents(): IngestRow[] {
  const now = Date.now()
  const horizon = now + 240 * 86400000

  const promoted: IngestRow[] = (promotedFromDormant as Array<Record<string, unknown>>)
    .filter((p) => p.registration_deadline && p.starts_at)
    .map((p) => ({
      source: 'known' as const,
      source_id: String(p.id),
      title: String(p.label ?? p.id),
      url: String(p.siteUrl ?? 'https://example.com'),
      starts_at: String(p.starts_at),
      ends_at: p.ends_at ? String(p.ends_at) : null,
      location_raw: p.location_raw ? String(p.location_raw) : null,
      format: (p.format as 'in_person' | 'online' | 'hybrid' | null) ?? 'in_person',
      prize_pool: null,
      registration_deadline: String(p.registration_deadline),
      themes: ['promoted-from-dormant'],
    }))

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
    {
      source: 'known',
      source_id: 'hackyeah-2026',
      title: 'HackYeah 2026',
      url: 'https://hackyeah.pl/',
      starts_at: '2026-10-03T07:00:00.000Z',
      ends_at: '2026-10-04T16:00:00.000Z',
      location_raw: 'Kraków, Poland',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-09-25T21:59:59.000Z',
      themes: ['poland', 'europe', 'student'],
    },
    {
      source: 'known',
      source_id: 'hack4vilnius-2026',
      title: 'Hack4Vilnius 2026',
      url: 'https://hack4vilnius.lt/',
      starts_at: '2026-10-09T07:00:00.000Z',
      ends_at: '2026-10-11T16:00:00.000Z',
      location_raw: 'Vilnius, Lithuania',
      format: 'in_person',
      prize_pool: null,
      // Reg opens ~2026-08-24 (site countdown); close approx few days before event
      registration_deadline: '2026-10-07T20:59:59.000Z',
      themes: ['lithuania', 'baltic', 'city', 'vilnius'],
    },
    ...fetchTierAExtraSeeds(),
    ...promoted,
  ]

  return rows.filter((r) => {
    if (!r.starts_at || !r.registration_deadline) return false
    const start = Date.parse(r.starts_at)
    const deadline = Date.parse(r.registration_deadline)
    if (!Number.isFinite(start) || !Number.isFinite(deadline)) return false
    return deadline > now && start > now && start <= horizon
  })
}
