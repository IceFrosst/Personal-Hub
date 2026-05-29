import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PRIORITY_RANK, type Priority, type Suggestion, type Task } from '@/lib/types'

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

function reasonFor(task: Task, bucket: Bucket): string {
  const due = daysUntilDue(task.due_date)
  if (bucket === 'late night') {
    return task.is_quick
      ? 'A small one to close the day — then rest.'
      : 'It’s late — maybe just glance, then leave it for tomorrow.'
  }
  if (due !== null && due <= 0) return 'Due today — worth a few minutes now.'
  if (due === 1) return 'Due tomorrow — get ahead of it.'
  if (task.priority === 'high') return 'High priority — knock it out.'
  if (task.is_quick) return 'Quick win — takes just a moment.'
  return 'This one has been waiting.'
}

function fallback(tasks: Task[], bucket: Bucket): Suggestion | null {
  const active = tasks.filter((t) => !t.is_completed)
  if (!active.length) return null

  const target = [...active].sort((a, b) => {
    const diff = scoreTask(b, bucket) - scoreTask(a, bucket)
    if (diff !== 0) return diff
    // Tie-break: oldest first, so nothing lingers forever.
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })[0]

  return { taskId: target.id, taskTitle: target.title, reason: reasonFor(target, bucket) }
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
    return NextResponse.json({ error: 'No tasks' }, { status: 200 })
  }

  const active = tasks.filter((t) => !t.is_completed)
  if (!active.length) return NextResponse.json({ error: 'No active tasks' }, { status: 200 })

  const hour = clientHour ?? new Date().getHours()
  const bucket = bucketFor(hour)
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    const suggestion = fallback(tasks, bucket)
    return suggestion
      ? NextResponse.json(suggestion)
      : NextResponse.json({ error: 'No tasks' }, { status: 200 })
  }

  try {
    const clock = `${String(hour).padStart(2, '0')}:00`

    const taskList = active
      .map(
        (t) =>
          `- ID: ${t.id} | "${t.title}" | priority: ${t.priority ?? 'medium'} | quick: ${t.is_quick} | due: ${t.due_date ?? 'none'}`
      )
      .join('\n')

    const prompt = `The user is about to open Instagram instead of doing something useful. Suggest ONE task from their list to do instead. It is ${bucket} (${clock}).

How to choose:
- Weigh priority (high > medium > low) and due dates (sooner/overdue = more urgent).
- Match the energy of the time of day. Morning/afternoon: a bigger or high-priority task is fine. Evening: lean lighter.
- LATE AT NIGHT, be gentle — the user may be in bed. Prefer a quick or small task, and NEVER push a big or heavy one. If everything left is big and it's late, it's fine to gently suggest leaving it until tomorrow.
- Keep the reason warm, encouraging, and short.

Their pending tasks:
${taskList}

Reply as JSON only (no markdown):
{"taskId":"<id>","taskTitle":"<title>","reason":"<max 14 words, conversational>"}`

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
    const parsed = JSON.parse(text) as Suggestion

    if (parsed.taskId) {
      const matched = active.find((t) => t.id === parsed.taskId)
      if (matched) {
        await supabase
          .schema('focus_gate')
          .from('tasks')
          .update({
            last_suggested_at: new Date().toISOString(),
            suggestion_count: (matched.suggestion_count ?? 0) + 1,
          })
          .eq('id', parsed.taskId)
      }
    }

    return NextResponse.json(parsed)
  } catch {
    const suggestion = fallback(tasks, bucket)
    return suggestion
      ? NextResponse.json(suggestion)
      : NextResponse.json({ error: 'No tasks' }, { status: 200 })
  }
}
