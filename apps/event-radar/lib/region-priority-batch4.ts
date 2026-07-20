/**
 * Batch 4 (final) deep-discovery packs: Hungary, Georgia (country).
 */

export type CountryPack = {
  id: string
  label: string
  markers: string[]
  lumaQueries: string[]
  organisers: Array<{ id: string; label: string; url: string }>
  notes: string
}

export const PRIORITY_BATCH4: CountryPack[] = [
  {
    id: 'hungary',
    label: 'Hungary',
    markers: [
      'hungary',
      'hungarian',
      'budapest',
      'debrecen',
      'szeged',
      'pécs',
      'pecs',
      'győr',
      'gyor',
    ],
    lumaQueries: [
      'hackathon Hungary',
      'hackathon Budapest',
      'hackathon Debrecen',
      'JunctionX Budapest',
      'hackathon Corvinus',
    ],
    organisers: [
      { id: 'crafthub-hu', label: 'CraftHub hackathons HU', url: 'https://crafthub.events/hackathons/' },
      { id: 'junction-hu', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
      { id: 'corvinus', label: 'Corvinus University events', url: 'https://www.uni-corvinus.hu/?lang=en' },
    ],
    notes: 'JunctionX Budapest + CraftHub list; Corvinus Green Hackathon (Jun 2026 done). Dense student scene.',
  },
  {
    id: 'georgia',
    label: 'Georgia',
    // Prefer Tbilisi/Batumi to avoid matching US Georgia Tech events
    markers: ['tbilisi', 'batumi', 'kutaisi', 'georgia'],
    lumaQueries: [
      'hackathon Tbilisi',
      'hackathon Batumi',
      'hackathon "Tbilisi" Georgia',
      'hackathon Georgia Tbilisi',
    ],
    organisers: [
      { id: 'junction-ge', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
    ],
    notes:
      'Sparse public listings; Luma Tbilisi is the main net. Avoid US "Georgia Tech" false positives via city markers in scoring later if needed.',
  },
]

export const LUMA_BATCH4_QUERIES: string[] = PRIORITY_BATCH4.flatMap((p) => p.lumaQueries)

export const BATCH4_ORGANISERS = PRIORITY_BATCH4.flatMap((p) =>
  p.organisers.map((o) => ({ ...o, country: p.id }))
)

export function isBatch4Country(locationHaystack: string): boolean {
  const h = locationHaystack.toLowerCase()
  // Hungary: straightforward
  if (PRIORITY_BATCH4[0].markers.some((m) => h.includes(m))) return true
  // Georgia country: require Tbilisi/Batumi/Kutaisi OR (georgia && not "georgia tech" / atlanta)
  if (/tbilisi|batumi|kutaisi/.test(h)) return true
  if (h.includes('georgia') && !/georgia tech|atlanta|savannah|usa|united states/.test(h)) return true
  return false
}
