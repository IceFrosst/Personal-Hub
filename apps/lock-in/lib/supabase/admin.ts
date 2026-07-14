import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client for UNATTENDED server work only (the morning
// cron). It bypasses RLS, so it must never be imported into client code or a
// route that echoes arbitrary rows back to a browser. Returns null when the
// key isn't provisioned, so callers can degrade gracefully instead of crashing.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) return null

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
