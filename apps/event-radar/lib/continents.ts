import type { Hackathon } from './types'

/**
 * Continent of an event, for the feed's Regions toggles.
 *
 * Why this exists: the catalog's `country` column is null on most rows
 * (971 of ~1500 on 2026-09-09, including 146 of 380 upcoming in-person
 * events), because enrichment only fills it when the page says so. What those
 * rows DO carry is `location_raw` — Luma's "Austin, TX", MLH's "Atlanta,
 * Georgia", Hack Club's "Manteca, California, United States" — and sometimes
 * only a title ("Munich Hub - Hack Nation Global AI Hackathon"). So a filter
 * keyed on `country` alone would have let two thirds of the US rows straight
 * through, which is the one thing the toggle is for.
 *
 * Hence a layered classifier: country column → country names anywhere in the
 * place fields → US/Canadian state and province codes → well-known city names
 * in the place fields → well-known city names in the title. Each layer only
 * runs when the one before it found nothing. Anything still unresolved is
 * `null`, which the UI exposes as its own "Unknown" toggle rather than
 * quietly folding into some continent — a venue-only string like "Mitchell
 * Park Community Center" is not evidence of anything.
 *
 * Every list here is matched on whole words after lowercasing and stripping
 * diacritics, so "Zürich"/"Zurich", "München"/"Munich", "Türkiye"/"Turkiye"
 * all resolve, and "Niger" never matches inside "Nigeria".
 */

export type Continent =
  | 'europe'
  | 'north_america'
  | 'south_america'
  | 'asia'
  | 'africa'
  | 'oceania'

/** Filter keys: every continent plus the unresolved bucket. */
export type RegionKey = Continent | 'unknown'

export const CONTINENTS: readonly Continent[] = [
  'europe',
  'north_america',
  'south_america',
  'asia',
  'africa',
  'oceania',
] as const

export const REGION_KEYS: readonly RegionKey[] = [...CONTINENTS, 'unknown'] as const

export const REGION_LABELS: Record<RegionKey, string> = {
  europe: 'Europe',
  north_america: 'North America',
  south_america: 'South America',
  asia: 'Asia',
  africa: 'Africa',
  oceania: 'Oceania',
  unknown: 'Unknown',
}

/** Short form for the chip row, where "North America" does not fit. */
export const REGION_SHORT_LABELS: Record<RegionKey, string> = {
  europe: 'EU',
  north_america: 'N. America',
  south_america: 'S. America',
  asia: 'Asia',
  africa: 'Africa',
  oceania: 'Oceania',
  unknown: 'Unknown',
}

export function isRegionKey(v: unknown): v is RegionKey {
  return typeof v === 'string' && (REGION_KEYS as readonly string[]).includes(v)
}

// ─── Country names ──────────────────────────────────────────────────────────

