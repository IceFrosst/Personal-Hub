// Tiny WebAudio-generated blips — no audio assets, no on/off toggle. Sound is
// on by default for everyone; every call site is already triggered from a
// user gesture (click/tap/change handlers), which is what actually matters
// for autoplay policies — browsers only need ONE prior gesture anywhere on
// the page to let a *new* AudioContext produce sound, and every gesture here
// re-attempts `resume()` as a best-effort nudge in case it started suspended.

function isBrowser() {
  return typeof window !== 'undefined'
}

let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (!isBrowser()) return null
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext }
  const Ctor = window.AudioContext || w.webkitAudioContext
  if (!Ctor) return null
  if (!sharedCtx) sharedCtx = new Ctor()
  if (sharedCtx.state === 'suspended') {
    // Only succeeds inside a user-gesture call stack, which every call site
    // below already is — best-effort, never blocks or throws either way.
    void sharedCtx.resume().catch(() => {})
  }
  return sharedCtx
}

function beep(freq: number, durationMs: number, type: OscillatorType = 'square', gain = 0.05) {
  const ctx = getCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.value = gain
  osc.connect(g)
  g.connect(ctx.destination)
  const now = ctx.currentTime
  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000)
  osc.start(now)
  osc.stop(now + durationMs / 1000)
}

export function playStampThunk() {
  beep(90, 140, 'square', 0.12)
}

export function playTypewriterClick() {
  beep(1400 + Math.random() * 300, 18, 'square', 0.03)
}

export function playBeep() {
  beep(660, 90, 'sine', 0.05)
}
