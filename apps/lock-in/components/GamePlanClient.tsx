'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  IconArrowLeft,
  IconArrowRight,
  IconBrandGoogle,
  IconCheck,
  IconLock,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRepeat,
  IconSettings,
} from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SETTINGS, type PlanBlock, type PlanSettings } from '@/lib/game-plan/types'
import { addDays, todayInTz } from '@/lib/game-plan/time'
import {
  TASK_CATEGORIES,
  type Priority,
  type RecurringTask,
  type Task,
  type TaskCategory,
} from '@/lib/types'
import AddTaskBar, { type RecurringDraft } from '@/components/AddTaskBar'
import EditTaskSheet from '@/components/EditTaskSheet'
import EditRecurringSheet, { type RecurringUpdate } from '@/components/EditRecurringSheet'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

type Connection = { google_email: string | null; connected_at: string } | null
type Day = 'yesterday' | 'today' | 'tomorrow'
// Day → offset from today, so late-night hours can still reach the plan they
// were living before midnight rolled the date forward.
const DAY_OFFSET: Record<Day, number> = { yesterday: -1, today: 0, tomorrow: 1 }

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
  const [reordering, setReordering] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  // Long-press on a block opens an action sheet; Edit opens the shared editor.
  const [sheetBlock, setSheetBlock] = useState<PlanBlock | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editRecurring, setEditRecurring] = useState<RecurringTask | null>(null)
  // "Replace" flow: the block whose slot we're filling + the pickable tasks.
  const [replaceBlock, setReplaceBlock] = useState<PlanBlock | null>(null)
  const [replaceOptions, setReplaceOptions] = useState<Task[]>([])

  const tz = settings?.timezone ?? DEFAULT_SETTINGS.timezone
  const todayStr = useMemo(() => todayInTz(tz), [tz])
  const activeDate = useMemo(
    () => addDays(todayStr, DAY_OFFSET[day]),
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
      await loadBlocks(userId, addDays(todayStr, DAY_OFFSET[next]))
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

  // Create a one-off task from Game Plan → lands in the real to-do list.
  const addTask = useCallback(
    async (
      title: string,
      priority: Priority,
      dueDate: string | null,
      category: TaskCategory | null
    ) => {
      if (!userId) return
      const { error: insertError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .insert({
          user_id: userId,
          title,
          priority,
          due_date: dueDate,
          category,
          is_quick: false,
        })
      if (insertError) {
        setError(insertError.message)
        return
      }
      setError(null)
      setMessage(`“${title}” added to your list. Replan or use Replace to schedule it.`)
    },
    [supabase, userId]
  )

  // Create a routine from Game Plan → same table as the main list.
  const addRecurring = useCallback(
    async (title: string, draft: RecurringDraft) => {
      if (!userId) return
      const { error: insertError } = await supabase
        .schema('lock_in')
        .from('recurring_tasks')
        .insert({
          user_id: userId,
          title,
          weekdays: draft.weekdays,
          time_mode: draft.timeMode,
          fixed_time: draft.fixedTime,
          duration_minutes: draft.durationMinutes,
        })
      if (insertError) {
        setError(insertError.message)
        return
      }
      setError(null)
      setMessage(`Routine “${title}” added. Replan to give it a slot.`)
    },
    [supabase, userId]
  )

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
            ? 'Nothing to schedule — add a task below or on the main list.'
            : `Nothing fit the free time ${when}.`
        )
      } else {
        setMessage(`Planned ${data.scheduledCount} block${data.scheduledCount === 1 ? '' : 's'} for ${when}.`)
      }
      // Surface when the model didn't actually plan (rate limit / unavailable).
      if (data.ai === 'rate_limited') {
        setError('AI model is rate-limited — planned with basic estimates. Try again later.')
      } else if (data.ai === 'fallback' && data.scheduledCount > 0) {
        setError('AI was unavailable — planned with basic estimates.')
      }
    } catch {
      setError('Planning failed. Check your connection and try again.')
    } finally {
      setPlanning(false)
    }
  }

  const reorderBlocks = useCallback(
    async (orderedMovableIds: string[]) => {
      setReordering(true)
      setError(null)
      try {
        const res = await fetch('/api/game-plan/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: activeDate, orderedIds: orderedMovableIds, providerToken }),
        })
        const data = await res.json()
        if (res.ok && data.blocks) {
          setBlocks(data.blocks as PlanBlock[])
          if (data.droppedCount > 0) {
            setMessage(
              `Day's overbooked — ${data.droppedCount} block${
                data.droppedCount === 1 ? '' : 's'
              } past your work hours dropped off. Replan or extend your hours in settings.`
            )
          }
        } else {
          setError('Could not save the new order — try again.')
        }
      } catch {
        setError('Could not save the new order — check your connection.')
      } finally {
        setReordering(false)
      }
    },
    [activeDate, providerToken]
  )

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

  // Long-press → action sheet. Only task/routine blocks are editable (locked
  // calendar events aren't ours to change).
  const onBlockLongPress = useCallback((b: PlanBlock) => {
    if (b.locked || (!b.task_id && !b.recurring_id)) return
    setSheetBlock(b)
  }, [])

  // Open the shared editor for the block's underlying task / routine (fetch the
  // full row — the block only carries the denormalised display fields).
  const openEditForBlock = useCallback(
    async (b: PlanBlock) => {
      setSheetBlock(null)
      if (b.task_id) {
        const { data } = await supabase
          .schema('focus_gate')
          .from('tasks')
          .select('*')
          .eq('id', b.task_id)
          .maybeSingle()
        if (data) setEditTask(data as Task)
        else setError('Could not open the editor — this task may have been removed.')
      } else if (b.recurring_id) {
        const { data } = await supabase
          .schema('lock_in')
          .from('recurring_tasks')
          .select('*')
          .eq('id', b.recurring_id)
          .maybeSingle()
        if (data) setEditRecurring(data as RecurringTask)
        else setError('Could not open the editor — this routine may have been removed.')
      }
    },
    [supabase]
  )

  // Edit a one-off task: write the task AND mirror the denormalised fields onto
  // every plan block for it (today onward) so the timeline and list agree.
  const saveTaskEdit = useCallback(
    async (
      task: Task,
      updates: { title: string; priority: Priority; due_date: string | null; category: TaskCategory | null }
    ) => {
      setEditTask(null)
      setBlocks((prev) =>
        prev.map((b) =>
          b.task_id === task.id
            ? { ...b, title: updates.title, priority: updates.priority, category: updates.category }
            : b
        )
      )
      const { error: taskErr } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .update(updates)
        .eq('id', task.id)
      if (taskErr) {
        setError('Could not save — try again.')
        return
      }
      if (userId) {
        await supabase
          .schema('lock_in')
          .from('plan_blocks')
          .update({ title: updates.title, priority: updates.priority, category: updates.category })
          .eq('user_id', userId)
          .eq('task_id', task.id)
          .gte('plan_date', todayStr)
      }
    },
    [supabase, userId, todayStr]
  )

  // Edit a routine: write the template and sync the title onto its blocks. Time /
  // duration changes reshape the day, so those apply on the next replan.
  const saveRecurringEdit = useCallback(
    async (task: RecurringTask, updates: RecurringUpdate) => {
      setEditRecurring(null)
      setBlocks((prev) =>
        prev.map((b) => (b.recurring_id === task.id ? { ...b, title: updates.title } : b))
      )
      const { error: recErr } = await supabase
        .schema('lock_in')
        .from('recurring_tasks')
        .update(updates)
        .eq('id', task.id)
      if (recErr) {
        setError('Could not save — try again.')
        return
      }
      if (userId) {
        await supabase
          .schema('lock_in')
          .from('plan_blocks')
          .update({ title: updates.title })
          .eq('user_id', userId)
          .eq('recurring_id', task.id)
          .gte('plan_date', todayStr)
      }
      // Time / duration change → re-place the existing block(s) right away.
      const timeChanged =
        updates.time_mode !== task.time_mode ||
        updates.fixed_time !== task.fixed_time ||
        updates.duration_minutes !== task.duration_minutes
      if (timeChanged) {
        await fetch('/api/game-plan/adjust-routine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recurringId: task.id, providerToken }),
        }).catch(() => {})
        if (userId) await loadBlocks(userId, activeDate)
      }
    },
    [supabase, userId, todayStr, providerToken, activeDate, loadBlocks]
  )

  // Open the "Replace" picker: the open tasks that aren't already in the plan.
  const openReplaceForBlock = useCallback(
    async (b: PlanBlock) => {
      setSheetBlock(null)
      if (!userId) return
      const scheduled = new Set(
        blocks.map((x) => x.task_id).filter((id): id is string => Boolean(id))
      )
      const { data } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)
      const opts = ((data ?? []) as Task[]).filter((t) => !scheduled.has(t.id))
      setReplaceOptions(opts)
      setReplaceBlock(b)
    },
    [supabase, userId, blocks]
  )

  // Swap the chosen task into this block's time slot (old item leaves the plan,
  // its task/routine stays on the list).
  const replaceWithTask = useCallback(
    async (b: PlanBlock, taskId: string) => {
      setReplaceBlock(null)
      const res = await fetch('/api/game-plan/swap-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId: b.id, newTaskId: taskId, providerToken }),
      }).catch(() => null)
      if (res && res.ok && userId) {
        await loadBlocks(userId, activeDate)
      } else {
        setError('Could not replace the block — try again.')
      }
    },
    [providerToken, userId, activeDate, loadBlocks]
  )

  // "Continue tomorrow": snooze the task to the next day; today's started block
  // stays as progress (trimmed to now), an unstarted block just leaves the plan.
  const continueTomorrow = useCallback(
    async (b: PlanBlock) => {
      setSheetBlock(null)
      const res = await fetch('/api/game-plan/continue-tomorrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId: b.id, providerToken }),
      }).catch(() => null)
      if (res && res.ok && userId) {
        await loadBlocks(userId, activeDate)
        setMessage(
          `"${b.title}" moved to tomorrow — it'll get a slot when tomorrow is planned.`
        )
      } else {
        setError('Could not move the task to tomorrow — try again.')
      }
    },
    [providerToken, userId, activeDate, loadBlocks]
  )

  // Remove just this block from today's plan (and its calendar event). The
  // underlying task / routine stays on the list — a replan can re-add it.
  const removeBlockFromPlan = useCallback(
    async (b: PlanBlock) => {
      setSheetBlock(null)
      setBlocks((prev) => prev.filter((x) => x.id !== b.id))
      await fetch('/api/game-plan/cleanup-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId: b.id, providerToken }),
      }).catch(() => {})
    },
    [providerToken]
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

  return (
    <main
      className="flex flex-col items-center px-4 bg-black min-h-[100dvh]"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[420px] flex flex-col gap-4">
        <header className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-0.5 min-w-0">
            <Link
              href="/"
              aria-label="Back to tasks"
              className="min-h-11 min-w-11 -ml-2 flex items-center justify-center text-text-muted active:text-text transition-colors"
            >
              <IconArrowLeft size={22} />
            </Link>
            <h1 className="text-base font-semibold tracking-tight text-text truncate">Game Plan</h1>
          </div>

          {!loading && connected && (
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center rounded-lg bg-surface border border-border p-0.5">
                {(['yesterday', 'today', 'tomorrow'] as Day[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => switchDay(d)}
                    className={`px-1.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors ${
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
                className="min-h-11 min-w-9 -mr-1.5 flex items-center justify-center text-text-muted active:text-text transition-colors"
              >
                <IconSettings size={19} />
              </button>
            </div>
          )}
        </header>

        {loading ? (
          <p className="text-text-low text-sm py-12 text-center">Loading…</p>
        ) : !connected ? (
          <ConnectCard onConnect={connectCalendar} />
        ) : (
          <>

            {showSettings && settings && (
              <SettingsPanel settings={settings} onChange={saveSettings} />
            )}

            {day === 'yesterday' ? (
              <p className="text-text-low text-xs px-1 text-center">
                Yesterday&apos;s plan — view only. You can still tick blocks off.
              </p>
            ) : (
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
            )}

            {message && (
              <p className="text-text-muted text-xs px-1 -mt-1 leading-snug">{message}</p>
            )}
            {error && (
              <p role="alert" className="text-priority-high text-xs px-1 -mt-1 leading-snug">
                {error}
              </p>
            )}

            {/* Add task / routine directly from Game Plan → same tables as main list */}
            {day !== 'yesterday' && (
              <div className="mt-1">
                <AddTaskBar onAdd={addTask} onAddRecurring={addRecurring} disabled={!userId} />
              </div>
            )}

            {reordering && (
              <p className="text-text-low text-xs px-1 -mt-1">Saving new order…</p>
            )}
            <Timeline
              blocks={blocks}
              onToggleDone={toggleBlockDone}
              onReorder={reorderBlocks}
              onLongPress={onBlockLongPress}
            />
          </>
        )}
      </div>

      {sheetBlock && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          onClick={() => setSheetBlock(null)}
        >
          <div
            className="w-full max-w-[420px] bg-surface-elevated rounded-t-3xl border-t border-border p-4 pb-8"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text text-base truncate mb-1 px-1">{sheetBlock.title}</p>
            <p className="text-text-low text-xs mb-3 px-1">
              {sheetBlock.recurring_id ? 'Recurring routine' : 'Task'}
            </p>
            <button
              type="button"
              onClick={() => openEditForBlock(sheetBlock)}
              className="w-full min-h-12 rounded-xl bg-surface text-text font-medium active:bg-border/40 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => openReplaceForBlock(sheetBlock)}
              className="mt-2 w-full min-h-12 rounded-xl bg-surface text-text font-medium active:bg-border/40 transition-colors"
            >
              Replace with another task
            </button>
            {sheetBlock.task_id && (
              <button
                type="button"
                onClick={() => continueTomorrow(sheetBlock)}
                className="mt-2 w-full min-h-12 rounded-xl bg-surface text-text font-medium active:bg-border/40 transition-colors flex items-center justify-center gap-1.5"
              >
                Continue tomorrow
                <IconArrowRight size={16} className="text-text-muted" />
              </button>
            )}
            <button
              type="button"
              onClick={() => removeBlockFromPlan(sheetBlock)}
              className="mt-2 w-full min-h-12 rounded-xl bg-priority-high/15 text-priority-high font-medium active:bg-priority-high/25 transition-colors"
            >
              Remove from plan
            </button>
            <button
              type="button"
              onClick={() => setSheetBlock(null)}
              className="mt-2 w-full min-h-12 rounded-xl text-text-muted active:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {replaceBlock && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          onClick={() => setReplaceBlock(null)}
        >
          <div
            className="w-full max-w-[420px] bg-surface-elevated rounded-t-3xl border-t border-border p-4 pb-8 max-h-[70dvh] flex flex-col"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs uppercase tracking-wide text-text-low mb-1 px-1">
              Replace in this slot
            </p>
            <p className="text-text-low text-xs mb-3 px-1">
              {replaceBlock.start_local}–{replaceBlock.end_local} · pick a task to put here
            </p>
            {replaceOptions.length === 0 ? (
              <p className="text-text-low text-sm py-6 text-center">
                No unscheduled tasks. Add one above.
              </p>
            ) : (
              <div className="flex flex-col gap-2 overflow-y-auto min-h-0 -mx-1 px-1">
                {replaceOptions.map((t) => {
                  const c = t.category
                    ? TASK_CATEGORIES.find((x) => x.value === t.category)
                    : null
                  const due = formatDueChip(t.due_date)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => replaceWithTask(replaceBlock, t.id)}
                      className="relative shrink-0 flex items-start gap-3 py-3 pl-5 pr-3 rounded-xl overflow-hidden bg-surface active:bg-surface-elevated transition-colors text-left"
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${PRIO_ACCENT[t.priority]}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-base leading-snug break-words text-text">{t.title}</p>
                        {(c || due) && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {c && (
                              <span
                                className="text-[11px] leading-none px-1.5 py-0.5 rounded-md font-medium"
                                style={{ color: c.color, backgroundColor: `${c.color}1f` }}
                              >
                                {c.label}
                              </span>
                            )}
                            {due && (
                              <span
                                className={`text-xs ${due.overdue ? 'text-priority-high' : 'text-text-muted'}`}
                              >
                                {due.text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <IconPlus size={18} className="mt-0.5 shrink-0 text-text-low" />
                    </button>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => setReplaceBlock(null)}
              className="mt-3 w-full min-h-12 rounded-xl text-text-muted active:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {editTask && (
        <EditTaskSheet
          task={editTask}
          onSave={(updates) => saveTaskEdit(editTask, updates)}
          onClose={() => setEditTask(null)}
        />
      )}

      {editRecurring && (
        <EditRecurringSheet
          task={editRecurring}
          onSave={(updates) => saveRecurringEdit(editRecurring, updates)}
          onClose={() => setEditRecurring(null)}
        />
      )}
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

const PRIO_ACCENT: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-prio-low',
  medium: 'bg-prio-medium',
  high: 'bg-prio-high',
}

// Mirror of TaskRow's due-date chip, so the Replace picker matches the task list.
function formatDueChip(due: string | null): { text: string; overdue: boolean } | null {
  if (!due) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = due.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const overdue = diff < 0
  let text: string
  if (diff === 0) text = 'Today'
  else if (diff === 1) text = 'Tomorrow'
  else if (diff > 1 && diff < 7) text = target.toLocaleDateString(undefined, { weekday: 'short' })
  else text = target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return { text: overdue ? `Overdue · ${text}` : text, overdue }
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

// Press-and-hold this long (ms) to pick a block up. A finger that moves more
// than SCROLL_CANCEL px before then is scrolling, so we let go of the press.
const LONG_PRESS_MS = 300
const SCROLL_CANCEL = 10

function Timeline({
  blocks,
  onToggleDone,
  onReorder,
  onLongPress,
}: {
  blocks: PlanBlock[]
  onToggleDone: (b: PlanBlock) => void
  onReorder: (orderedMovableIds: string[]) => void
  onLongPress: (b: PlanBlock) => void
}) {
  const [order, setOrder] = useState<string[]>(() => blocks.map((b) => b.id))
  const [dragId, setDragId] = useState<string | null>(null)
  // How far (px) the dragged row is translated from its current slot, so it
  // tracks the finger. When the row swaps slots, the anchor shifts by the
  // swapped neighbour's height to keep the card glued to the finger.
  const [dragOffset, setDragOffset] = useState(0)
  const anchorY = useRef(0)
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map())
  const initialOrder = useRef<string[]>([])
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The live press: which block, where it started, and whether it has armed
  // (a hold long enough to become a drag).
  const press = useRef<{
    id: string
    startY: number
    pointerId: number
    el: HTMLElement
    armed: boolean
  } | null>(null)

  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks])

  // Resync when the plan changes (but never mid-drag).
  useEffect(() => {
    if (!dragId) setOrder(blocks.map((b) => b.id))
  }, [blocks, dragId])

  // While a block is picked up, block native page scroll (React's touchmove is
  // passive, so prevent it on a non-passive document listener instead).
  useEffect(() => {
    if (!dragId) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', prevent, { passive: false })
    return () => document.removeEventListener('touchmove', prevent)
  }, [dragId])

  function clearPressTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function onDown(e: React.PointerEvent, b: PlanBlock) {
    if (b.locked) return
    // Don't start a press on the checkbox — it has its own tap.
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    const el = e.currentTarget as HTMLElement
    press.current = {
      id: b.id,
      startY: e.clientY,
      pointerId: e.pointerId,
      el,
      armed: false,
    }
    clearPressTimer()
    pressTimer.current = setTimeout(() => {
      const p = press.current
      if (!p) return
      // Pick the block up: capture the pointer and enter drag mode.
      p.armed = true
      p.el.setPointerCapture?.(p.pointerId)
      initialOrder.current = order
      anchorY.current = p.startY
      setDragOffset(0)
      setDragId(p.id)
      if (navigator.vibrate) navigator.vibrate(12)
    }, LONG_PRESS_MS)
  }

  function onMove(e: React.PointerEvent) {
    const p = press.current
    if (!p) return
    if (!p.armed) {
      // Still waiting to arm — a real move means the user is scrolling, so drop
      // the press and let the page scroll.
      if (Math.abs(e.clientY - p.startY) > SCROLL_CANCEL) {
        clearPressTimer()
        press.current = null
      }
      return
    }
    e.preventDefault()
    const y = e.clientY
    let nextOrder = order
    const idx = order.indexOf(p.id)

    if (idx > 0) {
      const el = rowRefs.current.get(order[idx - 1])
      if (el) {
        const r = el.getBoundingClientRect()
        if (y < r.top + r.height / 2) {
          // Moving up one slot: the row's natural position rises by the
          // neighbour's height, so shift the anchor to keep it under the finger.
          nextOrder = swap(order, idx, idx - 1)
          anchorY.current -= r.height
        }
      }
    }
    if (nextOrder === order && idx < order.length - 1) {
      const el = rowRefs.current.get(order[idx + 1])
      if (el) {
        const r = el.getBoundingClientRect()
        if (y > r.top + r.height / 2) {
          nextOrder = swap(order, idx, idx + 1)
          anchorY.current += r.height
        }
      }
    }

    if (nextOrder !== order) setOrder(nextOrder)
    setDragOffset(y - anchorY.current)
  }

  function onUp() {
    const p = press.current
    press.current = null
    clearPressTimer()
    if (!p || !p.armed) return
    setDragId(null)
    setDragOffset(0) // snaps the card into its slot (animated by the transition)
    // A drag → persist the new order if it changed. (Editing is the pencil.)
    if (order.join() !== initialOrder.current.join()) {
      const movableIds = order.filter((id) => {
        const b = byId.get(id)
        return b && !b.locked
      })
      onReorder(movableIds)
    }
  }

  if (blocks.length === 0) {
    return (
      <p className="text-text-low text-sm py-10 text-center">
        No blocks yet. Tap the button above to schedule your day.
      </p>
    )
  }

  return (
    <section className="flex flex-col mt-1">
      {order.map((id) => {
        const b = byId.get(id)
        if (!b) return null
        const done = b.status === 'done'
        const continued = b.status === 'continued'
        const isRecurring = !!b.recurring_id
        const cat = b.category ? TASK_CATEGORIES.find((c) => c.value === b.category) : null
        const dragging = dragId === b.id
        // Recurring = white; locked (calendar events) = muted; tasks take priority colour.
        const accent = b.locked
          ? 'bg-text-low'
          : isRecurring
            ? 'bg-white/70'
            : PRIO_ACCENT[b.priority ?? 'medium']
        const checkbox = b.locked
          ? done
            ? 'bg-text-muted border-text-muted text-black'
            : 'border-border-focus text-transparent active:border-text-muted'
          : done || continued
            ? isRecurring
              ? 'bg-white/10 border-white text-white'
              : 'bg-gold/10 border-gold text-gold'
            : `border-border-focus text-transparent ${isRecurring ? 'active:border-white' : 'active:border-gold'}`
        return (
          <div
            key={b.id}
            ref={(el) => {
              if (el) rowRefs.current.set(b.id, el)
              else rowRefs.current.delete(b.id)
            }}
            className={
              dragging
                ? 'relative z-10 transition-none'
                : 'transition-transform duration-150 ease-out'
            }
            style={dragging ? { transform: `translateY(${dragOffset}px)` } : undefined}
          >
            <div className={`min-w-0 py-1.5 ${done || continued ? 'opacity-60' : ''}`}>
              <div
                onPointerDown={b.locked ? undefined : (e) => onDown(e, b)}
                onPointerMove={b.locked ? undefined : onMove}
                onPointerUp={b.locked ? undefined : onUp}
                onPointerCancel={b.locked ? undefined : onUp}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative flex items-start gap-2 pl-5 pr-2 py-2.5 rounded-xl border overflow-hidden transition-[background-color,border-color,box-shadow] duration-150 ${
                  b.locked
                    ? 'bg-surface/60 border-border/70'
                    : dragging
                      ? 'bg-surface-elevated border-border-focus shadow-[0_8px_24px_rgba(0,0,0,0.5)] scale-[1.02] select-none'
                      : 'bg-surface border-border select-none cursor-grab'
                }`}
              >
                <span aria-hidden className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent}`} />

                <button
                  type="button"
                  data-no-drag
                  onClick={() => onToggleDone(b)}
                  aria-label={done ? 'Mark not done' : 'Mark done'}
                  className={`mt-0.5 shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors ${checkbox}`}
                >
                  {continued ? (
                    <IconArrowRight size={14} stroke={3} />
                  ) : (
                    <IconCheck size={14} stroke={3} />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-base leading-snug break-words ${
                        done
                          ? 'line-through text-text-low'
                          : b.locked
                            ? 'text-text-muted'
                            : 'text-text'
                      }`}
                    >
                      {b.title}
                    </p>
                    {isRecurring && <IconRepeat size={13} className="text-text-low shrink-0" />}
                    {b.locked && <IconLock size={12} className="text-text-low shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-text-low text-xs tabular-nums">
                      {b.start_local}–{b.end_local}
                      {b.estimated_minutes ? ` · ${b.estimated_minutes} min` : ''}
                    </span>
                    {b.locked && <span className="text-text-low text-[11px]">calendar</span>}
                    {continued && <span className="text-gold/80 text-[11px]">→ tomorrow</span>}
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

                {!b.locked && (
                  <button
                    type="button"
                    data-no-drag
                    onClick={() => onLongPress(b)}
                    aria-label="Edit block"
                    className="mt-0.5 shrink-0 h-8 w-8 -mr-1 flex items-center justify-center rounded-md text-text-low active:text-text active:bg-border/40 transition-colors"
                  >
                    <IconPencil size={17} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </section>
  )
}
