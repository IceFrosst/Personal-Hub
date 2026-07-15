'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  IconArrowLeft,
  IconBrandGoogle,
  IconCalendarBolt,
  IconCircleCheck,
  IconCircle,
  IconRefresh,
  IconRepeat,
  IconSettings,
} from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SETTINGS, type PlanBlock, type PlanSettings } from '@/lib/game-plan/types'
import { addDays, todayInTz } from '@/lib/game-plan/time'
import { TASK_CATEGORIES } from '@/lib/types'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

type Connection = { google_email: string | null; connected_at: string } | null
type Day = 'today' | 'tomorrow'

export default function GamePlanClient() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [providerToken, setProviderToken] = useState<string | null>(null)
  const [connection, setConnection] = useState<Connection>(null)
  const [settings, setSettings] = useState<PlanSettings | null>(null)
  const [blocks, setBlocks] = useState<PlanBlock[]>([])
  const [day, setDay] = useState<Day>('today')
  const [loading, setLoading] = useState(true)
  const [planning, setPlanning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const tz = settings?.timezone ?? DEFAULT_SETTINGS.timezone
  const todayStr = useMemo(() => todayInTz(tz), [tz])
  const activeDate = useMemo(
    () => (day === 'today' ? todayStr : addDays(todayStr, 1)),
    [day, todayStr]
  )

  const loadBlocks = useCallback(
    async (uid: string, dateKey: string) => {
      const { data } = await supabase
        .schema('lock_in')
        .from('plan_blocks')
        .select('*')
        .eq('user_id', uid)
        .eq('plan_date', dateKey)
        .order('start_local', { ascending: true })
      setBlocks((data ?? []) as PlanBlock[])
    },
    [supabase]
  )

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback?next=/game-plan` },
        })
        return
      }
      setUserId(user.id)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      setProviderToken(session?.provider_token ?? null)
      const refreshToken = session?.provider_refresh_token ?? null

      const [{ data: conn }, { data: settingsRow }] = await Promise.all([
        supabase
          .schema('lock_in')
          .from('calendar_connections')
          .select('google_email, connected_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .schema('lock_in')
          .from('plan_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
      ])

      let connectionRow = (conn as Connection) ?? null

      if (!connectionRow && refreshToken) {
        try {
          const res = await fetch('/api/game-plan/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken, email: session?.user?.email }),
          })
          if (res.ok) {
            connectionRow = {
              google_email: session?.user?.email ?? null,
              connected_at: new Date().toISOString(),
            }
          }
        } catch {
          // stays disconnected; the status flag below explains
        }
      }

      const cal = new URLSearchParams(window.location.search).get('cal')
      if (cal && !connectionRow) {
        setError(
          "Couldn't finish connecting your calendar. Tap Connect Google Calendar again and make sure you allow calendar access."
        )
      }
      if (cal) window.history.replaceState({}, '', '/game-plan')

      setConnection(connectionRow)
      const resolved = (settingsRow as PlanSettings) ?? {
        user_id: user.id,
        ...DEFAULT_SETTINGS,
        updated_at: new Date().toISOString(),
      }
      setSettings(resolved)
      await loadBlocks(user.id, todayInTz(resolved.timezone))
      setLoading(false)
    }
    init()
  }, [supabase, loadBlocks])

  async function switchDay(next: Day) {
    if (next === day) return
    setDay(next)
    setMessage(null)
    setError(null)
    if (userId) {
      const dateKey = next === 'today' ? todayStr : addDays(todayStr, 1)
      await loadBlocks(userId, dateKey)
    }
  }

  async function connectCalendar() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: CALENDAR_SCOPE,
        redirectTo: `${window.location.origin}/auth/callback?next=/game-plan&connect=1`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  async function planDay() {
    if (planning) return
    setPlanning(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/game-plan/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerToken, day }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'not_connected') setError('Connect your Google Calendar first.')
        else if (data.error === 'reconnect_needed')
          setError('Calendar access expired — reconnect to finish setup.')
        else setError('Planning failed. Try again in a moment.')
        return
      }

      setBlocks((data.blocks ?? []) as PlanBlock[])
      const when = day === 'today' ? 'today' : 'tomorrow'
      if (data.scheduledCount === 0) {
        setMessage(
          data.totalTasks === 0
            ? 'Nothing to schedule — add tasks or routines in Lock In.'
            : `Nothing fit the free time ${when}.`
        )
      } else {
        setMessage(`Planned ${data.scheduledCount} block${data.scheduledCount === 1 ? '' : 's'} for ${when}.`)
      }
    } catch {
      setError('Planning failed. Check your connection and try again.')
    } finally {
      setPlanning(false)
    }
  }

  const toggleBlockDone = useCallback(
    async (block: PlanBlock) => {
      if (!userId) return
      const nextStatus = block.status === 'done' ? 'scheduled' : 'done'
      const done = nextStatus === 'done'
      setBlocks((prev) =>
        prev.map((b) => (b.id === block.id ? { ...b, status: nextStatus } : b))
      )

      const { error: blockErr } = await supabase
        .schema('lock_in')
        .from('plan_blocks')
        .update({ status: nextStatus })
        .eq('id', block.id)

      if (blockErr) {
        setBlocks((prev) =>
          prev.map((b) => (b.id === block.id ? { ...b, status: block.status } : b))
        )
        setError('Could not update — try again.')
        return
      }

      // Mirror to the underlying task or routine so the plan and list stay in sync.
      if (block.task_id) {
        await supabase
          .schema('focus_gate')
          .from('tasks')
          .update({ is_completed: done })
          .eq('id', block.task_id)
      } else if (block.recurring_id) {
        if (done) {
          await supabase
            .schema('lock_in')
            .from('recurring_completions')
            .upsert(
              {
                user_id: userId,
                recurring_id: block.recurring_id,
                completed_date: block.plan_date,
              },
              { onConflict: 'recurring_id,completed_date' }
            )
        } else {
          await supabase
            .schema('lock_in')
            .from('recurring_completions')
            .delete()
            .eq('recurring_id', block.recurring_id)
            .eq('completed_date', block.plan_date)
        }
      }
    },
    [supabase, userId]
  )

  async function saveSettings(patch: Partial<PlanSettings>) {
    if (!userId || !settings) return
    const next = { ...settings, ...patch, updated_at: new Date().toISOString() }
    setSettings(next)
    await supabase
      .schema('lock_in')
      .from('plan_settings')
      .upsert(
        {
          user_id: userId,
          work_start: next.work_start,
          work_end: next.work_end,
          timezone: next.timezone,
          auto_plan: next.auto_plan,
          updated_at: next.updated_at,
        },
        { onConflict: 'user_id' }
      )
  }

  const connected = !!connection
  const dateLabel = useMemo(
    () =>
      new Date(`${activeDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [activeDate]
  )

  return (
    <main
      className="flex flex-col items-center px-4 bg-black min-h-[100dvh]"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <header className="flex items-center gap-2.5 pt-2">
          <Link
            href="/"
            aria-label="Back to tasks"
            className="min-h-11 min-w-11 -ml-2 flex items-center justify-center text-text-muted active:text-text transition-colors"
          >
            <IconArrowLeft size={22} />
          </Link>
          <IconCalendarBolt size={26} className="text-gold" stroke={1.5} />
          <h1 className="text-2xl font-semibold tracking-tight text-text">Game Plan</h1>
        </header>

        {loading ? (
          <p className="text-text-low text-sm py-12 text-center">Loading…</p>
        ) : !connected ? (
          <ConnectCard onConnect={connectCalendar} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center rounded-lg bg-surface border border-border p-0.5">
                {(['today', 'tomorrow'] as Day[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => switchDay(d)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                      day === d ? 'bg-gold/15 text-gold' : 'text-text-muted'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowSettings((s) => !s)}
                aria-label="Settings"
                className="min-h-11 min-w-11 flex items-center justify-center text-text-muted active:text-text transition-colors"
              >
                <IconSettings size={20} />
              </button>
            </div>

            <div>
              <p className="text-text text-base font-medium">{dateLabel}</p>
              <p className="text-text-low text-xs mt-0.5">
                {connection?.google_email ?? 'Calendar connected'}
              </p>
            </div>

            {showSettings && settings && (
              <SettingsPanel settings={settings} onChange={saveSettings} />
            )}

            <button
              type="button"
              onClick={planDay}
              disabled={planning}
              className="lock-in-gold-button flex items-center justify-center gap-2 min-h-12 rounded-xl text-black font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              <IconRefresh size={18} stroke={2.4} className={planning ? 'animate-spin' : ''} />
              {planning
                ? 'Planning…'
                : `${blocks.length ? 'Replan' : 'Plan'} ${day === 'today' ? 'my day' : 'tomorrow'}`}
            </button>

            {message && (
              <p className="text-text-muted text-xs px-1 -mt-1 leading-snug">{message}</p>
            )}
            {error && (
              <p role="alert" className="text-priority-high text-xs px-1 -mt-1 leading-snug">
                {error}
              </p>
            )}

            <Timeline blocks={blocks} onToggleDone={toggleBlockDone} />
          </>
        )}
      </div>
    </main>
  )
}

function ConnectCard({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col gap-3 mt-2">
      <p className="text-text text-lg font-medium">Let AI plan your day</p>
      <p className="text-text-muted text-sm leading-relaxed">
        Connect Google Calendar and Game Plan reads your Lock In tasks, estimates how long each
        takes, and drops time blocks around your existing events — so you wake up to a scheduled
        day.
      </p>
      <button
        type="button"
        onClick={onConnect}
        className="mt-1 flex items-center justify-center gap-2 min-h-12 rounded-xl bg-surface-elevated border border-border-focus text-text font-medium active:bg-border/40 transition-colors"
      >
        <IconBrandGoogle size={18} />
        Connect Google Calendar
      </button>
    </div>
  )
}

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: PlanSettings
  onChange: (patch: Partial<PlanSettings>) => void
}) {
  return (
    <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-muted text-sm">Working hours</span>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={settings.work_start}
            onChange={(e) => onChange({ work_start: e.target.value })}
            className="bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-text outline-none focus:border-border-focus [appearance:none]"
          />
          <span className="text-text-low text-sm">to</span>
          <input
            type="time"
            value={settings.work_end}
            onChange={(e) => onChange({ work_end: e.target.value })}
            className="bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-sm text-text outline-none focus:border-border-focus [appearance:none]"
          />
        </div>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-text-muted text-sm">Auto-plan each morning</span>
        <input
          type="checkbox"
          checked={settings.auto_plan}
          onChange={(e) => onChange({ auto_plan: e.target.checked })}
          className="h-5 w-5 accent-gold"
        />
      </label>
    </div>
  )
}

