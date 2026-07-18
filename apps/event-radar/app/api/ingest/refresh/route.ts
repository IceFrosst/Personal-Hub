import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IngestNotConfiguredError, runIngest } from '@/lib/ingest/run'
import { manualRefreshRejection } from '@/lib/manual-refresh-policy'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    return NextResponse.json(await runIngest({ sendNotifications: false }))
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
