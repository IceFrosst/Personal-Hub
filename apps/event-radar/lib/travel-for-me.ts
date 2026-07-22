import type { Hackathon, TravelScope } from './types'

/** Geographic super-regions used to interpret travel_regions + home_base. */
const REGION_OF: Record<string, string> = {
  lithuania: 'europe',
  latvia: 'europe',
  estonia: 'europe',
  poland: 'europe',
  finland: 'europe',
  norway: 'europe',
  denmark: 'europe',
  sweden: 'europe',
  germany: 'europe',
  netherlands: 'europe',
  belgium: 'europe',
  austria: 'europe',
  hungary: 'europe',
  czechia: 'europe',
  czech: 'europe',
  'czech republic': 'europe',
  italy: 'europe',
  spain: 'europe',
  france: 'europe',
  portugal: 'europe',
  romania: 'europe',
  bulgaria: 'europe',
  greece: 'europe',
  ireland: 'europe',
  'united kingdom': 'europe',
  uk: 'europe',
  switzerland: 'europe',
  georgia: 'europe',
  ukraine: 'europe',
  usa: 'na',
  'united states': 'na',
  'united states of america': 'na',
  america: 'na',
  canada: 'na',
  mexico: 'na',
  india: 'asia',
  china: 'asia',
  japan: 'asia',
  korea: 'asia',
  singapore: 'asia',
  'hong kong': 'asia',
  australia: 'oceania',
  'new zealand': 'oceania',
  kenya: 'africa',
  nigeria: 'africa',
  ghana: 'africa',
  'south africa': 'africa',
  rwanda: 'africa',
  egypt: 'africa',
  morocco: 'africa',
}

const EUROPE_ALIASES = new Set([
  'europe',
  'eu',
  'european',
  'eea',
  'schengen',
  'emea',
  'international',
  'global',
  'worldwide',
  'any',
  'all',
  'abroad',
  'foreign',
])

const GLOBAL_ALIASES = new Set(['international', 'global', 'worldwide', 'any', 'all', 'abroad'])

const NA_ALIASES = new Set(['na', 'north america', 'us', 'usa', 'united states', 'canada'])
const AFRICA_ALIASES = new Set(['africa', 'african', 'sub-saharan', 'mena'])
const ASIA_ALIASES = new Set(['asia', 'apac', 'asia-pacific', 'southeast asia'])

export type TravelUseful = 'yes' | 'maybe' | 'no' | 'unknown'

export function normalizeHomeBase(raw: string | null | undefined): string {
  const v = (raw ?? 'lithuania').toLowerCase().trim()
  if (v === 'czech' || v === 'czech republic') return 'czechia'
  return v || 'lithuania'
}

export function homeRegion(homeBase: string): string {
  return REGION_OF[normalizeHomeBase(homeBase)] ?? 'europe'
}

function regionTokens(regions: string[] | null | undefined): string[] {
  return (regions ?? []).map((r) => r.toLowerCase().trim()).filter(Boolean)
}

function tokensCoverHome(tokens: string[], home: string, homeReg: string): boolean {
  if (tokens.length === 0) return false
  for (const t of tokens) {
    if (GLOBAL_ALIASES.has(t)) return true
    if (EUROPE_ALIASES.has(t) && homeReg === 'europe') return true
    if (NA_ALIASES.has(t) && homeReg === 'na') return true
    if (AFRICA_ALIASES.has(t) && homeReg === 'africa') return true
    if (ASIA_ALIASES.has(t) && homeReg === 'asia') return true
    if (t === home || t.includes(home) || home.includes(t)) return true
    // "EU countries", "Europe excluding UK", etc.
    if (homeReg === 'europe' && (t.includes('europe') || t.includes('eu '))) return true
  }
  return false
}

function tokensExcludeOthers(tokens: string[], homeReg: string): boolean {
  // Explicit foreign-only lists that don't include home region
  if (tokens.length === 0) return false
  const onlyNa = tokens.every((t) => NA_ALIASES.has(t) || t === 'domestic' || t === 'local')
  if (onlyNa && homeReg !== 'na') return true
  const onlyAfrica = tokens.every((t) => AFRICA_ALIASES.has(t))
  if (onlyAfrica && homeReg !== 'africa') return true
  const onlyAsia = tokens.every((t) => ASIA_ALIASES.has(t))
  if (onlyAsia && homeReg !== 'asia') return true
  return false
}

/**
 * Does this event's travel policy help someone based in `homeBase`?
 * Conservative: selective / ambiguous → maybe; explicit foreign-only → no.
 */
export function travelUsefulForMe(
  h: Pick<
    Hackathon,
    'travel_covered' | 'travel_scope' | 'travel_regions' | 'country' | 'location_raw' | 'city' | 'format'
  >,
  homeBase: string
): TravelUseful {
  if (h.format === 'online') return 'no'

  const home = normalizeHomeBase(homeBase)
  const homeReg = homeRegion(home)
  const scope = (h.travel_scope ?? null) as TravelScope | null
  const regions = regionTokens(h.travel_regions)

  if (h.travel_covered === false || scope === 'none') return 'no'

  if (scope === 'domestic') {
    // Domestic of the *venue* country — only useful if user already lives there
    const venue = `${h.country ?? ''} ${h.location_raw ?? ''} ${h.city ?? ''}`.toLowerCase()
    if (venue.includes(home)) return 'maybe' // local train/bus, not international
    return 'no'
  }

  if (scope === 'international' || scope === 'global') {
    if (tokensExcludeOthers(regions, homeReg)) return 'no'
    if (regions.length > 0 && !tokensCoverHome(regions, home, homeReg)) {
      // e.g. international but "African participants only"
      return 'no'
    }
    return 'yes'
  }

  if (scope === 'regional') {
    if (tokensCoverHome(regions, home, homeReg)) return 'yes'
    if (regions.length === 0) {
      // Regional with no list — weak signal
      return 'maybe'
    }
    return 'no'
  }

  if (scope === 'selective') return 'maybe'

  // No structured scope yet
  if (h.travel_covered === true) {
    if (tokensExcludeOthers(regions, homeReg)) return 'no'
    if (regions.length > 0) {
      return tokensCoverHome(regions, home, homeReg) ? 'yes' : 'no'
    }
    // Boolean true without geography — do not full-boost (was the false positive)
    return 'maybe'
  }

  return 'unknown'
}

/** Short label for cards — empty when nothing useful to show. */
export function travelTagLabel(
  h: Pick<
    Hackathon,
    'travel_covered' | 'travel_scope' | 'travel_regions' | 'country' | 'location_raw' | 'city' | 'format'
  >,
  homeBase: string
): string | null {
  const useful = travelUsefulForMe(h, homeBase)
  if (useful === 'yes') return 'Travel'
  if (useful === 'maybe') {
    if (h.travel_scope === 'selective') return 'Travel · selective'
    return 'Travel · check FAQ'
  }
  if (h.travel_covered === true || h.travel_scope === 'domestic' || h.travel_scope === 'regional') {
    // Display the region with its original casing (e.g. "US", "EU"); the
    // lowercased regionTokens are for matching only, not for the label.
    const rawRegions = (h.travel_regions ?? [])
      .map((r) => (typeof r === 'string' ? r.trim() : ''))
      .filter(Boolean)
    if (rawRegions.length > 0) {
      const first = rawRegions[0]
      const short = first.length <= 12 ? first : first.slice(0, 10) + '…'
      return `Travel · ${short}`
    }
    if (h.travel_scope === 'domestic') return 'Travel · domestic'
    return 'Travel · not for me'
  }
  return null
}
