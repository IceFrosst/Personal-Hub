import type { HackathonFormat } from '@/lib/types'

// Layer-1 travel detection: a curated registry of hackathon circuits that run a
// DOCUMENTED, standing travel-funding program — travel scholarships or
// reimbursement offered as a matter of course to accepted/finalist hackers.
//
// IMPORTANT: Circuit knowledge is only a fallback. Enrichment always runs first
// and tries to confirm travel from the event page / FAQ. The circuit prior only
// fills when the page extraction returns null (common for JS-only SPAs).
// An explicit page finding of false always wins over the prior.
//
// Rules for adding a circuit:
//   1. The travel program is public and consistent across the circuit's events.
//   2. Cite the evidence in a comment.
//   3. Match tightly so unrelated events don't inherit it.

type Circuit = {
  name: string
  source?: string
  titlePattern?: RegExp
  // Optional extra paths to try when the main event URL is a thin SPA
  faqPaths?: string[]
}

const CIRCUITS: Circuit[] = [
  {
    // ETHGlobal — travel scholarships on every flagship in-person event.
    // Policy: ethglobal.com event pages ("Travel Support").
    name: 'ETHGlobal',
    source: 'ethglobal',
    titlePattern: /eth\s?global/i,
    faqPaths: ['/faq', '/travel', '/perks'],
  },
  {
    // CASSINI (EU space) — reimburses travel + accommodation for finals teams.
    // Arrive via Taikai. Policy: cassini.eu.
    name: 'CASSINI',
    titlePattern: /\bcassini\b/i,
  },
  {
    // EUDIS (European Defence Innovation Scheme) — covers travel/stay for on-site rounds.
    name: 'EUDIS',
    titlePattern: /\beudis\b/i,
  },
  {
    // Copernicus (EU Earth-observation) — funds travel to regional on-site events.
    name: 'Copernicus',
    titlePattern: /\bcopernicus\b/i,
  },
  {
    // Junction — limited travel grants (up to €300 for 2026 main event, confirmed).
    // Main event Nov 13–15 2026 Espoo. Also JunctionX satellite events.
    name: 'Junction',
    titlePattern: /\bjunction\b/i,
    faqPaths: ['/faq', '/travel', '/info'],
  },
]

export function circuitTravelCovered(row: {
  source: string
  title: string
  format: HackathonFormat | null
}): true | null {
  if (row.format === 'online') return null
  const title = row.title ?? ''
  const hit = CIRCUITS.some(
    (c) =>
      (c.source !== undefined && c.source === row.source) ||
      (c.titlePattern !== undefined && c.titlePattern.test(title))
  )
  return hit ? true : null
}

/** Extra FAQ-style paths to try when the main page is thin / SPA for a circuit event. */
export function circuitFaqPaths(row: { source: string; title: string }): string[] {
  const title = row.title ?? ''
  for (const c of CIRCUITS) {
    const match =
      (c.source !== undefined && c.source === row.source) ||
      (c.titlePattern !== undefined && c.titlePattern.test(title))
    if (match && c.faqPaths) return c.faqPaths
  }
  return []
}
