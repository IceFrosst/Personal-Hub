'use client'

import { createClient } from '@/lib/supabase/client'
import { IconRadar2, IconBrandGoogleFilled } from '@tabler/icons-react'

export default function LoginScreen() {
  const signIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-6 safe-b safe-t">
      <div className="flex flex-col items-center gap-4">
        <span className="rounded-2xl bg-surface p-5 text-purple">
          <IconRadar2 size={56} stroke={1.5} />
        </span>
        <h1 className="text-2xl font-semibold">Event Radar</h1>
        <p className="max-w-[28ch] text-center text-sm text-text-muted">
          Hackathons worth traveling to, found and ranked for you.
        </p>
      </div>
      <button
        onClick={signIn}
        className="flex min-h-11 items-center gap-3 rounded-md bg-purple px-6 py-3 font-medium text-white transition-colors duration-150 ease-out hover:bg-purple/90"
      >
        <IconBrandGoogleFilled size={20} />
        Continue with Google
      </button>
    </main>
  )
}
