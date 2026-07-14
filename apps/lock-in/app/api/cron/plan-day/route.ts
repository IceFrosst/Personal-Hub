import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { runPlanForUser } from '@/lib/game-plan/run'
import { hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Unattended morning planner. Vercel Cron hits this daily; it plans the day for
 * every connected user who has auto-plan on, using stored offline refresh
 * tokens. Requires SUPABASE_SERVICE_ROLE_KEY (no browser session to borrow) and
 * the Google OAuth client secret (to refresh tokens) — returns 503 until both
 * are provisioned, so the on-demand button still works in the meantime.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 503 })
  }
  if (!hasOfflineCredentials()) {
    return NextResponse.json({ error: 'google_oauth_not_configured' }, { status: 503 })
  }

  const { data: connections } = await admin
    .schema('lock_in')
    .from('calendar_connections')
    .select('user_id, google_refresh_token')

  const results: Array<{ user_id: string; scheduled?: number; error?: string }> = []

  for (const conn of connections ?? []) {
    try {
      const settings = await getOrCreateSettings(admin, conn.user_id)
      if (!settings.auto_plan) {
        results.push({ user_id: conn.user_id, error: 'auto_plan_off' })
        continue
      }

      const accessToken = await refreshAccessToken(conn.google_refresh_token)
      const result = await runPlanForUser({
        db: admin,
        userId: conn.user_id,
        accessToken,
        settings,
      })
      results.push({ user_id: conn.user_id, scheduled: result.scheduledCount })
    } catch (err) {
      results.push({
        user_id: conn.user_id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}
