/**
 * Batch 1 deep-discovery packs: Poland, Finland, Germany, Netherlands.
 * Used by Luma multi-query, weekly probe, and watches.
 *
 * Capture layers per country:
 *  A) Luma city/country queries
 *  B) Flagship organisers (watch + known seeds)
 *  C) Aggregators (Crossweb PL, germantechjobs, Junction app, …)
 *  D) Social / MLH already global
 */

export type CountryPack = {
  id: string
  label: string
  /** Substrings for location matching */
  markers: string[]
  /** Luma discover queries */
  lumaQueries: string[]
  /** Organiser / calendar URLs to probe weekly */
  organisers: Array<{ id: string; label: string; url: string }>
  /** Notes for humans / agents */
  notes: string
}

export const PRIORITY_BATCH1: CountryPack[] = [
  {
    id: 'poland',
    label: 'Poland',
    markers: [
      'poland',
      'polish',
      'warsaw',
      'warszawa',
      'krak',
      'cracow',
      'wrocław',
      'wroclaw',
      'gdańsk',
      'gdansk',
      'poznań',
      'poznan',
      'łódź',
      'lodz',
      'rzesz',
      'lublin',
      'katowice',
    ],
    lumaQueries: [
      'hackathon Poland',
      'hackathon Warsaw',
      'hackathon Warszawa',
      'hackathon Kraków',
      'hackathon Krakow',
      'hackathon Wrocław',
      'hackathon Gdańsk',
      'hackathon Poznań',
      'HackYeah',
    ],
    organisers: [
      { id: 'hackyeah', label: 'HackYeah', url: 'https://hackyeah.pl/' },
      { id: 'crossweb-pl', label: 'Crossweb events', url: 'https://crossweb.pl/en/events/' },
      { id: 'edth-warsaw', label: 'EDTH Luma', url: 'https://lu.ma/eurodefensetech' },
    ],
    notes: 'HackYeah = Europe largest on-site; Crossweb lists PL tech events; EDTH rotates to Warsaw.',
  },
  {
    id: 'finland',
    label: 'Finland',
    markers: ['finland', 'finnish', 'helsinki', 'espoo', 'tampere', 'turku', 'oulu'],
    lumaQueries: [
      'hackathon Finland',
      'hackathon Helsinki',
      'hackathon Espoo',
      'hackathon Tampere',
      'Junction hackathon',
      'hackathon Aalto',
    ],
    organisers: [
      { id: 'junction', label: 'Junction / Hackjunction', url: 'https://www.hackjunction.com/' },
      { id: 'junction-app', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
      { id: 'slush-side', label: 'Slush (side events)', url: 'https://www.slush.org/' },
    ],
    notes: 'Junction 2026 (Nov 13–15 Espoo) is the flagship; Junction platform hosts satellites.',
  },
  {
    id: 'germany',
    label: 'Germany',
    markers: [
      'germany',
      'deutschland',
      'german',
      'berlin',
      'munich',
      'münchen',
      'hamburg',
      'cologne',
      'köln',
      'frankfurt',
      'stuttgart',
      'düsseldorf',
      'dusseldorf',
      'leipzig',
      'aachen',
    ],
    lumaQueries: [
      'hackathon Germany',
      'hackathon Berlin',
      'hackathon Munich',
      'hackathon München',
      'hackathon Hamburg',
      'hackathon Cologne',
      'hackathon Frankfurt',
      'hackathon Stuttgart',
      'hackathon Aachen',
    ],
    organisers: [
      { id: 'german-tech-jobs', label: 'GermanTechJobs events', url: 'https://germantechjobs.de/en/events' },
      { id: 'junction-de', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
      { id: 'mlh-eu', label: 'MLH seasons', url: 'https://mlh.io/seasons/2026/events' },
    ],
    notes: 'Dense MLH + uni scene (TUM, RWTH…). germantechjobs aggregates meetups/hacks.',
  },
  {
    id: 'netherlands',
    label: 'Netherlands',
    markers: [
      'netherlands',
      'holland',
      'dutch',
      'amsterdam',
      'rotterdam',
      'utrecht',
      'eindhoven',
      'delft',
      'hague',
      'den haag',
      'groningen',
    ],
    lumaQueries: [
      'hackathon Netherlands',
      'hackathon Amsterdam',
      'hackathon Delft',
      'hackathon Eindhoven',
      'hackathon Rotterdam',
      'hackathon Utrecht',
      'hackathon Groningen',
    ],
    organisers: [
      { id: 'edth-nl', label: 'EDTH Netherlands', url: 'https://lu.ma/eurodefensetech' },
      { id: 'junction-nl', label: 'Junction platform', url: 'https://hackjunction.app/hackathons' },
    ],
    notes: 'Strong uni circuit (TU Delft, TU/e, UvA); Luma + MLH catch most student events.',
  },
]

export const LUMA_BATCH1_QUERIES: string[] = PRIORITY_BATCH1.flatMap((p) => p.lumaQueries)

export const BATCH1_ORGANISERS = PRIORITY_BATCH1.flatMap((p) =>
  p.organisers.map((o) => ({ ...o, country: p.id }))
)

export function isBatch1Country(locationHaystack: string): boolean {
  const h = locationHaystack.toLowerCase()
  return PRIORITY_BATCH1.some((p) => p.markers.some((m) => h.includes(m)))
}
