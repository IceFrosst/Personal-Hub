import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PRIORITY_RANK, type Priority, type Suggestion, type Task } from '@/lib/types'

// How many tasks the gate lists at once.
const MAX_SUGGESTIONS = 2

// Time-of-day buckets. Late night is deliberately gentle: the user may be in bed,
// so we prefer small/quick tasks and never push a big, heavy one.
type Bucket = 'morning' | 'afternoon' | 'evening' | 'late night'

function bucketFor(hour: number): Bucket {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'late night'
}

function priorityRank(p: Priority | null | undefined): number {
  return p ? PRIORITY_RANK[p] : PRIORITY_RANK.medium
}

// Days until due (negative = overdue). null when no due date.
function daysUntilDue(due: string | null | undefined): number | null {
  if (!due) return null
  const d = new Date(due + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

// Deterministic scorer used for the fallback and to keep the heuristic honest.
// Weighs priority + due-date urgency, then bends for the time of day — gently at night.
function scoreTask(task: Task, bucket: Bucket): number {
  let score = priorityRank(task.priority) // 1–3
  if (task.is_quick) score += 1.5

  const due = daysUntilDue(task.due_date)
  if (due !== null) {
    if (due <= 0) score += 2.5 // due today or overdue
    else if (due === 1) score += 1.5
    else if (due <= 3) score += 0.75
  }

  if (bucket === 'late night') {
    // Be kind: lift quick wins, push heavy tasks down so they don't get suggested in bed.
    score += task.is_quick ? 2 : -2.5
  } else if (bucket === 'evening') {
    if (!task.is_quick) score -= 0.5 // wind down — lean lighter
  } else if (bucket === 'morning') {
    if (!task.is_quick) score += 0.5 // fresh energy — fine to tackle a bigger one
  }

  return score
}

// The gate lists just title + priority + date, so priority/dueDate come straight
// from the task row (never trusted from the model).
function toSuggestion(task: Task): Suggestion {
  return {
    taskId: task.id,
    taskTitle: task.title,
    priority: task.priority ?? null,
    dueDate: task.due_date ?? null,
  }
}

// Top tasks by score, best first. Tie-break oldest-first so nothing lingers forever.
function rankTasks(active: Task[], bucket: Bucket): Task[] {
  return [...active].sort((a, b) => {
    const diff = scoreTask(b, bucket) - scoreTask(a, bucket)
    if (diff !== 0) return diff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let tasks: Task[] = []
  let clientHour: number | null = null
  try {
    const body = await request.json()
    tasks = Array.isArray(body.tasks) ? body.tasks : []
    // The user's local hour (server runs UTC on Vercel) — drives time-of-day gentleness.
    if (typeof body.clientHour === 'number' && body.clientHour >= 0 && body.clientHour <= 23) {
      clientHour = Math.floor(body.clientHour)
    }
  } catch {
    return NextResponse.json({ suggestions: [] }, { status: 200 })
  }

  const active = tasks.filter((t) => !t.is_completed)
  if (!active.length) return NextResponse.json({ suggestions: [] }, { status: 200 })

  const hour = clientHour ?? new Date().getHours()
  const bucket = bucketFor(hour)
  const apiKey = process.env.GEMINI_API_KEY

  const fallback = () => rankTasks(active, bucket).slice(0, MAX_SUGGESTIONS).map(toSuggestion)

  // Record that we surfaced these so repeats can be de-prioritised later.
  async function markSuggested(picks: Task[]) {
    const now = new Date().toISOString()
    await Promise.all(
      picks.map((t) =>
        supabase
          .schema('focus_gate')
          .from('tasks')
          .update({
            last_suggested_at: now,
            suggestion_count: (t.suggestion_count ?? 0) + 1,
          })
          .eq('id', t.id)
      )
    )
  }

  async function respond(picks: Task[]) {
    await markSuggested(picks)
    return NextResponse.json({ suggestions: picks.map(toSuggestion) })
  }

  if (!apiKey) {
    return NextResponse.json({ suggestions: fallback() })
  }

  try {
    const clock = `${String(hour).padStart(2, '0')}:00`

    const taskList = active
      .map(
        (t) =>
          `- ID: ${t.id} | "${t.title}" | priority: ${t.priority ?? 'medium'} | quick: ${t.is_quick} | due: ${t.due_date ?? 'none'}`
      )
      .join('\n')

    const prompt = `The user is about to open Instagram instead of doing something useful. Pick up to ${MAX_SUGGESTIONS} tasks from their list for them to do instead, ordered best first.

How to choose:
- Weigh priority (high > medium > low) and due dates (sooner/overdue = more urgent).
- Match the energy of the time of day. It is ${bucket} (${clock}). Morning/afternoon: a bigger or high-priority task is fine. Evening: lean lighter.
- LATE AT NIGHT, be gentle — the user may be in bed. Prefer quick or small tasks, and NEVER push a big or heavy one. If everything left is big and it's late, it's fine to suggest fewer (or just one) easy task.
- Return fewer than ${MAX_SUGGESTIONS} if only one task fits the moment.

Their pending tasks:
${taskList}

Reply as JSON only (no markdown), task IDs only, best first:
{"taskIds":["<id>", "<id>"]}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )

    if (!res.ok) throw new Error('Gemini error')

    const geminiData = await res.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = JSON.parse(text) as { taskIds?: unknown }

    // Map model IDs back to real rows (deduped, capped) — ignore anything it invented.
    const ids = Array.isArray(parsed.taskIds) ? parsed.taskIds : []
    const seen = new Set<string>()
    const picks: Task[] = []
    for (const id of ids) {
      if (typeof id !== 'string' || seen.has(id)) continue
      const match = active.find((t) => t.id === id)
      if (match) {
        seen.add(id)
        picks.push(match)
      }
      if (picks.length >= MAX_SUGGESTIONS) break
    }

    // Model returned nothing usable — fall back to the deterministic ranking.
    if (!picks.length) return NextResponse.json({ suggestions: fallback() })

    return respond(picks)
  } catch {
    return NextResponse.json({ suggestions: fallback() })
  }
}
