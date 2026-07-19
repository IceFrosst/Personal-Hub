import type { HackathonFormat } from '@/lib/types'

// Layer-1 travel detection: a curated registry of hackathon circuits that run a
// DOCUMENTED, standing travel-funding program — travel scholarships or
// reimbursement offered as a matter of course to accepted/finalist hackers, not a
// one-off. This is how the biggest global travel-funders reach the radar as
// "Travel ✓" even when page-scraping can't read their perks (ETHGlobal, CASSINI and
// friends all serve JS-only pages the enricher gets nothing useful from).
//
// This is NOT a generic guess and must not become one. Rules for adding a circuit:
//   1. The travel program is public and consistent across the circuit's events.
//   2. Cite it in a comment on the entry.
//   3. Match tightly (a distinctive name/source) so unrelated events don't inherit it.
// It only ever raises `travel_covered` from unknown → true, and never for online
// events (no travel needed). An explicit "travel not covered" found on a page still
// wins (see run.ts), so a mislabelled entry degrades gracefully.

type Circuit = {
  name: string
  // Matched against the ingest source id (catches every event from a dedicated
  // scraper) and/or the title (catches the circuit's events wherever they surface,
  // e.g. an ETHGlobal event cross-posted to Devfolio).
  source?: string
  titlePattern?: RegExp
}

const CIRCUITS: Circuit[] = [
  {
    // ETHGlobal runs one travel-scholarship program across every flagship in-person
    // hackathon worldwide — Cannes/Prague/Brussels (EU), New York/San Francisco (US),
    // Bangkok/Singapore/Taipei/New Delhi (Asia). ethglobal.com/events is an RSC SPA
    // the enricher can't read, so this prior is the only path to Travel ✓ for them.
    // Policy: ethglobal.com — "Travel Support" / scholarships on every event page.
    name: 'ETHGlobal',
    source: 'ethglobal',
    titlePattern: /eth\s?global/i,
  },
  {
    // CASSINI Hackathons (EU space programme) reimburse travel + accommodation for
    // teams invited to the in-person finals. Arrive via Taikai. Policy: cassini.eu.
    name: 'CASSINI',
    titlePattern: /\bcassini\b/i,
  },
  {
    // EUDIS (European Defence Innovation Scheme) hackathon covers travel/stay for the
    // on-site rounds across its EU host cities. Arrive via Taikai. Policy: eutdis/EDF.
    name: 'EUDIS',
    titlePattern: /\beudis\b/i,
  },
  {
    // Copernicus Hackathons (EU Earth-observation programme) fund travel to their
    // regional on-site events. Policy: copernicus.eu hackathon terms.
    name: 'Copernicus',
    titlePattern: /\bcopernicus\b/i,
  },
  {
    // Junction (Helsinki) historically offers travel support / scholarships for
    // accepted participants from outside Finland.
    name: 'Junction',
    titlePattern: /\bjunction\b/i,
  },
]

// true  → row belongs to a known travel-funding circuit and isn't online.
// null  → no circuit knowledge; let page-based detection decide.
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
