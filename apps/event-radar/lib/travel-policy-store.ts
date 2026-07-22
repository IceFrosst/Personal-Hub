import type { TravelScope } from './types'

const SCOPE_OK = new Set<TravelScope>([
  'none',
  'domestic',
  'regional',
  'international',
  'selective',
  'global',
])

export type TravelPolicyFields = {
  travel_scope: TravelScope | null
  travel_regions: string[]
  travel_cap: string | null
  travel_notes: string | null
}

/** Strip prior encoded travel tokens from a themes array. */
export function stripTravelThemeTokens(themes: string[]): string[] {
  return themes.filter(
    (t) =>
      !t.startsWith('travel_scope:') &&
      !t.startsWith('travel_region:') &&
      !t.startsWith('travel_cap:') &&
      !t.startsWith('travel_notes:')
  )
}

/** Encode policy into themes tokens (works without migration 0003). */
export function encodeTravelPolicyThemes(
  baseThemes: string[],
  policy: TravelPolicyFields
): string[] {
  const out = stripTravelThemeTokens(baseThemes)
  if (policy.travel_scope) out.push(`travel_scope:${policy.travel_scope}`)
  for (const r of policy.travel_regions.slice(0, 8)) {
    const clean = r.trim()
    if (clean) out.push(`travel_region:${clean}`)
  }
  if (policy.travel_cap) out.push(`travel_cap:${policy.travel_cap.slice(0, 80)}`)
  if (policy.travel_notes) out.push(`travel_notes:${policy.travel_notes.slice(0, 160)}`)
  return out
}

/** Decode policy from themes when dedicated columns are null/missing. */
export function decodeTravelPolicyFromThemes(themes: string[]): TravelPolicyFields {
  let scope: TravelScope | null = null
  const regions: string[] = []
  let cap: string | null = null
  let notes: string | null = null

  for (const t of themes) {
    if (t.startsWith('travel_scope:')) {
      const v = t.slice('travel_scope:'.length).toLowerCase().trim()
      if (SCOPE_OK.has(v as TravelScope)) scope = v as TravelScope
    } else if (t.startsWith('travel_region:')) {
      const v = t.slice('travel_region:'.length).trim()
      if (v) regions.push(v)
    } else if (t.startsWith('travel_cap:')) {
      cap = t.slice('travel_cap:'.length).trim() || null
    } else if (t.startsWith('travel_notes:')) {
      notes = t.slice('travel_notes:'.length).trim() || null
    }
  }

  return { travel_scope: scope, travel_regions: regions, travel_cap: cap, travel_notes: notes }
}
