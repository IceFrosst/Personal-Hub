import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Task } from '@/lib/types'

function fallback(tasks: Task[]) {
  const active = tasks.filter(t => !t.is_completed)
  if (!active.length) return null

  const quick = active
    .filter(t => t.is_quick)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const target =
    quick[0] ??
    [...active].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0]

  return {
    taskId: target.id,
    taskTitle: target.title,
    reason: target.is_quick ? 'Quick win — takes just a moment.' : 'This one has been waiting.',
  }
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
  try {
    const body = await request.json()
    tasks = Array.isArray(body.tasks) ? body.tasks : []
  } catch {
    return NextResponse.json({ error: 'No tasks' }, { status: 200 })
  }

  const active = tasks.filter(t => !t.is_completed)
  if (!active.length) return NextResponse.json({ error: 'No active tasks' }, { status: 200 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    const suggestion = fallback(tasks)
    return suggestion
      ? NextResponse.json(suggestion)
      : NextResponse.json({ error: 'No tasks' }, { status: 200 })
  }

  try {
    const hour = new Date().getHours()
    const timeContext = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

    const taskList = active
      .map(t => `- ID: ${t.id} | "${t.title}" | quick: ${t.is_quick}`)
      .join('\n')

    const prompt = `It's the ${timeContext} and the user is about to open Instagram instead of doing something useful.\n\nTheir pending tasks:\n${taskList}\n\nPick ONE task they should do right now. Reply as JSON only (no markdown):\n{"taskId":"<id>","taskTitle":"<title>","reason":"<max 12 words, conversational>"}`

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
    const parsed = JSON.parse(text)

    if (parsed.taskId) {
      const matched = active.find(t => t.id === parsed.taskId)
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
    const suggestion = fallback(tasks)
    return suggestion
      ? NextResponse.json(suggestion)
      : NextResponse.json({ error: 'No tasks' }, { status: 200 })
  }
}
