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
      let dest = `${origin}${next}`

      if (connect) {
        // provider_refresh_token is only present on this initial exchange, and
        // only when the OAuth request used access_type=offline + prompt=consent.
        const refreshToken = data.session?.provider_refresh_token
        const user = data.session?.user

        // TEMP diagnostic: record what the exchange actually returned.
        if (user) {
          await supabase
            .schema('lock_in')
            .from('oauth_debug')
            .insert({
              user_id: user.id,
              has_provider_token: !!data.session?.provider_token,
              has_provider_refresh: !!data.session?.provider_refresh_token,
              note: 'callback',
            })
        }

        let cal = 'notoken'
        if (refreshToken && user) {
          const { error: storeError } = await supabase
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
          cal = storeError ? 'storeerr' : 'connected'
          if (storeError) console.error('[game-plan] connection store failed:', storeError.message)
        } else {
          console.error('[game-plan] no provider_refresh_token on exchange')
        }
        const sep = dest.includes('?') ? '&' : '?'
        dest = `${dest}${sep}cal=${cal}`
      }

      return NextResponse.redirect(dest)
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
