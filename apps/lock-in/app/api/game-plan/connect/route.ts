import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Store the Google offline refresh token for the signed-in user.
 *
 * Belt-and-suspenders capture: the OAuth callback tries to persist the token
 * from the server-side code exchange, but `provider_refresh_token` sometimes
 * only surfaces in the browser session. The Game Plan client reads it from its
 * session and POSTs it here so the connection lands either way.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }

  let refreshToken: string | undefined
  let email: string | undefined
  try {
    const body = (await request.json()) as { refreshToken?: string; email?: string }
    refreshToken = body?.refreshToken
    email = body?.email
  } catch {
    // no body
  }

  if (!refreshToken) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 400 })
  }

  const { error } = await supabase
    .schema('lock_in')
    .from('calendar_connections')
    .upsert(
      {
        user_id: user.id,
        google_refresh_token: refreshToken,
        google_email: email ?? user.email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    return NextResponse.json({ error: 'store_failed', detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
