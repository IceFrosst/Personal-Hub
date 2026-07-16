import type {
  AiStatus,
  FixedRecurringInput,
  FlexRecurringInput,
  PlannableTask,
  ProposedBlock,
} from './types'
import type { TaskCategory } from '@/lib/types'
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
 * last status in the message so planDay can tell a 429 (rate limit) from other
 * failures. Returns the raw model text.
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
      // Transient server overload → one quick backoff, then retry the same model.
      if ([500, 502, 503, 504].includes(res.status) && attempt === 0) {
        await new Promise((r) => setTimeout(r, 700))
        continue
      }
      break // 429 or other non-retryable — move to the next model
    }
  }
  throw new Error(`Gemini failed ${last}`)
}

// One schedulable thing handed to the model (a task to estimate, or a flexible
// routine whose duration is fixed).
interface FlexItem {
  id: string
  kind: 'task' | 'recurring'
  title: string
  priority?: 'low' | 'medium' | 'high'
  due?: string | null
  category?: TaskCategory | null
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
export async function planDay(input: PlanInput): Promise<PlanResult> {
  const winStart = hmToMinutes(input.earliestStart)
  const winEnd = hmToMinutes(input.workEnd)
  // A "fresh" plan opens at the top of the work window (start of day / a future
  // day). A mid-day replan starts later (earliestStart pushed to now) — there the
  // day is already underway, so we skip the "open with a quick win" shaping.
  const fresh = winStart <= hmToMinutes(input.workStart)

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
      category: null,
      priority: null,
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
      category: t.category,
    })),
    ...input.recurringFlex.map<FlexItem>((r) => ({
      id: r.id,
      kind: 'recurring',
      title: r.title,
      fixedDuration: Math.max(5, r.durationMinutes),
    })),
  ]

  let rest: ProposedBlock[] = []
  let ai: AiStatus = 'ok'
  if (flexItems.length > 0) {
    const key = process.env.GEMINI_API_KEY
    if (!key) {
      ai = 'fallback'
      rest = naiveSchedule(flexItems, occupied, winStart, winEnd, input.today, fresh)
    } else {
      try {
        const raw = await geminiSchedule(flexItems, occupied, winStart, winEnd, input.today, key, fresh)
        rest = sanitize(raw, flexItems, occupied, winStart, winEnd)
        // Model returned nothing usable → pack deterministically and flag it.
        if (rest.length === 0) {
          const packed = naiveSchedule(flexItems, occupied, winStart, winEnd, input.today, fresh)
          if (packed.length > 0) {
            rest = packed
            ai = 'fallback'
          }
        }
      } catch (err) {
        ai = String(err).includes('429') ? 'rate_limited' : 'fallback'
        rest = naiveSchedule(flexItems, occupied, winStart, winEnd, input.today, fresh)
      }
    }
  }

  const blocks = [...fixedBlocks, ...rest].sort(
    (a, b) => hmToMinutes(a.start) - hmToMinutes(b.start)
  )
  return { blocks, ai }
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
  key: string,
  fresh: boolean
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
        : `- id=${it.id} | task | priority=${it.priority} | due=${it.due ?? 'none'} | tag=${it.category ?? 'none'} | ${it.title}`
    )
    .join('\n')

  const prompt = `You are a scheduling assistant. Lay out a realistic, humane plan for TODAY (${today}).

Working window: ${toHM(winStart)} to ${toHM(winEnd)} (24h local). Never schedule outside it.

Already blocked — do NOT overlap (existing calendar events and pinned routines):
${busyLines}

Schedule these into the free time:
${itemLines}

Day-shape rules (important):
${
  fresh
    ? '- Start with a QUICK WIN: put one short, easy item first so the day opens with momentum.'
    : '- This is a MID-DAY REPLAN of a day already in progress — do NOT open with a quick win or an easy warm-up. The morning already happened; just place the remaining items efficiently by priority and energy.'
}
- Protect DEEP WORK: any long/focus task or routine gets one uninterrupted block — never split it or sandwich it between tiny tasks.
- END ON A HIGH: don't finish the day on the most draining task; leave something lighter or satisfying last.
- USE THE TAGS: 'work' and 'hustle' are focus-heavy — put them in the earlier, higher-energy hours and give them the protected deep-work treatment. 'social' and 'other' are lighter — lean them later in the day. Group same-tag items together rather than ping-ponging between kinds of work.
- ROUTINE items must use exactly the stated duration. For tasks, estimate a sensible duration (typically 20–90 min; bigger/vaguer = longer).
- SPLIT big tasks: if a task realistically needs more than ~90 min, break it into two sessions that reuse the SAME id, with a break or lighter work between them, rather than one marathon block. Routines are never split.
- MEAL / BREAK / EXERCISE routines: some items in the list are an exercise/workout, a meal (lunch/dinner), or a break — recognise them by title. Order them: a MEAL comes only AFTER the exercise/workout block (exercise first, then eat), never right before exercise; do NOT put a break right after the exercise block or right after a meal (those already are the break); a BREAK belongs after a demanding/deep-work session.
- Do NOT invent extra meal, break, or exercise blocks — only schedule the items in the list above.
- Leave 5–10 min between blocks. Never overlap a blocked interval or another block.
- Prefer scheduling fewer things well over cramming an unrealistic day. Leave unscheduled items off.

Return ONLY JSON: {"blocks":[{"id":"<id>","title":"<title>","start":"HH:MM","end":"HH:MM","estimated_minutes":<int>}]}`

  const text = await generateJson(prompt, key)

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
    category: null,
    priority: null,
    // carry the model's id through title-less; resolved in sanitize
    _id: b.id,
  })) as unknown as ProposedBlock[]
}

