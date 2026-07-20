import type { Hackathon } from './types'

/** Lithuania + Latvia + Estonia + Poland — primary region of interest. */
export const BALTIC_PL_MARKERS = [
  'lithuania',
  'latv',
  'estonia',
  'poland',
  'polish',
  'vilnius',
  'kaunas',
  'klaipeda',
  'riga',
  'tallinn',
  'tartu',
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
  'baltic',
]

export function isBalticOrPoland(
  h: Pick<Hackathon, 'country' | 'city' | 'location_raw' | 'title' | 'themes'>
): boolean {
  const hay = `${h.country ?? ''} ${h.city ?? ''} ${h.location_raw ?? ''} ${h.title ?? ''} ${(h.themes ?? []).join(' ')}`.toLowerCase()
  return BALTIC_PL_MARKERS.some((m) => hay.includes(m))
}

/** Luma discovery queries for the region. */
export const LUMA_BALTIC_PL_QUERIES = [
  'hackathon Vilnius',
  'hackathon Kaunas',
  'hackathon Riga',
  'hackathon Tallinn',
  'hackathon Warsaw',
  'hackathon Kraków',
  'hackathon Wrocław',
  'hackathon Gdańsk',
  'hackathon Baltic',
  'hackathon Poland',
  'hackathon Lithuania',
  'hackathon Estonia',
  'hackathon Latvia',
] as const

/**
 * Social search templates (X / LinkedIn) for the weekly agent pass.
 * Run manually or via x_keyword_search in agent sessions.
 */
export const SOCIAL_BALTIC_PL_QUERIES = [
  'hackathon (Vilnius OR Kaunas OR Klaipėda) (2026 OR 2027)',
  'hackathon (Riga OR "Latvia") (2026 OR 2027)',
  'hackathon (Tallinn OR Tartu OR Estonia) (2026 OR 2027)',
  'hackathon (Warsaw OR Warszawa OR Kraków OR Krakow OR Wrocław OR Gdańsk OR Poland) (2026 OR 2027)',
  '("HackYeah" OR Garage48 OR Jaunaragiai OR "MAKE IT REAL" OR "sTARTUp Day") (hackathon OR hakaton)',
  'hakatonas (Vilnius OR Kaunas OR Lietuva)',
  'hakaton (Rīga OR Latvija)',
  'häkaton (Tallinn OR Eesti)',
] as const

export const LOCAL_ORGANISERS = [
  { id: 'jaunaragiai', label: 'Jaunaragiai / Junicorns', url: 'https://www.jaunaragiai.lt/en', country: 'LT' },
  { id: 'startup-lithuania', label: 'Startup Lithuania', url: 'https://www.startuplithuania.com/', country: 'LT' },
  { id: 'vilnius-tech', label: 'VILNIUS TECH', url: 'https://vilniustech.lt/en', country: 'LT' },
  { id: 'ktu', label: 'KTU', url: 'https://en.ktu.edu/', country: 'LT' },
  { id: 'garage48', label: 'Garage48', url: 'https://garage48.org/', country: 'EE' },
  { id: 'startup-day', label: 'sTARTUp Day', url: 'https://www.startupday.ee/', country: 'EE' },
  { id: 'taltech', label: 'TalTech', url: 'https://taltech.ee/en', country: 'EE' },
  { id: 'riga-techgirls', label: 'Riga TechGirls', url: 'https://rigatechgirls.com/', country: 'LV' },
  { id: 'hackyeah', label: 'HackYeah', url: 'https://hackyeah.pl/', country: 'PL' },
  { id: 'eurodefense', label: 'European Defense Tech Hub', url: 'https://eurodefense.tech/', country: 'EU' },
  { id: 'crossweb', label: 'Crossweb (PL events)', url: 'https://crossweb.pl/en/events/', country: 'PL' },
] as const
