import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/game-plan/settings'
import { hasOfflineCredentials, refreshAccessToken } from '@/lib/google/calendar'
import { reflowDay } from '@/lib/game-plan/reflow'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Reflow the movable blocks of a day into a new order (drag-to-reorder on the
 * timeline). The layout rules live in `reflowDay`, shared with insert-at.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let date = ''
  let orderedIds: string[] = []
  let providerToken: string | undefined
  try {
    const body = (await request.json()) as {
      date?: string
      orderedIds?: string[]
      providerToken?: string
    }
    date = body.date ?? ''
    orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : []
    providerToken = body.providerToken
  } catch {
    // fall through — validated below
  }
  if (!date || orderedIds.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const { data: connection } = await supabase
    .schema('lock_in')
    .from('calendar_connections')
    .select('google_refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  let accessToken: string | undefined
  if (connection?.google_refresh_token && hasOfflineCredentials()) {
    try {
      accessToken = await refreshAccessToken(connection.google_refresh_token)
    } catch {
      accessToken = undefined
    }
  }
  if (!accessToken && providerToken) accessToken = providerToken
  if (!accessToken) {
    return NextResponse.json({ error: 'reconnect_needed' }, { status: 400 })
  }

  const settings = await getOrCreateSettings(supabase, user.id)
  const result = await reflowDay({
    db: supabase,
    userId: user.id,
    accessToken,
    settings,
    date,
    orderedIds,
  })
  return NextResponse.json(result)
}