/**
 * Resolve ids → task/recurring and keep the model's placement when valid. When a
 * block overlaps something or falls outside the window, REPAIR it by shifting to
 * the nearest free slot that fits (instead of dropping it), so the AI's intent
 * survives. Only dropped when nothing fits at all.
 */
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
    const s0 = hmToMinutes(b.start)
    let e0 = hmToMinutes(b.end)
    if (Number.isNaN(s0) || Number.isNaN(e0) || e0 <= s0) continue
    const item = b._id ? byId.get(b._id) : undefined
    // Routines must keep their exact duration.
    if (item?.kind === 'recurring' && item.fixedDuration) e0 = s0 + item.fixedDuration
    const dur = e0 - s0

    let start = s0
    const fitsAsIs =
      s0 >= winStart && e0 <= winEnd && !taken.some(([ts, te]) => s0 < te && e0 > ts)
    if (!fitsAsIs) {
      const slot = findNearestSlot(s0, dur, taken, winStart, winEnd)
      if (slot == null) continue // genuinely no room left → drop
      start = slot
    }
    const end = start + dur
    taken.push([start, end])
    out.push({
      task_id: item?.kind === 'task' ? item.id : null,
      recurring_id: item?.kind === 'recurring' ? item.id : null,
      title: (item?.title ?? b.title ?? 'Task').slice(0, 200),
      start: toHM(start),
      end: toHM(end),
      estimated_minutes: dur,
      category: item?.category ?? null,
      priority: item?.priority ?? null,
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

/**
 * Deterministic fallback (used when the model is unavailable). Applies the same
 * day-shape strategy as the prompt: a short QUICK WIN opens the day, the heaviest
 * work sits in the first half, and a light item is saved for LAST (end on a high).
 */
function naiveSchedule(
  items: FlexItem[],
  occupied: Array<[number, number]>,
  winStart: number,
  winEnd: number,
  today: string,
  fresh: boolean
): ProposedBlock[] {
  const free = freeGaps(occupied, winStart, winEnd)
  const rank = { high: 3, medium: 2, low: 1 }
  const durOf = (it: FlexItem) => it.fixedDuration ?? DEFAULT_MINUTES[it.priority ?? 'medium']
  const isLight = (it: FlexItem) =>
    it.priority === 'low' || it.category === 'social' || it.category === 'other'

  const used = new Set<string>()

  // Quick win: the shortest task, to open with momentum — only on a fresh day. A
  // mid-day replan skips the opener (the day's already going) and goes by weight.
  const opener = fresh
    ? [...items].filter((it) => it.kind === 'task').sort((a, b) => durOf(a) - durOf(b))[0]
    : undefined
  if (opener) used.add(opener.id)

  // End on a high: a light item saved for last (not the opener).
  const ender = [...items]
    .filter((it) => !used.has(it.id) && isLight(it))
    .sort((a, b) => durOf(a) - durOf(b))[0]
  if (ender) used.add(ender.id)

  // Middle: everything else, heaviest first (overdue → priority → duration).
  const middle = items
    .filter((it) => !used.has(it.id))
    .sort((a, b) => {
      const overdueA = a.due && a.due <= today ? 1 : 0
      const overdueB = b.due && b.due <= today ? 1 : 0
      if (overdueA !== overdueB) return overdueB - overdueA
      const pa = a.priority ? rank[a.priority] : 2
      const pb = b.priority ? rank[b.priority] : 2
      if (pa !== pb) return pb - pa
      return durOf(b) - durOf(a)
    })

  const ordered = [opener, ...middle, ender].filter((it): it is FlexItem => Boolean(it))

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
          category: it.category ?? null,
          priority: it.priority ?? null,
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
