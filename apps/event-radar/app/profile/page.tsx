import { createClient } from '@/lib/supabase/server'
import LoginScreen from '@/components/LoginScreen'
import ProfileEditor from '@/components/ProfileEditor'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <LoginScreen />

  return <ProfileEditor userId={user.id} />
}
