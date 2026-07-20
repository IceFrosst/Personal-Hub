/**
 * Circuits whose last edition is over — probe for next reg only.
 * Do not invent calendar rows.
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
    lastEdition: '2026-04-24 (HackUPC 2026 — completed)',
    nextExpectedWindow: 'Winter/spring apps for spring Barcelona event',
    reason: '2026 over; strong EU travel policy historically',
  },
  {
    id: 'jaunaragiai-make-it-real',
    label: 'MAKE IT REAL! (Jaunaragiai)',
    siteUrl: 'https://www.jaunaragiai.lt/en/make-it-real',
    paths: ['/', 'https://www.jaunaragiai.lt/en'],
    lastEdition: '2026-05-14 (Vilnius — completed)',
    nextExpectedWindow: 'Typically Feb–Apr apps for mid-May event',
    reason: 'Nordic Council Prosperous Future; travel for internationals historically',
  },
  {
    id: 'garage48',
    label: 'Garage48',
    siteUrl: 'https://garage48.org/',
    paths: ['/'],
    lastEdition: 'Rolling series — check site for next edition',
    nextExpectedWindow: 'Multiple per year; watch garage48.org/events',
    reason: 'Estonia flagship startup hack series',
  },
]
