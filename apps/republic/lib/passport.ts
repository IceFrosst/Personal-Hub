// localStorage "passport" — visit count + stamps, purely client-side memory.

const VISITS_KEY = 'republic:visits'
const STAMPS_KEY = 'republic:stamps'

export interface PassportState {
  visits: number
  stamps: string[]
}

function isBrowser() {
  return typeof window !== 'undefined'
}

export function getPassport(): PassportState {
  if (!isBrowser()) return { visits: 0, stamps: [] }
  try {
    const visits = Number(window.localStorage.getItem(VISITS_KEY) ?? '0')
    const stamps = JSON.parse(window.localStorage.getItem(STAMPS_KEY) ?? '[]') as string[]
    return { visits, stamps }
  } catch {
    return { visits: 0, stamps: [] }
  }
}

/** Call once per landing-page view. Returns the visit count *after* incrementing. */
export function registerVisit(): number {
  if (!isBrowser()) return 0
  const current = getPassport()
  const next = current.visits + 1
  try {
    window.localStorage.setItem(VISITS_KEY, String(next))
  } catch {
    // ignore
  }
  return next
}

export function addStamp(label: string) {
  if (!isBrowser()) return
  const { stamps } = getPassport()
  const updated = [...stamps, label].slice(-50)
  try {
    window.localStorage.setItem(STAMPS_KEY, JSON.stringify(updated))
  } catch {
    // ignore
  }
}
