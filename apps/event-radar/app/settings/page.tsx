import { createClient } from '@/lib/supabase/server'
import LoginScreen from '@/components/LoginScreen'
import SettingsPanel from '@/components/SettingsPanel'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <LoginScreen />

  return <SettingsPanel userId={user.id} />
}
