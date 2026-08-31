import { NextResponse } from 'next/server'
import { getFreeDates } from '@/lib/googleCalendar'

// Node runtime (not edge) — lib/googleCalendar.ts uses Node's built-in
// `crypto` module to sign the service-account JWT. Force runtime execution so
// a build without credentials can never bake an empty availability response
// into the deployment; the response itself is still CDN-cached for 60s below.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Free/busy-only, read-only calendar availability. Never returns event
 * details — only which upcoming local calendar dates have zero busy time on
 * Ignas's calendar (see lib/googleCalendar.ts). Fails closed: any
 * config/auth/network/data problem resolves an empty `dates` array, never a
 * fabricated one.
 */
export async function GET() {
  const result = await getFreeDates()

  if (!result.ok) {
    // Error codes are deliberately coarse and contain no credentials or
    // calendar details; keep this visible in production for fail-closed
    // availability diagnostics.
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
