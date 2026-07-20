import type { IngestRow } from './devpost'

/** Near-term Tier A only — no speculative 2027 placeholders. */
export function fetchTierAExtraSeeds(): IngestRow[] {
  const now = Date.now()
  const rows: IngestRow[] = [
    {
      source: 'known',
      source_id: 'technica-2026',
      title: 'Technica',
      url: 'https://gotechnica.org/',
      starts_at: '2026-11-07T14:00:00.000Z',
      ends_at: '2026-11-08T22:00:00.000Z',
      location_raw: 'College Park, MD, USA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-10-15T23:59:59.000Z',
      themes: ['student', 'women', 'diversity'],
    },
    {
      source: 'known',
      source_id: 'bigredhacks-2026',
      title: 'BigRed//Hacks 2026',
      url: 'https://www.bigredhacks.com/',
      starts_at: '2026-10-02T14:00:00.000Z',
      ends_at: '2026-10-04T22:00:00.000Z',
      location_raw: 'Ithaca, NY, USA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-09-15T23:59:59.000Z',
      themes: ['student', 'general'],
    },
    {
      source: 'known',
      source_id: 'hacksc-2026',
      title: 'HackSC',
      url: 'https://hacksc.com/',
      starts_at: '2026-11-14T17:00:00.000Z',
      ends_at: '2026-11-16T05:00:00.000Z',
      location_raw: 'Los Angeles, CA, USA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-10-20T23:59:59.000Z',
      themes: ['student', 'general'],
    },
    {
      source: 'known',
      source_id: 'hackrice-2026',
      title: 'HackRice 16',
      url: 'https://hackrice.com/',
      starts_at: '2026-09-11T17:00:00.000Z',
      ends_at: '2026-09-13T22:00:00.000Z',
      location_raw: 'Houston, TX, USA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-08-20T23:59:59.000Z',
      themes: ['student', 'general'],
    },
  ]
  return rows.filter(
    (r) =>
      r.starts_at &&
      r.registration_deadline &&
      Date.parse(r.starts_at) > now &&
      Date.parse(r.registration_deadline) > now
  )
}
