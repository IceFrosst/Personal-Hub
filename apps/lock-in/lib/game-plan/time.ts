// Timezone helpers built on Intl only (no dependency). Everything the planner
// reasons about is local wall-clock time in the user's IANA timezone.

/** 'YYYY-MM-DD' for the current date in the given timezone. */
export function todayInTz(timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Current 'HH:MM' in the given timezone. */
export function nowLocalHM(timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

/**
 * UTC offset for a date in a timezone, e.g. '+03:00'. DST-correct because it's
 * evaluated for that specific date. Returns 'Z' for UTC.
 */
export function offsetForDate(date: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
  }).formatToParts(new Date(`${date}T12:00:00Z`))
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
  const m = name.match(/GMT([+-]\d{2}:?\d{2})?/)
  if (!m || !m[1]) return 'Z'
  const off = m[1].includes(':') ? m[1] : `${m[1].slice(0, 3)}:${m[1].slice(3)}`
  return off
}

/** ISO instants for the start and end of a local day, for freeBusy queries. */
export function dayBoundsIso(
  date: string,
  timeZone: string
): { timeMin: string; timeMax: string } {
  const off = offsetForDate(date, timeZone)
  return {
    timeMin: `${date}T00:00:00${off}`,
    timeMax: `${date}T23:59:59${off}`,
  }
}

/** Convert an ISO instant to 'HH:MM' in the given timezone. */
export function isoToLocalHM(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** 'HH:MM' → minutes since midnight. */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
