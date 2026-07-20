/**
 * Batch 2 deep-discovery packs: Sweden, Denmark, Norway, Italy.
 * Same shape as batch 1 — Luma queries + organisers + markers.
 */

export type CountryPack = {
  id: string
  label: string
  markers: string[]
  lumaQueries: string[]
  organisers: Array<{ id: string; label: string; url: string }>
  notes: string
}

export const PRIORITY_BATCH2: CountryPack[] = [
  {
    id: 'sweden',
    label: 'Sweden',
    markers: [
      'sweden',
      'swedish',
      'stockholm',
      'gothenburg',
      'göteborg',
      'goteborg',
      'malmö',
      'malmo',
      'uppsala',
      'lund',
      'linköping',
      'linkoping',
    ],
    lumaQueries: [
      'hackathon Sweden',
      'hackathon Stockholm',
      'hackathon Gothenburg',
      'hackathon Göteborg',
      'hackathon Malmö',
      'hackathon Uppsala',
      'hackathon Lund',
    ],
    organisers: [
      { id: 'nordic-startup-se', label: 'Nordic Startup Hub SE events', url: 'https://nordicstartuphub.com/swedenevents' },
      { id: 'junction-se', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
    ],
    notes: 'Stockholm/Gothenburg student + startup scene; Luma + Junction satellites + MLH.',
  },
  {
    id: 'denmark',
    label: 'Denmark',
    markers: [
      'denmark',
      'danish',
      'copenhagen',
      'københavn',
      'kobenhavn',
      'aarhus',
      'århus',
      'odense',
      'aalborg',
    ],
    lumaQueries: [
      'hackathon Denmark',
      'hackathon Copenhagen',
      'hackathon Aarhus',
      'hackathon Aalborg',
      'RoyalHacks',
    ],
    organisers: [
      { id: 'royalhacks', label: 'RoyalHacks', url: 'https://royalhacks.io/' },
      { id: 'nordic-startup-dk', label: 'Nordic Startup Hub DK events', url: 'https://nordicstartuphub.com/denmarkevents' },
    ],
    notes: 'RoyalHacks = national student flagship (Apr 2026 Copenhagen). Strong DTU/ITU scene.',
  },
  {
    id: 'norway',
    label: 'Norway',
    markers: [
      'norway',
      'norwegian',
      'oslo',
      'bergen',
      'trondheim',
      'stavanger',
      'tromsø',
      'tromso',
    ],
    lumaQueries: [
      'hackathon Norway',
      'hackathon Oslo',
      'hackathon Bergen',
      'hackathon Trondheim',
      'hackathon NTNU',
    ],
    organisers: [
      { id: 'tekna-oslo', label: 'Tekna / NASA Space Apps Oslo', url: 'https://www.tekna.no/en/events/' },
      { id: 'uio-growth', label: 'UiO Growth House events', url: 'https://www.uio.no/english/research/interfaculty-research-areas/growth-house/student-innovation/ihub/events/' },
      { id: 'junction-no', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
    ],
    notes: 'UiO / NTNU student hacks; NASA Space Apps local in Oslo; Luma catches community events.',
  },
  {
    id: 'italy',
    label: 'Italy',
    markers: [
      'italy',
      'italia',
      'italian',
      'milan',
      'milano',
      'rome',
      'roma',
      'turin',
      'torino',
      'bologna',
      'florence',
      'firenze',
      'naples',
      'napoli',
      'padova',
      'padua',
    ],
    lumaQueries: [
      'hackathon Italy',
      'hackathon Milan',
      'hackathon Milano',
      'hackathon Rome',
      'hackathon Turin',
      'hackathon Torino',
      'hackathon Bologna',
      'hackathon Florence',
    ],
    organisers: [
      { id: 'junction-it', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
      { id: 'mlh-it', label: 'MLH seasons', url: 'https://mlh.io/seasons/2026/events' },
    ],
    notes: 'Polytechnic Milan / Turin student circuit; Encode/Luma community hacks common in Milan.',
  },
]

export const LUMA_BATCH2_QUERIES: string[] = PRIORITY_BATCH2.flatMap((p) => p.lumaQueries)

export const BATCH2_ORGANISERS = PRIORITY_BATCH2.flatMap((p) =>
  p.organisers.map((o) => ({ ...o, country: p.id }))
)

export function isBatch2Country(locationHaystack: string): boolean {
  const h = locationHaystack.toLowerCase()
  return PRIORITY_BATCH2.some((p) => p.markers.some((m) => h.includes(m)))
}
