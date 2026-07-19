import type { IngestRow } from './devpost'

// Hand-curated high-value events that don't reliably appear in any public API
// feed (or appear too late). Keep this list small and high-signal only.
// Rules for adding:
//   1. Confirmed dates + registration URL
//   2. Travel sponsorship is documented (or very likely)
//   3. Remove once the event ends or a proper source starts covering it

export function fetchKnownEvents(): IngestRow[] {
  const now = Date.now()
  const rows: IngestRow[] = [
    {
      // Junction 2026 Main Event — Europe's leading hackathon.
      // Nov 13–15 2026, Hype Arena / Espoo, Finland.
      // Limited travel grants up to €300 (confirmed via official channels).
      // Source: hackjunction.com — applications open as of July 2026.
      source: 'known',
      source_id: 'junction-2026-main',
      title: 'Junction 2026',
      url: 'https://www.hackjunction.com/',
      starts_at: '2026-11-13T08:00:00.000Z',
      ends_at: '2026-11-15T18:00:00.000Z',
      location_raw: 'Espoo, Finland',
      format: 'in_person',
      prize_pool: '100000+ EUR',
      registration_deadline: '2026-10-15T23:59:59.000Z', // approximate; confirm on site
      themes: ['general', 'hardware', 'ai'],
    },
  ]

  // Drop anything already past
  return rows.filter((r) => {
    if (!r.starts_at) return true
    return Date.parse(r.starts_at) > now
  })
}
