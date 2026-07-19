/**
 * High-value Tier A circuits whose *last* edition is over.
 * Do not invent next-year calendar rows.
 * Weekly probe watches these URLs; when reg-open language appears,
 * surface an alert — then a human/agent seeds the real dates.
 */
export type DormantCircuit = {
  id: string
  label: string
  siteUrl: string
  paths: string[]
  lastEdition: string
  nextExpectedWindow: string
  reason: string
}

export const DORMANT_TIER_A: DormantCircuit[] = [
  {
    id: 'treehacks',
    label: 'TreeHacks',
    siteUrl: 'https://treehacks.com/',
    paths: ['/', '/faq'],
    lastEdition: '2026-02-13 (TreeHacks 2026 — completed)',
    nextExpectedWindow: 'Applications typically open fall (Sep–Nov) for Feb event',
    reason: 'Site still shows 2026; apps closed; wait for TreeHacks 2027 open',
  },
  {
    id: 'pennapps',
    label: 'PennApps',
    siteUrl: 'https://pennapps.com/',
    paths: ['/', '/faq'],
    lastEdition: '2025-09-19 (PennApps XXVI — completed)',
    nextExpectedWindow: 'Historically late spring / summer apps for fall event',
    reason: 'Last public edition Sep 2025; do not show placeholder 2026/27 until apply opens',
  },
]
