import { NextResponse } from 'next/server'
import { IngestNotConfiguredError, runIngest } from '@/lib/ingest/run'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
