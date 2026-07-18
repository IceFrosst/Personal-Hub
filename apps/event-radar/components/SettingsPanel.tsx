'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/lib/types'
import PushToggle from './PushToggle'
import ManualRefresh from './ManualRefresh'
import { IconArrowLeft, IconChevronRight, IconFileText } from '@tabler/icons-react'
import Link from 'next/link'

export default function SettingsPanel({
  userId,
  canRefreshSources,
}: {
  userId: string
  canRefreshSources: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [minScore, setMinScore] = useState<number>(DEFAULT_NOTIFICATION_SETTINGS.min_score)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .schema('hackathon')
      .from('user_preferences')
      .select('notification_settings')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...data?.notification_settings }
        setMinScore(settings.min_score)
        setLoaded(true)
      })
  }, [supabase, userId])

  const save = async (score: number) => {
    setMinScore(score)
    await supabase
      .schema('hackathon')
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          notification_settings: { ...DEFAULT_NOTIFICATION_SETTINGS, min_score: score },
        },
        { onConflict: 'user_id' }
      )
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    location.href = '/'
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6 safe-b safe-t">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted transition-colors duration-150 ease-out hover:text-text"
          aria-label="Back"
        >
          <IconArrowLeft size={22} stroke={1.5} />
        </Link>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Notifications</h2>
        <PushToggle userId={userId} />
        {loaded && (
          <label className="flex flex-col gap-2 text-sm text-text-muted">
            <span>
              Notify me when a hackathon scores at least{' '}
              <span className="font-semibold text-text">{minScore}</span>
              {saved && <span className="ml-2 text-green">saved</span>}
            </span>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => save(parseInt(e.target.value, 10))}
              className="h-11 w-full accent-[#8e4ec6]"
            />
          </label>
        )}
      </section>

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="text-lg font-medium">Apply Kit</h2>
        <Link
          href="/profile"
          className="flex min-h-11 items-center justify-between rounded-md border border-border px-3 text-sm text-text transition-colors duration-150 ease-out hover:border-border-focus"
        >
          <span className="flex items-center gap-2">
            <IconFileText size={18} stroke={1.5} className="text-purple" />
            Application profile
          </span>
          <IconChevronRight size={18} stroke={1.5} className="text-text-low" />
        </Link>
        <p className="-mt-2 text-xs text-text-muted">
          Fill it once — Apply Kit drafts application answers from it on any hackathon.
        </p>
      </section>

      {canRefreshSources && (
        <section className="mt-8 flex flex-col gap-4">
          <h2 className="text-lg font-medium">Data sources</h2>
          <ManualRefresh />
        </section>
      )}

      <section className="mt-10">
        <button
          onClick={signOut}
          className="min-h-11 w-full rounded-md border border-border px-4 text-sm text-text-muted transition-colors duration-150 ease-out hover:border-border-focus"
        >
          Sign out
        </button>
      </section>
    </main>
  )
}
