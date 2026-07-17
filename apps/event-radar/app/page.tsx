import { createClient } from '@/lib/supabase/server'
import LoginScreen from '@/components/LoginScreen'
import Feed from '@/components/Feed'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <LoginScreen />

  return <Feed userId={user.id} />
}
