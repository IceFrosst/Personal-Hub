import { NextRequest, NextResponse } from 'next/server'

// Server-side visitor intel — the pieces a browser can't (or won't) tell us:
// the connecting IP and Vercel's free IP-derived geolocation headers.
// Officer-eyes-only: this lands in republic.applications.intel (write-only
// for anon; only the ministry can read it back — see migration 0004/0006).
// Never rendered to the applicant anywhere.

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const h = request.headers
  const forwarded = h.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || null
  const rawCity = h.get('x-vercel-ip-city')
  let city: string | null = null
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity)
    } catch {
      city = rawCity
    }
  }
  return NextResponse.json({
    ip,
    country: h.get('x-vercel-ip-country'),
    region: h.get('x-vercel-ip-country-region'),
    city,
    timezone: h.get('x-vercel-ip-timezone'),
  })
}
