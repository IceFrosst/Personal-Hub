import type { IngestRow } from './devpost'

export function fetchAfricaAuSeeds(): IngestRow[] {
  const now = Date.now()
  const rows: IngestRow[] = [
    {
      source: 'known',
      source_id: 'ubuntunet-women-2026',
      title: 'UbuntuNet Alliance Women Hackathon 2026',
      url: 'https://ubuntunet.net/women-in-stem/call-for-proposals-to-participate-in-the-fourth-ubuntunet-alliance-for-research-and-education-networking-women-hackathon-2026/',
      starts_at: '2026-10-26T07:00:00.000Z',
      ends_at: '2026-10-28T17:00:00.000Z',
      location_raw: 'Lilongwe, Malawi',
      format: 'hybrid',
      prize_pool: null,
      registration_deadline: '2026-05-29T23:59:59.000Z',
      themes: ['africa', 'women', 'climate', 'stem'],
    },
    {
      source: 'known',
      source_id: 'w3node-2027',
      title: 'W3Node Conference & Hackathon',
      url: 'https://w3node.io/',
      starts_at: '2027-01-15T08:00:00.000Z',
      ends_at: '2027-01-18T18:00:00.000Z',
      location_raw: 'Cape Town, South Africa',
      format: 'in_person',
      prize_pool: null,
      registration_deadline: '2026-12-01T23:59:59.000Z',
      themes: ['africa', 'web3'],
    },
    {
      source: 'known',
      source_id: 'unihack-2027',
      title: 'UNIHACK',
      url: 'https://www.unihack.net/',
      starts_at: '2027-03-12T01:00:00.000Z',
      ends_at: '2027-03-14T10:00:00.000Z',
      location_raw: 'Australia (multi-city hybrid)',
      format: 'hybrid',
      prize_pool: null,
      registration_deadline: '2027-02-20T23:59:59.000Z',
      themes: ['australia', 'student'],
    },
  ]
  return rows.filter((r) => r.starts_at && Date.parse(r.starts_at) > now)
}
