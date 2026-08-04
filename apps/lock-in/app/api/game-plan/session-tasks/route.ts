import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Add or remove tasks in a Deep Work session. A session is just a container —
 * nothing here touches times or the calendar, so it's a plain DB write.
 *
 * body: { blockId, add?: string[], remove?: string[] }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let blockId: string | undefined
  let add: string[] = []
  let remove: string[] = []
  try {
    const body = (await request.json()) as {
      blockId?: string
      add?: string[]
      remove?: string[]
    }
    blockId = body?.blockId
    add = Array.isArray(body?.add) ? body.add : []
    remove = Array.isArray(body?.remove) ? body.remove : []
  } catch {
    // fall through to the missing-block check
  }
  if (!blockId) return NextResponse.json({ error: 'missing_block' }, { status: 400 })

  // The block must be this user's, and actually be a session.
  const { data: block } = await supabase
    .schema('lock_in')
    .from('plan_blocks')
    .select('id, kind')
    .eq('user_id', user.id)
    .eq('id', blockId)
    .maybeSingle()
  if (!block || (block as { kind: string | null }).kind !== 'deep_work') {
    return NextResponse.json({ error: 'not_a_session' }, { status: 400 })
  }

  if (remove.length > 0) {
    await supabase
      .schema('lock_in')
      .from('deep_work_items')
      .delete()
      .eq('user_id', user.id)
      .eq('block_id', blockId)
      .in('task_id', remove)
  }

  if (add.length > 0) {
    const { data: existing } = await supabase
      .schema('lock_in')
      .from('deep_work_items')
      .select('position')
      .eq('user_id', user.id)
      .eq('block_id', blockId)
      .order('position', { ascending: false })
      .limit(1)
    const start = ((existing ?? [])[0]?.position ?? -1) + 1
    await supabase
      .schema('lock_in')
      .from('deep_work_items')
      .upsert(
        add.map((taskId, i) => ({
          user_id: user.id,
          block_id: blockId,
          task_id: taskId,
          position: start + i,
        })),
        { onConflict: 'block_id,task_id' }
      )
  }

  const { data: items } = await supabase
    .schema('lock_in')
    .from('deep_work_items')
    .select('id, block_id, task_id, position')
    .eq('user_id', user.id)
    .eq('block_id', blockId)
    .order('position', { ascending: true })

  return NextResponse.json({ items: items ?? [] })
}