const COUNTRIES: Record<Continent, string[]> = {
  europe: [
    'albania', 'andorra', 'austria', 'osterreich', 'belarus', 'belgium', 'belgique', 'belgie',
    'bosnia and herzegovina', 'bosnia', 'bulgaria', 'croatia', 'hrvatska', 'cyprus', 'czechia',
    'czech republic', 'denmark', 'danmark', 'estonia', 'eesti', 'finland', 'suomi', 'france',
    'germany', 'deutschland', 'greece', 'hellas', 'hungary', 'magyarorszag', 'iceland', 'ireland',
    'italy', 'italia', 'kosovo', 'latvia', 'latvija', 'liechtenstein', 'lithuania', 'lietuva',
    'luxembourg', 'malta', 'moldova', 'monaco', 'montenegro', 'netherlands', 'the netherlands',
    'nederland', 'holland', 'north macedonia', 'macedonia', 'norway', 'norge', 'poland', 'polska',
    'portugal', 'romania', 'russia', 'san marino', 'serbia', 'srbija', 'slovakia', 'slovensko',
    'slovenia', 'slovenija', 'spain', 'espana', 'sweden', 'sverige', 'switzerland', 'schweiz',
    'suisse', 'svizzera', 'turkey', 'turkiye', 'ukraine', 'ukraina', 'united kingdom', 'uk',
    'u.k.', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland',
    'europe', 'european', 'eu', 'gb',
  ],
  north_america: [
    'united states', 'united states of america', 'usa', 'u.s.a.', 'u.s.', 'us',
    'canada', 'mexico', 'guatemala', 'belize', 'honduras', 'el salvador', 'nicaragua',
    'costa rica', 'panama', 'cuba', 'jamaica', 'haiti', 'dominican republic', 'puerto rico',
    'bahamas', 'trinidad and tobago', 'trinidad', 'barbados', 'north america',
  ],
  south_america: [
    'brazil', 'brasil', 'argentina', 'chile', 'colombia', 'peru', 'venezuela', 'ecuador',
    'bolivia', 'paraguay', 'uruguay', 'guyana', 'suriname', 'south america', 'latin america',
    'latam',
  ],
  asia: [
    'india', 'china', 'japan', 'south korea', 'korea', 'republic of korea', 'singapore',
    'hong kong', 'taiwan', 'malaysia', 'indonesia', 'thailand', 'vietnam', 'viet nam',
    'philippines', 'pakistan', 'bangladesh', 'sri lanka', 'nepal', 'bhutan', 'myanmar',
    'cambodia', 'laos', 'mongolia', 'kazakhstan', 'uzbekistan', 'kyrgyzstan', 'tajikistan',
    'turkmenistan', 'afghanistan', 'iran', 'iraq', 'israel', 'palestine', 'jordan', 'lebanon',
    'syria', 'saudi arabia', 'united arab emirates', 'uae', 'qatar', 'kuwait', 'bahrain', 'oman',
    'yemen', 'armenia', 'azerbaijan', 'macau', 'macao', 'brunei', 'maldives', 'asia', 'apac',
    'southeast asia', 'middle east',
  ],
  africa: [
    'nigeria', 'kenya', 'ghana', 'south africa', 'egypt', 'morocco', 'algeria', 'tunisia', 'libya',
    'ethiopia', 'uganda', 'tanzania', 'rwanda', 'cameroon', 'senegal', 'ivory coast',
    "cote d'ivoire", 'zambia', 'zimbabwe', 'malawi', 'mozambique', 'botswana', 'namibia', 'angola',
    'sudan', 'south sudan', 'somalia', 'mali', 'niger', 'burkina faso', 'benin', 'togo',
    'sierra leone', 'liberia', 'gambia', 'mauritius', 'madagascar', 'congo',
    'democratic republic of the congo', 'drc', 'gabon', 'chad', 'eritrea', 'djibouti',
    'seychelles', 'cape verde', 'mauritania', 'africa', 'african',
  ],
  oceania: [
    'australia', 'new zealand', 'aotearoa', 'fiji', 'papua new guinea', 'samoa', 'tonga',
    'oceania',
  ],
}

// Georgia is both a US state and a European country. It is handled on its own
// below, never through the plain country list.

// ─── US states / Canadian provinces ─────────────────────────────────────────

const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
  'delaware', 'florida', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky',
  'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi',
  'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico',
  'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
  'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
  'washington dc', 'washington d.c.',
]

const CA_PROVINCE_NAMES = [
  'ontario', 'quebec', 'british columbia', 'alberta', 'manitoba', 'saskatchewan', 'nova scotia',
  'new brunswick', 'newfoundland', 'prince edward island',
]

/**
 * "Austin, TX" / "Toronto, ON". Requires the comma so a stray two-letter word
 * is never read as a state. Case-sensitive on purpose — these are codes.
 * DE (Delaware) and NL (Newfoundland) are left out: they collide with the ISO
 * codes for Germany and the Netherlands, which some sources fall back to.
 */
const STATE_CODE_RE =
  /,\s*(?:AL|AK|AZ|AR|CA|CO|CT|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|ON|QC|BC|AB|MB|SK|NS|NB|PE|YT|NT|NU)(?![A-Za-z])/

// ─── Cities ─────────────────────────────────────────────────────────────────
// Only names that are unambiguous enough to stand alone. Deliberately absent:
// Cambridge (MA / UK), Cordoba (ES / AR), Santiago (CL / ES / MX), Toledo,
// Halifax, Hamilton, Alexandria, Nice, Bath, Reading, York, Durham, Split,
// Phoenix, Charlotte, Cali, Darwin, Essen, MIT (German "with") — each resolves through
// its country or state instead, or stays unknown.

