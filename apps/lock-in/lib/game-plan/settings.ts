import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, type PlanSettings } from './types'

/** Load a user's plan settings, creating a default row on first access. */
export async function getOrCreateSettings(
  db: SupabaseClient,
  userId: string
): Promise<PlanSettings> {
  const { data } = await db
    .schema('lock_in')
    .from('plan_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (data) return data as PlanSettings

  const row = { user_id: userId, ...DEFAULT_SETTINGS }
  const { data: created } = await db
    .schema('lock_in')
    .from('plan_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  return (created ?? { ...row, updated_at: new Date().toISOString() }) as PlanSettings
}
