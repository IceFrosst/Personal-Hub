import type { IngestRow } from './devpost'

export type Watch = {
  id: string
  title: string
  url: string
  location_raw: string | null
  format: 'online' | 'in_person' | 'hybrid' | null
  themes: string[]
  regMonths: number[]
  eventMonths: number[]
  approxStartsAt: string
  approxEndsAt?: string
  approxRegDeadline?: string
  prize_pool?: string | null
  notes?: string
}

export const WATCHES: Watch[] = [
  // --- Poland ---
  {
    id: 'hackyeah',
    title: 'HackYeah',
    url: 'https://hackyeah.pl/',
    location_raw: 'Kraków, Poland',
    format: 'in_person',
    themes: ['poland', 'europe', 'student'],
    regMonths: [6, 7, 8, 9],
    eventMonths: [10],
    approxStartsAt: '2026-10-03T07:00:00.000Z',
    approxEndsAt: '2026-10-04T16:00:00.000Z',
    approxRegDeadline: '2026-09-25T21:59:59.000Z',
    notes: 'Europe largest on-site — Tauron Arena Kraków',
  },
  // --- Finland ---
  {
    id: 'junction-main',
    title: 'Junction',
    url: 'https://www.hackjunction.com/',
    location_raw: 'Espoo / Helsinki, Finland',
    format: 'in_person',
    themes: ['finland', 'europe', 'hardware', 'ai'],
    regMonths: [8, 9, 10],
    eventMonths: [11],
    approxStartsAt: '2026-11-13T08:00:00.000Z',
    approxEndsAt: '2026-11-15T18:00:00.000Z',
    approxRegDeadline: '2026-10-15T23:59:59.000Z',
    prize_pool: '100000+ EUR',
    notes: 'Europe flagship 48h — also seeded in known-events',
  },
  // --- Germany ---
  {
    id: 'junction-platform-de',
    title: 'Junction platform events (DE satellites)',
    url: 'https://hackjunction.app/hackathons',
    location_raw: 'Germany / Europe',
    format: 'in_person',
    themes: ['germany', 'europe'],
    regMonths: [1, 2, 3, 4, 5, 6, 9, 10, 11],
    eventMonths: [3, 4, 5, 6, 9, 10, 11],
    approxStartsAt: '2026-09-20T08:00:00.000Z',
    approxRegDeadline: '2026-09-05T21:59:59.000Z',
    notes: 'Probe hackjunction.app for open DE/EU editions',
  },
  // --- Netherlands ---
  {
    id: 'edth-netherlands',
    title: 'European Defense Tech Hackathon — Netherlands',
    url: 'https://lu.ma/eurodefensetech',
    location_raw: 'Netherlands',
    format: 'in_person',
    themes: ['netherlands', 'defense', 'europe'],
    regMonths: [2, 3, 4, 5],
    eventMonths: [4, 5],
    approxStartsAt: '2027-04-10T08:00:00.000Z',
    approxRegDeadline: '2027-03-20T21:59:59.000Z',
    notes: '2026 NL edition was Apr; watch Luma calendar for next',
  },
  // --- Baltics (kept) ---
  {
    id: 'garage48',
    title: 'Garage48',
    url: 'https://garage48.org/',
    location_raw: 'Estonia (rotating cities)',
    format: 'in_person',
    themes: ['estonia', 'baltic', 'startup'],
    regMonths: [2, 3, 4, 5, 8, 9, 10],
    eventMonths: [3, 5, 8, 10],
    approxStartsAt: '2026-10-16T07:00:00.000Z',
    approxEndsAt: '2026-10-18T16:00:00.000Z',
    approxRegDeadline: '2026-10-05T21:59:59.000Z',
  },
  {
    id: 'jaunaragiai-make-it-real',
    title: 'MAKE IT REAL! (Jaunaragiai)',
    url: 'https://www.jaunaragiai.lt/en/make-it-real',
    location_raw: 'Vilnius, Lithuania',
    format: 'in_person',
    themes: ['lithuania', 'baltic', 'youth', 'nordic'],
    regMonths: [2, 3, 4],
    eventMonths: [5],
    approxStartsAt: '2027-05-14T07:00:00.000Z',
    approxEndsAt: '2027-05-16T16:00:00.000Z',
    approxRegDeadline: '2027-04-20T21:59:59.000Z',
  },
  {
    id: 'startup-day-hack',
    title: 'sTARTUp Day side-hack / build events',
    url: 'https://www.startupday.ee/',
    location_raw: 'Tartu, Estonia',
    format: 'in_person',
    themes: ['estonia', 'startup'],
    regMonths: [11, 12, 1],
    eventMonths: [1],
    approxStartsAt: '2027-01-28T08:00:00.000Z',
    approxRegDeadline: '2027-01-10T21:59:59.000Z',
  },
  {
    id: 'eurodefense-circuit',
    title: 'European Defense Tech Hackathon (circuit)',
    url: 'https://lu.ma/eurodefensetech',
    location_raw: 'Europe (rotating)',
    format: 'in_person',
    themes: ['defense', 'europe'],
    regMonths: [1, 2, 3, 4, 5, 6, 9, 10],
    eventMonths: [2, 3, 4, 5, 6],
    approxStartsAt: '2026-09-15T08:00:00.000Z',
    approxRegDeadline: '2026-09-01T21:59:59.000Z',
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
    if (!w.approxRegDeadline || Date.parse(w.approxRegDeadline) <= nowMs) continue

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
      registration_deadline: w.approxRegDeadline,
      themes: w.themes,
    })
  }
  return rows
}
