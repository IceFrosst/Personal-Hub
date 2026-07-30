import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteEvent } from '@/lib/google/calendar'
import { todayInTz } from './time'

export interface SweepResult {
  removed: number
}

/**
 * Once a day is in the past, any block you never checked off is treated as
 * not-done: remove it from the plan AND delete its Google Calendar event.
 * Applies to every day strictly before today (so multi-day gaps get cleaned up).
 *
 * Kept untouched: blocks marked `done` or `'continued'` (history / carried
 * forward), and **locked** blocks — those mirror the user's real calendar
 * events, which we never created and must not delete.
 */
export async function sweepStalePastDays(args: {
  db: SupabaseClient
  userId: string
  accessToken?: string
  timezone: string
}): Promise<SweepResult> {
  const { db, userId, accessToken, timezone } = args
  const today = todayInTz(timezone)

  const { data: rows } = await db
    .schema('lock_in')
    .from('plan_blocks')
    .select('id, gcal_event_id, status')
    .eq('user_id', userId)
    .eq('locked', false)
    .lt('plan_date', today)

  const stale = ((rows ?? []) as { id: string; gcal_event_id: string | null; status: string }[]).filter(
    (r) => r.status !== 'done' && r.status !== 'continued'
  )
  if (stale.length === 0) return { removed: 0 }

  // Delete the calendar events first (best-effort), then drop the rows.
  if (accessToken) {
    await Promise.all(
      stale
        .map((r) => r.gcal_event_id)
        .filter((id): id is string => Boolean(id))
        .map((id) => deleteEvent(accessToken, id).catch(() => {}))
    )
  }
  await db
    .schema('lock_in')
    .from('plan_blocks')
    .delete()
    .in(
      'id',
      stale.map((r) => r.id)
    )

  return { removed: stale.length }
}
