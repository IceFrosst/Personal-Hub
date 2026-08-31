import { NextResponse } from 'next/server'
import { getFreeDates } from '@/lib/googleCalendar'

// Node runtime (not edge) — lib/googleCalendar.ts uses Node's built-in
// `crypto` module to sign the service-account JWT.
export const runtime = 'nodejs'

// Conservative revalidation window per the requirement ("around 60s") — long
// enough to avoid hammering the Google Calendar API on every appointment-page
// load, short enough that a newly-busy day doesn't stay shown as bookable for
// long. Also mirrored in the response's own Cache-Control header below so a
// CDN/browser cache agrees even if Next's route-level revalidate doesn't
// apply in a given deployment context.
export const revalidate = 60

/**
 * Free/busy-only, read-only calendar availability. Never returns event
 * details — only which upcoming local calendar dates have zero busy time on
 * Ignas's calendar (see lib/googleCalendar.ts). Fails closed: any
 * config/auth/network/data problem resolves an empty `dates` array, never a
 * fabricated one.
 */
export async function GET() {
  const result = await getFreeDates()

  if (!result.ok && process.env.NODE_ENV !== 'production') {
    console.warn(`[republic] available-dates: ${result.error}`)
  }

  return NextResponse.json(
    { dates: result.ok ? result.dates : [] },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=60',
      },
    }
  )
}
