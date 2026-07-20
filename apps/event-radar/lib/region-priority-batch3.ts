/**
 * Batch 3 deep-discovery packs: Czechia, United Kingdom, Belgium, Austria.
 */

export type CountryPack = {
  id: string
  label: string
  markers: string[]
  lumaQueries: string[]
  organisers: Array<{ id: string; label: string; url: string }>
  notes: string
}

export const PRIORITY_BATCH3: CountryPack[] = [
  {
    id: 'czechia',
    label: 'Czechia',
    markers: [
      'czechia',
      'czech',
      'czech republic',
      'prague',
      'praha',
      'brno',
      'ostrava',
      'plzeň',
      'plzen',
    ],
    lumaQueries: [
      'hackathon Czechia',
      'hackathon "Czech Republic"',
      'hackathon Prague',
      'hackathon Praha',
      'hackathon Brno',
    ],
    organisers: [
      { id: 'czech-startups', label: 'Czech Startups events', url: 'https://czechstartups.gov.cz/en/startup-ecosystem/network/startup-events-and-hackathons/' },
      { id: 'edth-prague', label: 'EDTH Luma', url: 'https://lu.ma/eurodefensetech' },
      { id: 'junction-cz', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
    ],
    notes: 'EDTH Prague May 2026 done; strong Brno uni scene; Czech Startups lists ecosystem events.',
  },
  {
    id: 'united kingdom',
    label: 'United Kingdom',
    markers: [
      'united kingdom',
      'uk',
      'england',
      'scotland',
      'wales',
      'london',
      'manchester',
      'edinburgh',
      'birmingham',
      'bristol',
      'cambridge',
      'oxford',
      'leeds',
      'glasgow',
      'cardiff',
    ],
    lumaQueries: [
      'hackathon London',
      'hackathon Manchester',
      'hackathon Edinburgh',
      'hackathon Birmingham',
      'hackathon Bristol',
      'hackathon Cambridge',
      'hackathon Oxford',
      'hackathon "United Kingdom"',
      'hackathon UK',
    ],
    organisers: [
      { id: 'mlh-uk', label: 'MLH seasons', url: 'https://mlh.io/seasons/2026/events' },
      { id: 'junction-uk', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
    ],
    notes: 'Highest volume in Europe via MLH + Luma London. Uni circuit (Imperial, UCL, Cambridge, Edinburgh).',
  },
  {
    id: 'belgium',
    label: 'Belgium',
    markers: [
      'belgium',
      'belgian',
      'brussels',
      'bruxelles',
      'ghent',
      'gent',
      'leuven',
      'antwerp',
      'antwerpen',
      'liège',
      'liege',
    ],
    lumaQueries: [
      'hackathon Belgium',
      'hackathon Brussels',
      'hackathon Ghent',
      'hackathon Leuven',
      'hackathon Antwerp',
    ],
    organisers: [
      { id: 'junction-be', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
      { id: 'mlh-be', label: 'MLH seasons', url: 'https://mlh.io/seasons/2026/events' },
    ],
    notes: 'Brussels EU/startup + KU Leuven / Ghent student hacks; Luma + MLH primary.',
  },
  {
    id: 'austria',
    label: 'Austria',
    markers: [
      'austria',
      'austrian',
      'österreich',
      'vienna',
      'wien',
      'graz',
      'linz',
      'innsbruck',
      'salzburg',
    ],
    lumaQueries: [
      'hackathon Austria',
      'hackathon Vienna',
      'hackathon Wien',
      'hackathon Graz',
      'hackathon Linz',
      'hackathon Innsbruck',
    ],
    organisers: [
      { id: 'openglam-at', label: 'OpenGLAM / Cultural Hackathon AT', url: 'https://openglam.at/en/' },
      { id: 'junction-at', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
    ],
    notes: 'Cultural Hackathon Austria (Sep); Vienna AI/startup hacks on Luma; TU Wien scene.',
  },
]

export const LUMA_BATCH3_QUERIES: string[] = PRIORITY_BATCH3.flatMap((p) => p.lumaQueries)

export const BATCH3_ORGANISERS = PRIORITY_BATCH3.flatMap((p) =>
  p.organisers.map((o) => ({ ...o, country: p.id }))
)

export function isBatch3Country(locationHaystack: string): boolean {
  const h = locationHaystack.toLowerCase()
  return PRIORITY_BATCH3.some((p) => p.markers.some((m) => h.includes(m)))
}
