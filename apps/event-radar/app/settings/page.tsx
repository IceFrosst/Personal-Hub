import { createClient } from '@/lib/supabase/server'
import LoginScreen from '@/components/LoginScreen'
import SettingsPanel from '@/components/SettingsPanel'
import { isEventRadarAdmin } from '@/lib/owner'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <LoginScreen />

  return <SettingsPanel userId={user.id} canRefreshSources={isEventRadarAdmin(user.email)} />
}
