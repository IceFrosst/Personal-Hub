import type { IngestRow } from './devpost'

/** Extra Tier A seeds from 2026-07-19 research batch */
export function fetchTierAExtraSeeds(): IngestRow[] {
  const now = Date.now()
  const rows: IngestRow[] = [
    {
      source: 'known',
      source_id: 'yhack-2027',
      title: 'YHack',
      url: 'https://yhack.org/',
      starts_at: '2027-03-27T12:00:00.000Z',
      ends_at: '2027-03-29T00:00:00.000Z',
      location_raw: 'Yale University, CT, USA',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2027-03-01T23:59:59.000Z',
      themes: ['student', 'general'],
    },
    {
      source: 'known',
      source_id: 'conuhacks-2027',
      title: 'ConUHacks',
      url: 'https://www.conuhacks.io/',
      starts_at: '2027-01-24T14:00:00.000Z',
      ends_at: '2027-01-25T22:00:00.000Z',
      location_raw: 'Montreal, Canada',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2027-01-10T23:59:59.000Z',
      themes: ['student', 'general'],
    },
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
  ]
  return rows.filter((r) => r.starts_at && Date.parse(r.starts_at) > now)
}
