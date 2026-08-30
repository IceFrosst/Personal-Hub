// Consulate appointment slot pools + deterministic weekly scarcity.
//
// Deliberately shaped so a future Google Calendar-backed implementation can
// replace `getAvailableSlots` in lib/api.ts without touching call sites: same
// signature (visaType in, Promise<Slot[]> out). For now it's a seeded
// pseudo-random pick out of a fixed joke-label pool, stable for the whole
// ISO week so "scarcity" doesn't reshuffle on every reload.

import type { VisaType, SlotLabelCandidate } from './content'
import { BASE_SLOT_LABELS, FIANCE_SLOT_LABELS, BUSINESS_SLOT_LABELS, SLOT_AVAILABLE_LABEL } from './content'

export interface Slot {
  time: string
  label: string
  available: boolean
}

function candidatesFor(visaType: VisaType | null): SlotLabelCandidate[] {
  const extra = visaType === 'fiance' ? FIANCE_SLOT_LABELS : visaType === 'business' ? BUSINESS_SLOT_LABELS : []
  return [...BASE_SLOT_LABELS, ...extra]
}

// ISO week number (1-53), stable per calendar week.
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

// mulberry32 — tiny deterministic PRNG from a numeric seed.
function mulberry32(seed: number) {
  let t = seed
  return function next() {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function weekSeed(visaType: VisaType | null, at: Date): number {
  const week = isoWeekNumber(at)
  const key = `${at.getUTCFullYear()}-W${week}-${visaType ?? 'any'}`
  return hashString(key)
}

/** Picks 2-3 candidate indices as "available", stable for the whole ISO week. */
function pickAvailableIndices(poolSize: number, seed: number): Set<number> {
  const rng = mulberry32(seed)
  const min = 2
  const max = 3
  const howMany = Math.min(poolSize, min + Math.floor(rng() * (max - min + 1)))

  const order = Array.from({ length: poolSize }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return new Set(order.slice(0, howMany))
}

/** Synchronous core so it can be reused directly in tests / the async wrapper. */
export function computeSlots(visaType: VisaType | null, at: Date = new Date()): Slot[] {
  const pool = candidatesFor(visaType)
  const available = pickAvailableIndices(pool.length, weekSeed(visaType, at))
  return pool.map((candidate, i) => ({
    time: candidate.time,
    label: available.has(i) ? SLOT_AVAILABLE_LABEL : candidate.unavailableLabel,
    available: available.has(i),
  }))
}
