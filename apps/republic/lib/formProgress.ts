// Tracks which FORM 1G-NAS progress-card fields (components/DocumentProgress.tsx)
// have already played their one-time reveal animation this browser session,
// so refreshing mid-funnel never replays the "stamp-in" for a field that was
// already filled before the refresh. Session-scoped (not the funnel's own
// sessionStorage key) and reset alongside it whenever the landing page
// restarts the funnel.

const ANIMATED_KEY = 'republic:progress-animated'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function getAnimatedFields(): Set<string> {
  if (!isBrowser()) return new Set()
  try {
    const raw = window.sessionStorage.getItem(ANIMATED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function markFieldAnimated(key: string) {
  if (!isBrowser()) return
  try {
    const set = getAnimatedFields()
    set.add(key)
    window.sessionStorage.setItem(ANIMATED_KEY, JSON.stringify([...set]))
  } catch {
    // ignore quota errors — worst case a field re-animates once
  }
}

export function clearAnimatedFields() {
  if (!isBrowser()) return
  try {
    window.sessionStorage.removeItem(ANIMATED_KEY)
  } catch {
    // ignore
  }
}
