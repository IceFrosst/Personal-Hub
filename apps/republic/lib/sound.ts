// Tiny WebAudio-generated blips — no audio assets. Gated by the "I consent to
// noise" toggle (localStorage). Everything is a short oscillator burst so the
// bundle cost is ~zero.

const SOUND_KEY = 'republic:sound-enabled'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function isSoundEnabled(): boolean {
  if (!isBrowser()) return false
  return window.localStorage.getItem(SOUND_KEY) === '1'
}

export function setSoundEnabled(enabled: boolean) {
  if (!isBrowser()) return
  window.localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
}

let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (!isBrowser()) return null
  const w = window as typeof window & { webkitAudioContext?: typeof AudioContext }
  const Ctor = window.AudioContext || w.webkitAudioContext
  if (!Ctor) return null
  if (!sharedCtx) sharedCtx = new Ctor()
  return sharedCtx
}

function beep(freq: number, durationMs: number, type: OscillatorType = 'square', gain = 0.05) {
  if (!isSoundEnabled()) return
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
