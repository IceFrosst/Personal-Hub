import type { IngestRow } from './devpost'
import { fetchTierAExtraSeeds } from './known-events-tier-a-extra'
import { fetchAfricaAuSeeds } from './known-events-africa-au'

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
      source_id: 'treehacks-2027',
      title: 'TreeHacks 2027',
      url: 'https://treehacks.com/',
      starts_at: '2027-02-13T17:00:00.000Z',
      ends_at: '2027-02-15T05:00:00.000Z',
      location_raw: 'Stanford, CA, USA',
      format: 'in_person',
      prize_pool: '150000+ USD',
      registration_deadline: '2027-01-15T23:59:59.000Z',
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
    ...fetchAfricaAuSeeds(),
  ]

  return rows.filter((r) => {
    if (!r.starts_at) return true
    return Date.parse(r.starts_at) > now
  })
}
