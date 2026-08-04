import type {
  AiStatus,
  FixedRecurringInput,
  FlexRecurringInput,
  PlannableTask,
  ProposedBlock,
} from './types'
import { hmToMinutes } from './time'

export interface PlanResult {
  blocks: ProposedBlock[]
  ai: AiStatus
}

export interface PlanInput {
  tasks: PlannableTask[]
  recurringFixed: FixedRecurringInput[] // pinned-time routines
  recurringFlex: FlexRecurringInput[] // auto-placed routines (known duration)
  busy: { start: string; end: string }[] // local 'HH:MM' ranges already blocked
  workStart: string // 'HH:MM'
  workEnd: string // 'HH:MM'
  earliestStart: string // 'HH:MM' — don't schedule before this (max of workStart / now)
  today: string // 'YYYY-MM-DD'
  deepWorkCount: number
  deepWorkMinMinutes: number
  deepWorkMaxMinutes: number
}

// Primary model is swappable via GEMINI_MODEL (default rolling free alias
// 'gemini-flash-latest'). 'gemini-2.5-pro' has no real free tier (429s). We try
// the primary, then a lighter model if it's overloaded — flash 503s ("high
// demand") are common and transient, so each model also gets one quick retry.
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'
const GEMINI_MODELS = Array.from(new Set([PRIMARY_MODEL, 'gemini-flash-lite-latest']))
const modelUrl = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`

/**
 * Ask Gemini for JSON, resilient to transient overload: try each model up to
 * twice (one quick backoff on 5xx), then move to the next model. Throws with the
 * last status in the message so callers can tell a 429 from other failures.
 */
async function generateJson(prompt: string, key: string): Promise<string> {
  let last = 'unknown'
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${modelUrl(model)}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      })
      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[]
        }
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) return text
        last = 'empty'
        break // empty output from this model — try the next one
      }
      last = String(res.status)
      if ([500, 502, 503, 504].includes(res.status) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 700))
        continue
      }
      break // 429 or other non-retryable — move to the next model
    }
  }
  throw new Error(`Gemini failed ${last}`)
}

const DEFAULT_MINUTES: Record<'low' | 'medium' | 'high', number> = {
  high: 60,
  medium: 45,
  low: 30,
}
const GAP = 5
/** Breathing room between two Deep Work sessions — never back-to-back. */
const SESSION_BREAK = 30

/**
 * Tasks that want a slot on the clock rather than a seat in a focus session:
 * errands and appointments. Everything else (focus work) lives inside a Deep
 * Work session, added by hand — so it is deliberately not time-boxed here.
 */
export function isErrand(task: { category: string | null; priority: string | null }): boolean {
  // No priority = a plain to-do the planner never places on its own.
  if (task.priority == null) return false
  return task.category === 'social' || task.category === 'other'
}

/**
 * Build the day around **Deep Work sessions** instead of time-boxing every task:
 *   1. **Fixed-time routines** — pinned to their clock time (slide to the nearest
 *      free slot only if that exact time is busy).
 *   2. **Flexible routines** — reserved next, longest first, so a big routine
 *      (e.g. a 2 h workout) is guaranteed room.
 *   3. **Deep Work sessions** — 1–2 long focus blocks carved out of the biggest
 *      remaining free stretches. They start empty; tasks are added to them by hand.
 *   4. **Errands** (`social` / `other` tasks) — short real-world things that need
 *      a time of their own, packed into what's left.
 *
 * Everything is placed against a single running `occupied` list, so the output
 * cannot double-book. There is no model call in this path — durations here are
 * either exact (routines) or a priority default (errands), which is why the old
 * AI schedule/reorder passes (and the overlap bugs they caused) are gone.
 */
export async function planDay(input: PlanInput): Promise<PlanResult> {
  const winStart = hmToMinutes(input.earliestStart)
  const winEnd = hmToMinutes(input.workEnd)

  const occupied: Array<[number, number]> = input.busy
    .map((b) => [hmToMinutes(b.start), hmToMinutes(b.end)] as [number, number])
    .filter(([s, e]) => e > s)

  // Where the day's meals land, whether they were pinned or auto-placed. The
  // workout anchors to these, so a meal set as a **fixed** routine has to count
  // exactly like a flexible one — missing that is what let lunch sit before
  // exercise even with the rule in place.
  const mealStarts: number[] = []
  // Lunch/dinner only (not breakfast) — the morning focus session has to land
  // before these, and before the workout that gets anchored to them.
  const mainMealStarts: number[] = []

  // Phase 1 — fixed-time routines, pinned.
  const out: ProposedBlock[] = []
  const sessions: ProposedBlock[] = []
  for (const r of [...input.recurringFixed].sort(
    (a, b) => hmToMinutes(a.fixedTime) - hmToMinutes(b.fixedTime)
  )) {
    const dur = Math.max(5, r.durationMinutes)
    const start = findNearestSlot(hmToMinutes(r.fixedTime), dur, occupied, winStart, winEnd)
    if (start == null) continue
    occupied.push([start, start + dur])
    const natural = naturalMinutes(r.title)
    if (natural != null) {
      mealStarts.push(start)
      if (natural >= 12 * 60) mainMealStarts.push(start)
    }
    out.push(routineBlock(r.id, r.title, start, dur))
  }

  const addSession = (start: number, dur: number, breakAfter = true) => {
    // Reserve the session plus a break, so two sessions never run back-to-back.
    // A session that ends at a meal needs no break — the meal is the break, and
    // reserving one would only shove lunch half an hour later.
    occupied.push([start, Math.min(winEnd, start + dur + (breakAfter ? SESSION_BREAK : 0))])
    const block: ProposedBlock = {
      task_id: null,
      recurring_id: null,
      title: 'Deep Work',
      start: toHM(start),
      end: toHM(start + dur),
      estimated_minutes: dur,
      category: null,
      priority: null,
      kind: 'deep_work',
    }
    sessions.push(block)
    out.push(block)
  }

  // **Protect the morning: one focus session before you train and eat.** Carved
  // before the workout is placed, because the workout otherwise takes the whole
  // pre-lunch stretch and leaves nothing big enough in front of it. Where a
  // morning session and an exercise→lunch pairing can't both fit, this wins and
  // the workout pairs with dinner instead — both orderings the user asked for.
  if (input.deepWorkCount > 0) {
    const plannedMeals = [
      ...mainMealStarts,
      ...(input.recurringFlex
        .map((r) => naturalMinutes(r.title))
        .filter((n): n is number => n != null && n >= 12 * 60)),
    ]
    const firstMeal = plannedMeals.length ? Math.min(...plannedMeals) : winEnd
    const morning = freeGaps(occupied, winStart, winEnd)
      .filter(([s, e]) => s < firstMeal && Math.min(e, firstMeal) - s >= input.deepWorkMinMinutes)
      .sort((a, b) => a[0] - b[0])[0]
    if (morning) {
      const until = Math.min(morning[1], firstMeal)
      const dur = Math.min(input.deepWorkMaxMinutes, until - morning[0])
      addSession(morning[0], dur, morning[0] + dur < firstMeal)
    }
  }

  // Phase 2 — flexible routines, longest first, before anything else competes.
  // Each goes to the *roomiest* gap rather than the first free minute: packing
  // them from the top of the day stacked meals back-to-back (lunch at 14:00,
  // dinner at 14:45) and left the rest of the day in one unusable lump.
  // Spreading them keeps meals near their natural hours and leaves bigger
  // stretches behind for focus sessions.
  const flex = [...input.recurringFlex]
  // Meals belong at meal times. Place those near their natural hour first, so a
  // long routine can't take the lunch slot and leave you eating at 10:45.
  const meals = flex
    .filter((r) => naturalMinutes(r.title) != null)
    .sort((a, b) => (naturalMinutes(a.title) as number) - (naturalMinutes(b.title) as number))
  const workouts = flex.filter((r) => naturalMinutes(r.title) == null && isWorkout(r.title))
  const theRest = flex
    .filter((r) => naturalMinutes(r.title) == null && !isWorkout(r.title))
    .sort((a, b) => b.durationMinutes - a.durationMinutes)

  for (const r of meals) {
    const dur = Math.max(5, r.durationMinutes)
    const start = findNearestSlot(
      naturalMinutes(r.title) as number,
      dur,
      occupied,
      winStart,
      winEnd
    )
    if (start == null) continue
    occupied.push([start, start + dur])
    mealStarts.push(start)
    if ((naturalMinutes(r.title) as number) >= 12 * 60) mainMealStarts.push(start)
    out.push(routineBlock(r.id, r.title, start, dur))
  }

  // **You eat after you train.** A workout is placed to finish exactly when a
  // meal begins, so the day reads "exercise → lunch" or "exercise → dinner" —
  // never a meal straight before training, and never a workout stranded between
  // two focus blocks. Falls back to the roomiest gap only if no meal has room
  // in front of it.
  for (const r of workouts) {
    const dur = Math.max(5, r.durationMinutes)
    let start: number | null = null
    for (const mealStart of [...mealStarts].sort((a, b) => a - b)) {
      const from = mealStart - dur
      if (from < winStart) continue
      const fits = freeGaps(occupied, winStart, winEnd).some(([s, e]) => s <= from && e >= mealStart)
      if (fits) {
        start = from
        break
      }
    }
    if (start == null) {
      // Nothing sits directly in front of a meal (a meeting is usually in the
      // way). Keep the *order* even when adjacency is impossible: prefer the
      // roomiest gap that still finishes before a meal, so you never train
      // after your last meal of the day.
      const roomy = freeGaps(occupied, winStart, winEnd)
        .filter(([s, e]) => e - s >= dur)
        .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
      if (roomy.length === 0) continue
      const lastMeal = mealStarts.length ? Math.max(...mealStarts) : null
      const beforeAMeal =
        lastMeal == null ? undefined : roomy.find(([s]) => s + dur <= lastMeal)
      start = (beforeAMeal ?? roomy[0])[0]
    }
    occupied.push([start, start + dur])
    out.push(routineBlock(r.id, r.title, start, dur))
  }

  for (const r of theRest) {
    const dur = Math.max(5, r.durationMinutes)
    const roomy = freeGaps(occupied, winStart, winEnd)
      .filter(([s, e]) => e - s >= dur)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
    if (roomy.length === 0) continue
    const start = roomy[0][0]
    occupied.push([start, start + dur])
    out.push(routineBlock(r.id, r.title, start, dur))
  }

  // Phase 3 — top up to the requested number of sessions from the biggest
  // stretches that are left (the morning one is already reserved above).
  while (sessions.length < Math.max(0, input.deepWorkCount)) {
    const candidates = freeGaps(occupied, winStart, winEnd)
      .filter(([s, e]) => e - s >= input.deepWorkMinMinutes)
      .sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
    if (candidates.length === 0) break
    const [gs, ge] = candidates[0]
    addSession(gs, Math.min(input.deepWorkMaxMinutes, ge - gs))
  }

  // Phase 4 — errands fill the remaining time, earliest gap that fits.
  const errands = input.tasks.filter(isErrand).sort((a, b) => {
    const overdue = (t: PlannableTask) => (t.due_date && t.due_date <= input.today ? 1 : 0)
    if (overdue(a) !== overdue(b)) return overdue(b) - overdue(a)
    const rank = { high: 3, medium: 2, low: 1 } as const
    return rank[b.priority ?? 'medium'] - rank[a.priority ?? 'medium']
  })
  for (const t of errands) {
    const dur = DEFAULT_MINUTES[t.priority ?? 'medium']
    const gap = freeGaps(occupied, winStart, winEnd).find(([s, e]) => e - s >= dur)
    if (!gap) continue
    const start = gap[0]
    occupied.push([start, start + dur + GAP])
    out.push({
      task_id: t.id,
      recurring_id: null,
      title: t.title,
      start: toHM(start),
      end: toHM(start + dur),
      estimated_minutes: dur,
      category: t.category,
      priority: t.priority,
      kind: null,
    })
  }

  const blocks = out.sort((a, b) => hmToMinutes(a.start) - hmToMinutes(b.start))
  return { blocks, ai: 'ok' }
}

/**
 * The hour a routine naturally wants, when its name makes that obvious. Only
 * meals — a flexible routine otherwise has no opinion about when it happens, and
 * guessing would be worse than spreading it into free time. Returns null when
 * there's no clear signal. (A routine that must land at an exact time is a
 * *fixed* routine; this is only a nudge for the flexible ones.)
 */
function naturalMinutes(title: string): number | null {
  const t = title.toLowerCase()
  if (/\bbreakfast\b/.test(t)) return 8 * 60 + 30
  if (/\blunch\b/.test(t)) return 13 * 60
  if (/\b(dinner|supper)\b/.test(t)) return 19 * 60
  return null
}

/** A training routine — the one thing a meal must follow, never precede. */
function isWorkout(title: string): boolean {
  return /\b(exercise|workout|work out|gym|training|run|running|lift|lifting|cardio)\b/i.test(title)
}

function routineBlock(id: string, title: string, start: number, dur: number): ProposedBlock {
  return {
    task_id: null,
    recurring_id: id,
    title,
    start: toHM(start),
    end: toHM(start + dur),
    estimated_minutes: dur,
    category: null,
    priority: null,
    kind: null,
  }
}

/**
 * Estimate one task's duration in minutes from its title. Used when an errand is
 * slotted in on its own (see `insert.ts`); falls back to a priority default when
 * there's no key or the model misbehaves.
 */
export async function estimateTaskMinutes(
  title: string,
  priority: 'low' | 'medium' | 'high' | null,
  key = process.env.GEMINI_API_KEY
): Promise<number> {
  const fallback = DEFAULT_MINUTES[priority ?? 'medium']
  if (!key) return fallback
  try {
    const prompt = `Estimate how many minutes this single to-do task realistically takes for one focused session. Reply ONLY JSON {"minutes": <integer 15-120>}. Task: "${title}"${priority ? ` (priority: ${priority})` : ''}.`
    const text = await generateJson(prompt, key)
    const n = Math.round(Number((JSON.parse(text) as { minutes?: unknown }).minutes))
    if (Number.isFinite(n) && n >= 5) return Math.min(180, n)
  } catch {
    // fall through to the deterministic default
  }
  return fallback
}

/**
 * True if any two of these blocks overlap each other, or a block overlaps a busy
 * interval. A plan with two things booked at once is never worth shipping.
 */
export function hasOverlap(
  blocks: ProposedBlock[],
  busy: Array<[number, number]> = []
): boolean {
  const spans = blocks
    .map((b) => [hmToMinutes(b.start), hmToMinutes(b.end)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])
  for (let i = 1; i < spans.length; i++) {
    if (spans[i][0] < spans[i - 1][1]) return true
  }
  return spans.some(([s, e]) => busy.some(([bs, be]) => s < be && e > bs))
}

/** Nearest free start to `desired` that fits `dur` inside the window, or null. */
function findNearestSlot(
  desired: number,
  dur: number,
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number
): number | null {
  const free = freeGaps(occupied, winStart, winEnd)
  let best: number | null = null
  let bestDist = Infinity
  for (const [gs, ge] of free) {
    if (ge - gs < dur) continue
    const start = Math.max(gs, Math.min(desired, ge - dur))
    const dist = Math.abs(start - desired)
    if (dist < bestDist) {
      bestDist = dist
      best = start
    }
  }
  return best
}

/** Free intervals inside [winStart, winEnd] given occupied ranges. */
export function freeGaps(
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number
): Array<[number, number]> {
  const sorted = [...occupied]
    .filter(([s, e]) => e > winStart && s < winEnd)
    .sort((a, b) => a[0] - b[0])
  const gaps: Array<[number, number]> = []
  let cursor = winStart
  for (const [s, e] of sorted) {
    if (s > cursor) gaps.push([cursor, Math.min(s, winEnd)])
    cursor = Math.max(cursor, e)
  }
  if (cursor < winEnd) gaps.push([cursor, winEnd])
  return gaps
}

function toHM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