const CITIES: Record<Continent, string[]> = {
  europe: [
    'london', 'berlin', 'munich', 'munchen', 'hamburg', 'frankfurt', 'cologne', 'koln',
    'stuttgart', 'dusseldorf', 'dresden', 'leipzig', 'nuremberg', 'nurnberg', 'hannover',
    'hanover', 'bremen', 'karlsruhe', 'heidelberg', 'mannheim', 'darmstadt', 'freiburg',
    'erlangen', 'augsburg', 'munster', 'dortmund', 'bonn', 'aachen', 'kiel', 'rostock',
    'potsdam', 'jena', 'regensburg', 'wurzburg', 'saarbrucken', 'kaiserslautern', 'gottingen',
    'tubingen', 'ulm', 'konstanz', 'passau', 'mainz', 'wiesbaden', 'bielefeld', 'wuppertal',
    'paris', 'lyon', 'marseille', 'toulouse', 'nantes', 'lille', 'bordeaux', 'grenoble',
    'strasbourg', 'montpellier', 'rennes', 'sophia antipolis', 'station f', 'puteaux',
    'madrid', 'barcelona', 'valencia', 'sevilla', 'seville', 'bilbao', 'zaragoza', 'malaga',
    'alicante', 'murcia', 'granada', 'salamanca', 'valladolid', 'pamplona', 'san sebastian',
    'donostia', 'vigo', 'a coruna', 'girona', 'tarragona', 'gijon', 'oviedo', 'santander',
    'lisbon', 'lisboa', 'porto', 'braga', 'coimbra', 'aveiro', 'carcavelos', 'guimaraes',
    'rome', 'roma', 'milan', 'milano', 'turin', 'torino', 'bologna', 'florence', 'firenze',
    'naples', 'napoli', 'genoa', 'genova', 'padova', 'padua', 'verona', 'trento', 'pisa',
    'amsterdam', 'rotterdam', 'utrecht', 'eindhoven', 'den haag', 'the hague', 'delft',
    'groningen', 'maastricht', 'nijmegen', 'tilburg', 'leiden', 'enschede', 'zwolle',
    'brussels', 'bruxelles', 'brussel', 'antwerp', 'antwerpen', 'ghent', 'gent', 'leuven',
    'liege', 'vienna', 'wien', 'graz', 'linz', 'innsbruck', 'salzburg', 'zurich', 'geneva',
    'geneve', 'lausanne', 'bern', 'basel', 'lugano', 'st. gallen', 'st gallen', 'winterthur',
    'lucerne', 'luzern', 'fribourg', 'neuchatel', 'leukerbad', 'prague', 'praha', 'brno',
    'ostrava', 'warsaw', 'warszawa', 'krakow', 'cracow', 'wroclaw', 'gdansk', 'poznan', 'lodz',
    'katowice', 'budapest', 'debrecen', 'szeged', 'bucharest', 'bucuresti', 'cluj',
    'cluj-napoca', 'timisoara', 'iasi', 'sofia', 'plovdiv', 'varna', 'athens', 'thessaloniki',
    'patras', 'dublin', 'cork', 'galway', 'limerick', 'belfast', 'edinburgh', 'glasgow',
    'manchester', 'birmingham', 'leeds', 'liverpool', 'bristol', 'oxford', 'sheffield',
    'nottingham', 'newcastle', 'southampton', 'cardiff', 'exeter',
    'copenhagen', 'kobenhavn', 'københavn', 'aarhus', 'odense', 'aalborg', 'stockholm',
    'gothenburg', 'goteborg', 'malmo', 'uppsala', 'lund', 'linkoping', 'kista', 'oslo', 'bergen',
    'trondheim', 'stavanger', 'helsinki', 'espoo', 'tampere', 'turku', 'oulu', 'tallinn', 'tartu',
    'parnu', 'riga', 'vilnius', 'kaunas', 'klaipeda', 'reykjavik', 'luxembourg city', 'ljubljana',
    'maribor', 'zagreb', 'belgrade', 'beograd', 'novi sad', 'sarajevo', 'skopje',
    'tirana', 'podgorica', 'pristina', 'chisinau', 'kyiv', 'kiev', 'lviv', 'odesa', 'minsk',
    'moscow', 'st petersburg', 'saint petersburg', 'tbilisi', 'batumi', 'kutaisi', 'istanbul',
    'ankara', 'izmir', 'besiktas', 'valletta', 'nicosia', 'limassol', 'bratislava', 'kosice',
  ],
  north_america: [
    'new york', 'nyc', 'brooklyn', 'manhattan', 'queens', 'san francisco', 'bay area',
    'silicon valley', 'palo alto', 'menlo park', 'mountain view', 'san jose', 'san mateo',
    'sunnyvale', 'santa clara', 'berkeley', 'oakland', 'stanford', 'los angeles', 'santa monica',
    'pasadena', 'irvine', 'glendale', 'san diego', 'seattle', 'redmond', 'bellevue', 'portland',
    'denver', 'boulder', 'austin', 'dallas', 'houston', 'san antonio', 'chicago', 'boston',
    'somerville', 'pittsburgh', 'philadelphia', 'washington dc', 'arlington', 'baltimore',
    'atlanta', 'miami', 'orlando', 'tampa', 'gainesville', 'scottsdale', 'tempe',
    'las vegas', 'salt lake city', 'provo', 'minneapolis', 'detroit', 'ann arbor', 'columbus',
    'cleveland', 'cincinnati', 'indianapolis', 'nashville', 'raleigh', 'chapel hill',
    'richmond', 'charlottesville', 'blacksburg', 'williamsburg', 'madison', 'milwaukee',
    'st. louis', 'saint louis', 'kansas city', 'omaha', 'new orleans', 'ithaca', 'princeton',
    'new haven', 'providence', 'waterloo', 'toronto', 'ottawa', 'montreal', 'vancouver',
    'calgary', 'edmonton', 'winnipeg', 'kitchener', 'burnaby', 'mississauga', 'mexico city',
    'ciudad de mexico', 'cdmx', 'guadalajara', 'monterrey', 'queretaro', 'puebla', 'tijuana',
    'san juan', 'havana', 'guatemala city', 'panama city', 'harvard', 'carnegie mellon',
    'georgia tech',
  ],
  south_america: [
    'sao paulo', 'rio de janeiro', 'brasilia', 'belo horizonte', 'curitiba', 'porto alegre',
    'recife', 'florianopolis', 'campinas', 'buenos aires', 'rosario', 'mendoza', 'bogota',
    'medellin', 'cartagena', 'lima', 'arequipa', 'quito', 'guayaquil', 'la paz',
    'montevideo', 'asuncion', 'caracas', 'valparaiso',
  ],
  asia: [
    'bengaluru', 'bangalore', 'mumbai', 'bombay', 'delhi', 'new delhi', 'hyderabad', 'chennai',
    'pune', 'kolkata', 'noida', 'gurgaon', 'gurugram', 'jaipur', 'ahmedabad', 'lucknow',
    'indore', 'chandigarh', 'kochi', 'bhubaneswar', 'prayagraj', 'singapore', 'hong kong',
    'tokyo', 'osaka', 'kyoto', 'seoul', 'busan', 'beijing', 'shanghai', 'shenzhen', 'hangzhou',
    'guangzhou', 'chengdu', 'taipei', 'kuala lumpur', 'subang jaya', 'penang', 'jakarta',
    'bandung', 'bangkok', 'hanoi', 'ho chi minh', 'saigon', 'manila', 'cebu', 'dhaka', 'karachi',
    'lahore', 'islamabad', 'colombo', 'kathmandu', 'thimphu', 'dubai', 'abu dhabi', 'doha',
    'riyadh', 'jeddah', 'tel aviv', 'jerusalem', 'haifa', 'beirut', 'amman', 'tehran', 'baku',
    'yerevan', 'almaty', 'astana', 'tashkent', 'ulaanbaatar', 'phnom penh', 'yangon',
  ],
  africa: [
    'lagos', 'abuja', 'ibadan', 'nairobi', 'mombasa', 'accra', 'kumasi', 'cape town',
    'johannesburg', 'pretoria', 'durban', 'cairo', 'giza', 'casablanca', 'rabat', 'marrakech',
    'tunis', 'algiers', 'addis ababa', 'kampala', 'dar es salaam', 'kigali', 'douala', 'yaounde',
    'dakar', 'abidjan', 'lusaka', 'harare', 'lilongwe', 'blantyre', 'maputo', 'gaborone',
    'windhoek', 'luanda', 'khartoum', 'kinshasa', 'port louis', 'antananarivo',
  ],
  oceania: [
    'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra', 'gold coast', 'hobart',
    'auckland', 'wellington', 'christchurch', 'dunedin', 'suva', 'charters towers',
  ],
}

