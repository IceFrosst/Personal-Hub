import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  // Set when the user is (re)connecting Google Calendar with the calendar scope,
  // so we know to persist the offline refresh token from this exchange.
  const connect = searchParams.get('connect') === '1'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (connect) {
        // provider_refresh_token is only present on this initial exchange, and
        // only when the OAuth request used access_type=offline + prompt=consent.
        const refreshToken = data.session?.provider_refresh_token
        const user = data.session?.user
        if (refreshToken && user) {
          await supabase
            .schema('lock_in')
            .from('calendar_connections')
            .upsert(
              {
                user_id: user.id,
                google_refresh_token: refreshToken,
                google_email: user.email ?? null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            )
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
