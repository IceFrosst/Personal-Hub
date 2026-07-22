'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CHEAP_FROM_LT_COUNTRIES,
  coerceNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from '@/lib/types'
import PushToggle from './PushToggle'
import ManualRefresh from './ManualRefresh'
import { IconArrowLeft, IconChevronRight, IconFileText } from '@tabler/icons-react'
import Link from 'next/link'

// Hide internal alias rows from the UI
const UI_COUNTRIES = CHEAP_FROM_LT_COUNTRIES.filter((c) => c.value !== 'czech')

export default function SettingsPanel({
  userId,
  canRefreshSources,
}: {
  userId: string
  canRefreshSources: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS)
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
        setSettings(coerceNotificationSettings(data?.notification_settings))
        setLoaded(true)
      })
  }, [supabase, userId])

  const persist = async (next: NotificationSettings) => {
    setSettings(next)
    await supabase
      .schema('hackathon')
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          notification_settings: next,
        },
        { onConflict: 'user_id' }
      )
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const toggleCountry = (value: string) => {
    const set = new Set(settings.priority_countries)
    if (set.has(value)) set.delete(value)
    else set.add(value)
    // Keep czech aliases in sync
    if (value === 'czechia') {
      if (set.has('czechia')) {
        set.add('czech')
        set.add('czech republic')
      } else {
        set.delete('czech')
        set.delete('czech republic')
      }
    }
    persist({ ...settings, priority_countries: [...set] })
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

      <section className="mb-8 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Home base</h2>
          {saved && <span className="text-xs text-green">saved</span>}
        </div>
        <p className="text-xs text-text-muted">
          Travel reimbursements only boost your score when the policy covers someone based here
          (not US-only / Africa-only / domestic-of-venue).
        </p>
        {loaded && (
          <select
            value={settings.home_base}
            onChange={(e) => persist({ ...settings, home_base: e.target.value })}
            className="min-h-11 rounded-md border border-border bg-bg px-3 text-sm text-text focus:border-border-focus focus:outline-none"
          >
            {UI_COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
                {c.note ? ` — ${c.note}` : ''}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Priority countries</h2>
          {saved && <span className="text-xs text-green">saved</span>}
        </div>
        <p className="text-xs text-text-muted">
          Events in selected countries get <span className="font-medium text-text">+30</span>.
          Confirmed travel <span className="font-medium text-text">for your home base</span> is{' '}
          <span className="font-medium text-text">+50</span> (selective / unclear = +12).
        </p>
        {loaded && (
          <div className="flex flex-col gap-1.5">
            {UI_COUNTRIES.map((c) => {
              const checked = settings.priority_countries.includes(c.value)
              return (
                <label
                  key={c.value}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors ${
                    checked
                      ? 'border-purple/40 bg-purple/10 text-text'
                      : 'border-border text-text-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCountry(c.value)}
                    className="h-4 w-4 accent-[#8e4ec6]"
                  />
                  <span className="flex flex-1 flex-col">
                    <span className="font-medium">{c.label}</span>
                    {c.note && <span className="text-xs text-text-low">{c.note}</span>}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-8 flex flex-col gap-4">
        <h2 className="text-lg font-medium">Notifications</h2>
        <PushToggle userId={userId} />
        {loaded && (
          <label className="flex flex-col gap-2 text-sm text-text-muted">
            <span>
              Notify me when a hackathon scores at least{' '}
              <span className="font-semibold text-text">{settings.min_score}</span>
            </span>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={settings.min_score}
              onChange={(e) =>
                persist({ ...settings, min_score: parseInt(e.target.value, 10) })
              }
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