const GEORGIA_COUNTRY_CITIES = ['tbilisi', 'batumi', 'kutaisi', 'rustavi']
const GEORGIA_STATE_HINTS = ['atlanta', 'savannah', 'augusta', 'macon', 'athens', 'georgia tech']

// ─── Matching ───────────────────────────────────────────────────────────────

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalizePlace(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Whole-word alternation. `\b` is ASCII-only in JS, so names that end in a
 * non-decomposable letter (København's ø, Wrocław's ł) need explicit
 * lookarounds instead — hence the letter-class guards.
 */
function wordList(names: string[]): RegExp {
  const alts = [...names].sort((a, b) => b.length - a.length).map(escapeRe)
  return new RegExp(`(?<![a-z\\u00c0-\\u024f])(?:${alts.join('|')})(?![a-z\\u00c0-\\u024f])`)
}

const COUNTRY_RE: Record<Continent, RegExp> = {
  europe: wordList(COUNTRIES.europe),
  north_america: wordList(COUNTRIES.north_america),
  south_america: wordList(COUNTRIES.south_america),
  asia: wordList(COUNTRIES.asia),
  africa: wordList(COUNTRIES.africa),
  oceania: wordList(COUNTRIES.oceania),
}
const CITY_RE: Record<Continent, RegExp> = {
  europe: wordList(CITIES.europe),
  north_america: wordList(CITIES.north_america),
  south_america: wordList(CITIES.south_america),
  asia: wordList(CITIES.asia),
  africa: wordList(CITIES.africa),
  oceania: wordList(CITIES.oceania),
}
const US_STATE_RE = wordList([...US_STATE_NAMES, ...CA_PROVINCE_NAMES])
const GEORGIA_RE = wordList(['georgia'])
const GEORGIA_COUNTRY_RE = wordList(GEORGIA_COUNTRY_CITIES)
const GEORGIA_STATE_RE = wordList(GEORGIA_STATE_HINTS)

/** Non-Latin country strings enrichment has produced. */
const LITERAL_COUNTRIES: Array<[string, Continent]> = [
  ['中国', 'asia'],
  ['日本', 'asia'],
  ['한국', 'asia'],
  ['россия', 'europe'],
  ['україна', 'europe'],
]

function firstMatch(table: Record<Continent, RegExp>, hay: string): Continent | null {
  for (const c of CONTINENTS) if (table[c].test(hay)) return c
  return null
}

function resolveGeorgia(place: string, placeRaw: string, fromCountryColumn: boolean): Continent {
  if (GEORGIA_COUNTRY_RE.test(place)) return 'europe'
  if (GEORGIA_STATE_RE.test(place) || STATE_CODE_RE.test(placeRaw)) return 'north_america'
  // Bare "Georgia" in the country column is the country (that is what the
  // travel logic in travel-for-me.ts assumes too). Bare "City, Georgia" in a
  // free-text location is the US convention used by MLH and Devpost.
  return fromCountryColumn ? 'europe' : 'north_america'
}

/**
 * Continent of an event, or `null` when nothing in its geography resolves.
 * Online events are classified like any other — the *filter* decides to let
 * them through; this function only answers "where".
 */
export function continentOf(
  h: Pick<Hackathon, 'country' | 'city' | 'location_raw' | 'title'>
): Continent | null {
  const countryRaw = (h.country ?? '').trim()
  const placeRaw = [h.city ?? '', h.location_raw ?? ''].filter(Boolean).join(' | ')

  // 1. The country column, when enrichment filled it.
  if (countryRaw) {
    for (const [literal, c] of LITERAL_COUNTRIES) if (countryRaw.includes(literal)) return c
    const country = normalizePlace(countryRaw)
    if (GEORGIA_RE.test(country)) return resolveGeorgia(normalizePlace(placeRaw), placeRaw, true)
    const byCountry = firstMatch(COUNTRY_RE, country)
    if (byCountry) return byCountry
    // Enrichment sometimes writes a US state ("California") as the country.
    if (US_STATE_RE.test(country)) return 'north_america'
  }

  // 2. Free-text place: country names, then state/province codes and names,
  //    then cities. Georgia is resolved before the generic lists so that
  //    "Atlanta, Georgia" cannot be read as Europe.
  if (placeRaw) {
    for (const [literal, c] of LITERAL_COUNTRIES) if (placeRaw.includes(literal)) return c
    const place = normalizePlace(placeRaw)
    const byCountry = firstMatch(COUNTRY_RE, place)
    if (byCountry) return byCountry
    if (GEORGIA_RE.test(place)) return resolveGeorgia(place, placeRaw, false)
    if (STATE_CODE_RE.test(placeRaw)) return 'north_america'
    if (US_STATE_RE.test(place)) return 'north_america'
    const byCity = firstMatch(CITY_RE, place)
    if (byCity) return byCity
  }

  // 3. Title, cities only. Country words are too loose here ("Hack for
  //    Ukraine" is not held in Ukraine), but "Munich Hub – Hack Nation" and
  //    "Pittsburgh Hub – Hack Nation" are exactly the rows this layer exists
  //    for: Luma satellite editions with an empty location.
  const title = normalizePlace(h.title ?? '')
  if (title) {
    const byCity = firstMatch(CITY_RE, title)
    if (byCity) return byCity
  }

  return null
}

/** The filter key for an event: its continent, or `'unknown'`. */
export function regionKeyOf(
  h: Pick<Hackathon, 'country' | 'city' | 'location_raw' | 'title'>
): RegionKey {
  return continentOf(h) ?? 'unknown'
}
