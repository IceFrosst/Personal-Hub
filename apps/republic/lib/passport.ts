// localStorage "stamp log" — a rolling, capped list of stamp events, purely
// client-side memory. Used as an append-only audit trail of what happened
// during a session (visa selected, appointment confirmed, biometrics
// submitted, etc. — see the addStamp() call sites throughout app/*).
//
// This file used to also track a per-browser visit count, which powered a
// "returning visitor" / "frequent applicant" (loyalty) message and a
// passport-stamps-on-file line on the landing page. That whole repeat-visitor
// detection feature was removed per owner feedback — the landing must not
// detect or display anything about prior visits — so the visit counter
// (`registerVisit`, the old `visits` field) is gone too. The stamp log itself
// was kept: it's still useful as a lightweight local activity trail, it just
// no longer has anything to do with visit counting.

const STAMPS_KEY = 'republic:stamps'

export interface PassportState {
  stamps: string[]
}

function isBrowser() {
  return typeof window !== 'undefined'
}

export function getPassport(): PassportState {
  if (!isBrowser()) return { stamps: [] }
  try {
    const stamps = JSON.parse(window.localStorage.getItem(STAMPS_KEY) ?? '[]') as string[]
    return { stamps }
  } catch {
    return { stamps: [] }
  }
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
