'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  coerceProfile,
  EMPTY_PROFILE,
  PROFILE_FIELD_META,
  type ApplicationProfile,
} from '@/lib/apply-kit'
import { IconArrowLeft, IconFileText } from '@tabler/icons-react'
import Link from 'next/link'

// The Apply Kit profile: fill once, reuse on every application. Saves are
// debounced on change — there is no explicit save button to forget to press.

export default function ProfileEditor({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<ApplicationProfile>(EMPTY_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    supabase
      .schema('hackathon')
      .from('application_profiles')
      .select('profile')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // Table missing (migration 0002 not applied yet) or transient — the
          // form still opens; saving will surface the real problem.
          setLoaded(true)
          return
        }
        setProfile(coerceProfile(data?.profile))
        setLoaded(true)
      })
  }, [supabase, userId])

  const update = (key: keyof ApplicationProfile, value: string) => {
    const next = { ...profile, [key]: value }
    setProfile(next)
    setState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .schema('hackathon')
        .from('application_profiles')
        .upsert(
          { user_id: userId, profile: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      setState(error ? 'error' : 'saved')
    }, 700)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6 safe-b safe-t">
      <header className="mb-2 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted transition-colors duration-150 ease-out hover:text-text"
          aria-label="Back to settings"
        >
          <IconArrowLeft size={22} stroke={1.5} />
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <IconFileText size={24} stroke={1.5} className="text-purple" />
          Apply Kit profile
        </h1>
      </header>

      <p className="mb-4 text-sm text-text-muted">
        Fill this once — Apply Kit drafts application answers from it. Leave anything blank; the
        drafter marks gaps as TODOs instead of inventing facts.
      </p>

      <p
        className={`mb-3 text-xs ${
          state === 'error' ? 'text-coral' : state === 'saved' ? 'text-green' : 'text-text-low'
        }`}
        aria-live="polite"
      >
        {state === 'saving'
          ? 'Saving…'
          : state === 'saved'
            ? 'Saved'
            : state === 'error'
              ? 'Could not save — is migration 0002 applied?'
              : loaded
                ? 'Autosaves as you type'
                : 'Loading…'}
      </p>

      {loaded && (
        <div className="flex flex-col gap-4 pb-8">
          {PROFILE_FIELD_META.map(({ key, label, multiline, placeholder }) => (
            <label key={key} className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-text-muted">{label}</span>
              {multiline ? (
                <textarea
                  value={profile[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  className="rounded-md border border-border bg-surface px-3 py-2.5 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
                />
              ) : (
                <input
                  type="text"
                  value={profile[key]}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={placeholder}
                  className="min-h-11 rounded-md border border-border bg-surface px-3 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
                />
              )}
            </label>
          ))}
        </div>
      )}
    </main>
  )
}