function Timeline({
  blocks,
  onToggleDone,
}: {
  blocks: PlanBlock[]
  onToggleDone: (b: PlanBlock) => void
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-text-low text-sm py-10 text-center">
        No blocks yet. Tap the button above to schedule your day.
      </p>
    )
  }
  return (
    <section className="flex flex-col mt-1">
      {blocks.map((b) => {
        const done = b.status === 'done'
        const cat = b.category ? TASK_CATEGORIES.find((c) => c.value === b.category) : null
        return (
          <div key={b.id} className="flex gap-3 items-stretch">
            <div className="w-12 shrink-0 pt-3 text-right">
              <span className="text-text-muted text-xs tabular-nums">{b.start_local}</span>
            </div>
            <div className="relative flex flex-col items-center">
              <span className="h-full w-px bg-border" />
              <span
                className={`absolute top-4 h-2 w-2 rounded-full ${done ? 'bg-text-low' : 'bg-gold'}`}
              />
            </div>
            <button
              type="button"
              onClick={() => onToggleDone(b)}
              className={`flex-1 min-w-0 text-left py-2 mb-2 ${done ? 'opacity-60' : ''}`}
            >
              <div
                className="rounded-xl bg-surface border border-border px-3 py-2.5"
                style={cat ? { borderLeft: `3px solid ${cat.color}` } : undefined}
              >
                <div className="flex items-start gap-2">
                  {done ? (
                    <IconCircleCheck size={18} className="text-gold shrink-0 mt-0.5" />
                  ) : (
                    <IconCircle size={18} className="text-text-low shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-base leading-snug break-words ${
                          done ? 'line-through text-text-low' : 'text-text'
                        }`}
                      >
                        {b.title}
                      </p>
                      {b.recurring_id && (
                        <IconRepeat size={13} className="text-text-low shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-text-low text-xs tabular-nums">
                        {b.start_local}–{b.end_local}
                        {b.estimated_minutes ? ` · ${b.estimated_minutes} min` : ''}
                      </span>
                      {cat && (
                        <span
                          className="text-[11px] leading-none px-1.5 py-0.5 rounded-md font-medium"
                          style={{ color: cat.color, backgroundColor: `${cat.color}1f` }}
                        >
                          {cat.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>
        )
      })}
    </section>
  )
}
