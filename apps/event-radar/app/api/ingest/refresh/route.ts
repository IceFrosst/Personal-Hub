import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IngestNotConfiguredError, runIngest } from '@/lib/ingest/run'
import { manualRefreshRejection } from '@/lib/manual-refresh-policy'

export const dynamic = 'force-dynamic'
// Fluid Compute ceiling (Hobby): headroom so a slow sweep degrades gracefully
// instead of 504ing. The tight budget below keeps the interactive wait short.
export const maxDuration = 300

let refreshInFlight = false

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const rejection = manualRefreshRejection({
    signedIn: Boolean(user),
    email: user?.email,
    action: request.headers.get('x-event-radar-action'),
    refreshInFlight,
  })
  if (rejection) return NextResponse.json({ error: rejection.error }, { status: rejection.status })

  refreshInFlight = true
  try {
    // A person is waiting on this response — keep the budget near the old
    // cron's, trading enrichment depth for latency. The scheduled cron (with
    // its 240s default) does the heavy lifting.
    return NextResponse.json(await runIngest({ sendNotifications: false, budgetMs: 50_000 }))
  } catch (error) {
    if (error instanceof IngestNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('manual event radar refresh failed', error)
    return NextResponse.json({ error: 'refresh_failed' }, { status: 500 })
  } finally {
    refreshInFlight = false
  }
}
