import type { IngestRow } from './devpost'

// Annual / government / no-API mega events. These rarely appear on Devpost/MLH
// until late (or never). We emit a synthetic upcoming row when we're inside the
// typical registration watch window so the radar surfaces "registration may be
// opening" rather than missing the event entirely.
//
// Agent / human job: when real dates are confirmed, promote the row into
// known-events.ts with exact starts_at + registration_deadline.

export type Watch = {
  id: string
  title: string
  url: string
  location_raw: string | null
  format: 'online' | 'in_person' | 'hybrid' | null
  themes: string[]
  // Month windows (1-12) when registration typically opens / event runs.
  // If current month is in regMonths OR eventMonths, emit a placeholder row.
  regMonths: number[]
  eventMonths: number[]
  // Approximate next event start (ISO) — update yearly.
  approxStartsAt: string
  approxEndsAt?: string
  approxRegDeadline?: string
  prize_pool?: string | null
  notes?: string
}

export const WATCHES: Watch[] = [
  {
    id: 'smart-india-hackathon',
    title: 'Smart India Hackathon',
    url: 'https://www.sih.gov.in/',
    location_raw: 'India (multiple cities)',
    format: 'hybrid',
    themes: ['india', 'government', 'student'],
    regMonths: [7, 8, 9, 10],
    eventMonths: [8, 9, 10, 11, 12],
    approxStartsAt: '2026-08-15T00:00:00.000Z',
    approxRegDeadline: '2026-08-01T00:00:00.000Z',
    notes: 'Largest India student hackathon — confirm on sih.gov.in',
  },
  {
    id: 'adventurex-china',
    title: 'AdventureX',
    url: 'https://adventure-x.org/en',
    location_raw: 'Hangzhou, China',
    format: 'in_person',
    themes: ['china', 'student', 'builder'],
    regMonths: [4, 5, 6, 7],
    eventMonths: [7],
    approxStartsAt: '2026-07-20T00:00:00.000Z',
    prize_pool: '150000+ USD',
    notes: 'China largest builder hackathon',
  },
  {
    id: 'nasa-space-apps',
    title: 'NASA Space Apps Challenge',
    url: 'https://www.spaceappschallenge.org/',
    location_raw: 'Global (local + online)',
    format: 'hybrid',
    themes: ['space', 'nasa', 'global'],
    regMonths: [8, 9, 10],
    eventMonths: [10],
    approxStartsAt: '2026-10-04T00:00:00.000Z',
    approxRegDeadline: '2026-09-20T00:00:00.000Z',
  },
  {
    id: 'google-solution-challenge',
    title: 'Google Solution Challenge',
    url: 'https://developers.google.com/community/gdsc-solution-challenge',
    location_raw: 'Global',
    format: 'online',
    themes: ['google', 'gdsc', 'student'],
    regMonths: [1, 2, 3],
    eventMonths: [2, 3, 4],
    approxStartsAt: '2027-02-01T00:00:00.000Z',
    approxRegDeadline: '2027-02-15T00:00:00.000Z',
  },
  {
    id: 'singapore-india-hackathon',
    title: 'Singapore–India Hackathon 2026',
    url: 'https://iie.smu.edu.sg/singapore-india-hackathon-2026',
    location_raw: 'Singapore (SMU)',
    format: 'in_person',
    themes: ['singapore', 'india', 'student'],
    regMonths: [8, 9, 10, 11],
    eventMonths: [11],
    approxStartsAt: '2026-11-15T00:00:00.000Z',
    approxEndsAt: '2026-11-17T00:00:00.000Z',
    approxRegDeadline: '2026-10-15T00:00:00.000Z',
  },
  {
    id: 'hackust',
    title: 'HackUST',
    url: 'https://hack.ust.hk/',
    location_raw: 'Hong Kong (HKUST)',
    format: 'in_person',
    themes: ['hongkong', 'student'],
    regMonths: [2, 3, 4],
    eventMonths: [4],
    approxStartsAt: '2027-04-01T00:00:00.000Z',
  },
  {
    id: 'nus-hacknroll',
    title: 'NUS Hack&Roll',
    url: 'https://hacknroll.nushackers.org/',
    location_raw: 'Singapore (NUS)',
    format: 'in_person',
    themes: ['singapore', 'student'],
    regMonths: [12, 1],
    eventMonths: [1],
    approxStartsAt: '2027-01-17T00:00:00.000Z',
  },
  {
    id: 'codefest-singapore',
    title: 'CodeFest Singapore',
    url: 'https://www.scs.org.sg/',
    location_raw: 'Singapore',
    format: 'in_person',
    themes: ['singapore', 'youth'],
    regMonths: [5, 6, 7],
    eventMonths: [7, 8],
    approxStartsAt: '2026-08-01T00:00:00.000Z',
  },
]

export function watchesToRows(now = new Date()): IngestRow[] {
  const month = now.getUTCMonth() + 1
  const nowMs = now.getTime()
  const rows: IngestRow[] = []

  for (const w of WATCHES) {
    const inWindow = w.regMonths.includes(month) || w.eventMonths.includes(month)
    if (!inWindow) continue
    const starts = w.approxStartsAt
    if (Date.parse(starts) <= nowMs) continue

    rows.push({
      source: 'watch',
      source_id: w.id,
      title: w.title,
      url: w.url,
      starts_at: starts,
      ends_at: w.approxEndsAt ?? null,
      location_raw: w.location_raw,
      format: w.format,
      prize_pool: w.prize_pool ?? null,
      registration_deadline: w.approxRegDeadline ?? null,
      themes: w.themes,
    })
  }
  return rows
}
