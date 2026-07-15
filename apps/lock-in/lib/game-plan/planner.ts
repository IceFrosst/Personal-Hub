import type {
  FixedRecurringInput,
  FlexRecurringInput,
  PlannableTask,
  ProposedBlock,
} from './types'
import { hmToMinutes } from './time'

export interface PlanInput {
  tasks: PlannableTask[]
  recurringFixed: FixedRecurringInput[] // pinned-time routines
  recurringFlex: FlexRecurringInput[] // auto-placed routines (known duration)
  busy: { start: string; end: string }[] // local 'HH:MM' ranges already blocked
  workStart: string // 'HH:MM'
  workEnd: string // 'HH:MM'
  earliestStart: string // 'HH:MM' — don't schedule before this (max of workStart / now)
  today: string // 'YYYY-MM-DD'
}

// gemini-flash-latest is Google's rolling alias for the current free-tier flash
// model. Pinned model names rot: gemini-2.0-flash's free quota was cut to zero
// (429 on every call), which silently forced the fallback packer.
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'

// One schedulable thing handed to the model (a task to estimate, or a flexible
// routine whose duration is fixed).
interface FlexItem {
  id: string
  kind: 'task' | 'recurring'
  title: string
  priority?: 'low' | 'medium' | 'high'
  due?: string | null
  fixedDuration?: number // recurring routines: use exactly this
}

/**
 * Build the day:
 *   1. Pin fixed-time routines to their time, sliding to the nearest free slot
 *      when that time is already busy.
 *   2. Ask Gemini to lay out one-off tasks + flexible routines in the remaining
 *      free time, following the day-shape strategy (quick win first, protect
 *      deep-work blocks, end on a high). Falls back to a deterministic packer.
 */
