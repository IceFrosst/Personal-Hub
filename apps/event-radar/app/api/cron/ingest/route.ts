import { NextResponse } from 'next/server'
import { IngestNotConfiguredError, runIngest } from '@/lib/ingest/run'

export const dynamic = 'force-dynamic'
// Fluid Compute is enabled on this project, so Hobby allows up to 300s. The
// old value of 60 was the cause of the intermittent FUNCTION_INVOCATION_TIMEOUT
// 504s in the Actions tab: measured runs sat at ~58.5s elapsed, so any slow
// fetch pushed past the kill. The runner self-budgets (240s + one worst-case
// enrichment batch) to stay under this — see DEFAULT_BUDGET_MS in lib/ingest/run.ts.
export const maxDuration = 300

/**
 * Daily radar sweep (Vercel Cron). The shared runner gathers, enriches, and
 * notifies; this wrapper remains protected by CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    return NextResponse.json(await runIngest({ sendNotifications: true }))
  } catch (error) {
    if (error instanceof IngestNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('scheduled event radar ingest failed', error)
    return NextResponse.json({ error: 'ingest_failed' }, { status: 500 })
  }
}
