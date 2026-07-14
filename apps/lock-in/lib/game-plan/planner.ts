import type { PlannableTask, ProposedBlock } from './types'
import { hmToMinutes } from './time'

export interface PlanInput {
  tasks: PlannableTask[]
  busy: { start: string; end: string }[] // local 'HH:MM' ranges already blocked
  workStart: string // 'HH:MM'
  workEnd: string // 'HH:MM'
  earliestStart: string // 'HH:MM' — don't schedule before this (max of workStart / now)
  today: string // 'YYYY-MM-DD' — for due-date reasoning
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

/**
 * Ask Gemini to lay out a realistic day: estimate each task's duration and slot
 * it into the free time, deadlines and high priority first, leaving the rest on
 * the list. Falls back to a deterministic packer if the model is unavailable or
 * returns junk — the day always gets planned.
 */
export async function planDay(input: PlanInput): Promise<ProposedBlock[]> {
  const key = process.env.GEMINI_API_KEY
  if (!key || input.tasks.length === 0) return naiveSchedule(input)

  try {
    const blocks = await geminiSchedule(input, key)
    const valid = sanitize(blocks, input)
    // If the model gave nothing usable, don't leave the day empty.
    return valid.length > 0 ? valid : naiveSchedule(input)
  } catch {
    return naiveSchedule(input)
  }
}

async function geminiSchedule(input: PlanInput, key: string): Promise<ProposedBlock[]> {
  const taskLines = input.tasks
    .map(
      (t) =>
        `- id=${t.id} | priority=${t.priority} | due=${t.due_date ?? 'none'} | ${t.title}`
    )
    .join('\n')
  const busyLines = input.busy.length
    ? input.busy.map((b) => `- ${b.start}–${b.end}`).join('\n')
    : '- (calendar is clear)'

  const prompt = `You are a scheduling assistant. Build a realistic time-blocked plan for TODAY (${input.today}).

Working window: ${input.earliestStart} to ${input.workEnd} (24h local time). Do not schedule anything before ${input.earliestStart} or after ${input.workEnd}.

Already busy (do NOT overlap these):
${busyLines}

Open tasks (schedule the ones that realistically fit — overdue and due-today first, then high priority; leave the rest unscheduled for another day):
${taskLines}

Rules:
- Estimate a sensible duration for each task you schedule (typically 20–90 min). Bigger/vaguer tasks get more.
- Leave a 5–10 min gap between blocks. Never overlap a busy interval or another block.
- It is better to schedule fewer tasks well than to cram an unrealistic day.
- Times are 24h "HH:MM" local. end must be after start.

Return ONLY JSON: {"blocks":[{"task_id":"<id>","title":"<task title>","start":"HH:MM","end":"HH:MM","estimated_minutes":<int>}]}`

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

  const parsed = JSON.parse(text) as { blocks?: ProposedBlock[] }
  return parsed.blocks ?? []
}

/** Drop blocks that fall outside the window, overlap busy time, or overlap each other. */
function sanitize(blocks: ProposedBlock[], input: PlanInput): ProposedBlock[] {
  const winStart = hmToMinutes(input.earliestStart)
  const winEnd = hmToMinutes(input.workEnd)
  const busy = input.busy.map((b) => [hmToMinutes(b.start), hmToMinutes(b.end)] as const)
  const taskIds = new Set(input.tasks.map((t) => t.id))

  const taken: Array<readonly [number, number]> = [...busy]
  const out: ProposedBlock[] = []

  const sorted = [...blocks]
    .filter((b) => b && b.start && b.end)
    .sort((a, b) => hmToMinutes(a.start) - hmToMinutes(b.start))

  for (const b of sorted) {
    const s = hmToMinutes(b.start)
    const e = hmToMinutes(b.end)
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue
    if (s < winStart || e > winEnd) continue
    if (b.task_id && !taskIds.has(b.task_id)) continue
    if (taken.some(([ts, te]) => s < te && e > ts)) continue
    taken.push([s, e])
    out.push({
      task_id: b.task_id ?? null,
      title: String(b.title ?? '').slice(0, 200) || 'Task',
      start: b.start,
      end: b.end,
      estimated_minutes: Number.isFinite(b.estimated_minutes)
        ? Math.round(b.estimated_minutes)
        : e - s,
    })
  }
  return out
}

const DEFAULT_MINUTES: Record<PlannableTask['priority'], number> = {
  high: 60,
  medium: 45,
  low: 30,
}
const GAP = 5

/** Deterministic fallback: pack tasks into free gaps by priority then due date. */
function naiveSchedule(input: PlanInput): ProposedBlock[] {
  const winStart = hmToMinutes(input.earliestStart)
  const winEnd = hmToMinutes(input.workEnd)
  if (winEnd <= winStart) return []

  // Free intervals = working window minus busy.
  const busy = input.busy
    .map((b) => [hmToMinutes(b.start), hmToMinutes(b.end)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])

  const free: Array<[number, number]> = []
  let cursor = winStart
  for (const [bs, be] of busy) {
    if (be <= winStart || bs >= winEnd) continue
    if (bs > cursor) free.push([cursor, Math.min(bs, winEnd)])
    cursor = Math.max(cursor, be)
  }
  if (cursor < winEnd) free.push([cursor, winEnd])

  const rank = { high: 3, medium: 2, low: 1 }
  const tasks = [...input.tasks].sort((a, b) => {
    const overdueA = a.due_date && a.due_date <= input.today ? 1 : 0
    const overdueB = b.due_date && b.due_date <= input.today ? 1 : 0
    if (overdueA !== overdueB) return overdueB - overdueA
    if (rank[a.priority] !== rank[b.priority]) return rank[b.priority] - rank[a.priority]
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : 1
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })

  const out: ProposedBlock[] = []
  let fi = 0
  let at = free.length ? free[0][0] : winEnd

  for (const t of tasks) {
    const want = DEFAULT_MINUTES[t.priority]
    while (fi < free.length) {
      const [, fe] = free[fi]
      if (at < free[fi][0]) at = free[fi][0]
      const avail = fe - at
      if (avail >= Math.min(want, 20)) {
        const dur = Math.min(want, avail)
        const s = at
        const e = at + dur
        out.push({
          task_id: t.id,
          title: t.title,
          start: toHM(s),
          end: toHM(e),
          estimated_minutes: dur,
        })
        at = e + GAP
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