export async function planDay(input: PlanInput): Promise<ProposedBlock[]> {
  const winStart = hmToMinutes(input.earliestStart)
  const winEnd = hmToMinutes(input.workEnd)

  const occupied: Array<[number, number]> = input.busy
    .map((b) => [hmToMinutes(b.start), hmToMinutes(b.end)] as [number, number])
    .filter(([s, e]) => e > s)

  // 1. Fixed-time routines (deterministic).
  const fixedBlocks: ProposedBlock[] = []
  const fixedSorted = [...input.recurringFixed].sort(
    (a, b) => hmToMinutes(a.fixedTime) - hmToMinutes(b.fixedTime)
  )
  for (const r of fixedSorted) {
    const dur = Math.max(5, r.durationMinutes)
    const start = findNearestSlot(hmToMinutes(r.fixedTime), dur, occupied, winStart, winEnd)
    if (start == null) continue // no room today
    occupied.push([start, start + dur])
    fixedBlocks.push({
      recurring_id: r.id,
      task_id: null,
      title: r.title,
      start: toHM(start),
      end: toHM(start + dur),
      estimated_minutes: dur,
    })
  }

  // 2. Flexible items: one-off tasks (estimate) + flexible routines (known dur).
  const flexItems: FlexItem[] = [
    ...input.tasks.map<FlexItem>((t) => ({
      id: t.id,
      kind: 'task',
      title: t.title,
      priority: t.priority,
      due: t.due_date,
    })),
    ...input.recurringFlex.map<FlexItem>((r) => ({
      id: r.id,
      kind: 'recurring',
      title: r.title,
      fixedDuration: Math.max(5, r.durationMinutes),
    })),
  ]

  let rest: ProposedBlock[] = []
  if (flexItems.length > 0) {
    const key = process.env.GEMINI_API_KEY
    if (key) {
      try {
        const raw = await geminiSchedule(flexItems, occupied, winStart, winEnd, input.today, key)
        rest = sanitize(raw, flexItems, occupied, winStart, winEnd)
      } catch {
        rest = []
      }
    }
    if (rest.length === 0) {
      rest = naiveSchedule(flexItems, occupied, winStart, winEnd, input.today)
    }
  }

  return [...fixedBlocks, ...rest].sort((a, b) => hmToMinutes(a.start) - hmToMinutes(b.start))
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
function freeGaps(
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

async function geminiSchedule(
  items: FlexItem[],
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number,
  today: string,
  key: string
): Promise<ProposedBlock[]> {
  const busyLines = occupied.length
    ? occupied
        .sort((a, b) => a[0] - b[0])
        .map(([s, e]) => `- ${toHM(s)}–${toHM(e)}`)
        .join('\n')
    : '- (nothing blocked yet)'

  const itemLines = items
    .map((it) =>
      it.kind === 'recurring'
        ? `- id=${it.id} | ROUTINE | use exactly ${it.fixedDuration} min | ${it.title}`
        : `- id=${it.id} | task | priority=${it.priority} | due=${it.due ?? 'none'} | ${it.title}`
    )
    .join('\n')

  const prompt = `You are a scheduling assistant. Lay out a realistic, humane plan for TODAY (${today}).

Working window: ${toHM(winStart)} to ${toHM(winEnd)} (24h local). Never schedule outside it.

Already blocked — do NOT overlap (existing calendar events and pinned routines):
${busyLines}

Schedule these into the free time:
${itemLines}

Day-shape rules (important):
- Start with a QUICK WIN: put one short, easy item first so the day opens with momentum.
- Protect DEEP WORK: any long/focus task or routine gets one uninterrupted block — never split it or sandwich it between tiny tasks.
- END ON A HIGH: don't finish the day on the most draining task; leave something lighter or satisfying last.
- ROUTINE items must use exactly the stated duration. For tasks, estimate a sensible duration (typically 20–90 min; bigger/vaguer = longer).
- Leave 5–10 min between blocks. Never overlap a blocked interval or another block.
- Prefer scheduling fewer things well over cramming an unrealistic day. Leave unscheduled items off.

Return ONLY JSON: {"blocks":[{"id":"<id>","title":"<title>","start":"HH:MM","end":"HH:MM","estimated_minutes":<int>}]}`

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini failed (${res.status})`)

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no text')

  const parsed = JSON.parse(text) as {
    blocks?: { id?: string; title?: string; start?: string; end?: string; estimated_minutes?: number }[]
  }
  return (parsed.blocks ?? []).map((b) => ({
    task_id: null,
    recurring_id: null,
    title: String(b.title ?? ''),
    start: String(b.start ?? ''),
    end: String(b.end ?? ''),
    estimated_minutes: Number(b.estimated_minutes) || 0,
    // carry the model's id through title-less; resolved in sanitize
    _id: b.id,
  })) as unknown as ProposedBlock[]
}

/** Drop blocks outside the window / overlapping, and resolve ids → task/recurring. */
function sanitize(
  blocks: ProposedBlock[],
  items: FlexItem[],
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number
): ProposedBlock[] {
  const byId = new Map(items.map((it) => [it.id, it]))
  const taken: Array<[number, number]> = [...occupied]
  const out: ProposedBlock[] = []

  const withId = blocks as Array<ProposedBlock & { _id?: string }>
  const sorted = withId
    .filter((b) => b && b.start && b.end)
    .sort((a, b) => hmToMinutes(a.start) - hmToMinutes(b.start))

  for (const b of sorted) {
    const s = hmToMinutes(b.start)
    let e = hmToMinutes(b.end)
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue
    const item = b._id ? byId.get(b._id) : undefined
    // Routines must keep their exact duration.
    if (item?.kind === 'recurring' && item.fixedDuration) e = s + item.fixedDuration
    if (s < winStart || e > winEnd) continue
    if (taken.some(([ts, te]) => s < te && e > ts)) continue
    taken.push([s, e])
    out.push({
      task_id: item?.kind === 'task' ? item.id : null,
      recurring_id: item?.kind === 'recurring' ? item.id : null,
      title: (item?.title ?? b.title ?? 'Task').slice(0, 200),
      start: b.start,
      end: toHM(e),
      estimated_minutes: e - s,
    })
  }
  return out
}

const DEFAULT_MINUTES: Record<'low' | 'medium' | 'high', number> = {
  high: 60,
  medium: 45,
  low: 30,
}
const GAP = 5

/** Deterministic fallback: pack items into free gaps, deadlines/priority first. */
function naiveSchedule(
  items: FlexItem[],
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number,
  today: string
): ProposedBlock[] {
  const free = freeGaps(occupied, winStart, winEnd)
  const rank = { high: 3, medium: 2, low: 1 }
  const ordered = [...items].sort((a, b) => {
    // routines before tasks (they're committed), then by priority/due
    if (a.kind !== b.kind) return a.kind === 'recurring' ? -1 : 1
    const pa = a.priority ? rank[a.priority] : 2
    const pb = b.priority ? rank[b.priority] : 2
    const overdueA = a.due && a.due <= today ? 1 : 0
    const overdueB = b.due && b.due <= today ? 1 : 0
    if (overdueA !== overdueB) return overdueB - overdueA
    if (pa !== pb) return pb - pa
    return 0
  })

  const out: ProposedBlock[] = []
  let fi = 0
  let at = free.length ? free[0][0] : winEnd

  for (const it of ordered) {
    const want = it.fixedDuration ?? DEFAULT_MINUTES[it.priority ?? 'medium']
    while (fi < free.length) {
      if (at < free[fi][0]) at = free[fi][0]
      const avail = free[fi][1] - at
      const need = it.fixedDuration ?? Math.min(want, 20)
      if (avail >= need) {
        const dur = it.fixedDuration ?? Math.min(want, avail)
        out.push({
          task_id: it.kind === 'task' ? it.id : null,
          recurring_id: it.kind === 'recurring' ? it.id : null,
          title: it.title,
          start: toHM(at),
          end: toHM(at + dur),
          estimated_minutes: dur,
        })
        at += dur + GAP
        break
      }
      fi += 1
      if (fi < free.length) at = free[fi][0]
    }
    if (fi >= free.length) break
  }
  return out
}

function toHM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
