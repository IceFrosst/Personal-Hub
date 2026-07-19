/**
 * High-value circuits whose last edition is over.
 * Do not invent next-year calendar rows.
 * Weekly probe watches these URLs; when reg-open language appears,
 * surface an alert — then seed real dates.
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
    reason: 'Last public edition Sep 2025; do not show placeholder until apply opens',
  },
  {
    id: 'hackupc',
    label: 'HackUPC',
    siteUrl: 'https://hackupc.com/',
    paths: ['/', '/faq', 'https://my.hackupc.com/'],
    lastEdition: '2026-04-24 (HackUPC 2026 Apr 24–26 Barcelona — completed)',
    nextExpectedWindow: 'Typically winter/spring apps for spring event in Barcelona',
    reason:
      '2026 edition over (Jul 2026); site may still show Apply — do not seed until 2027 dates/reg confirmed. Strong EU travel policy historically.',
  },
]
