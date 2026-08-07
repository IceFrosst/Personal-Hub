'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  IconArrowLeft,
  IconArrowRight,
  IconBolt,
  IconBrandGoogle,
  IconCalendarBolt,
  IconCheck,
  IconGripVertical,
  IconLock,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRepeat,
  IconSettings,
  IconX,
} from '@tabler/icons-react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_SETTINGS, type PlanBlock, type PlanSettings } from '@/lib/game-plan/types'
import { addDays, todayInTz } from '@/lib/game-plan/time'
import {
  TASK_CATEGORIES,
  type Priority,
  type TaskPriority,
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
  // Deep Work: tasks assigned to each session block, plus the open manage sheet.
  const [sessionItems, setSessionItems] = useState<Record<string, Task[]>>({})
  const [sessionSheet, setSessionSheet] = useState<PlanBlock | null>(null)
  const [pickerFor, setPickerFor] = useState<PlanBlock | null>(null)
  const [pickerTasks, setPickerTasks] = useState<Task[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // Only tasks created right here, still waiting to be placed. Deliberately not
  // backfilled from the DB: the tray is the tail end of "I just added this",
  // not a second copy of the task list.
  const [justAdded, setJustAdded] = useState<Task[]>([])
  const [dragTask, setDragTask] = useState<Task | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  // Which block the drop lands after (null = first thing in the day).
  const [dropAfter, setDropAfter] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
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
      const rows = (data ?? []) as PlanBlock[]
      setBlocks(rows)

      // Pull the task list for each Deep Work session in one round trip.
      const sessionIds = rows.filter((b) => b.kind === 'deep_work').map((b) => b.id)
      if (sessionIds.length === 0) {
        setSessionItems({})
        return
      }
      const { data: items } = await supabase
        .schema('lock_in')
        .from('deep_work_items')
        .select('block_id, task_id, position')
        .eq('user_id', uid)
        .in('block_id', sessionIds)
        .order('position', { ascending: true })
      const ids = [...new Set(((items ?? []) as { task_id: string }[]).map((i) => i.task_id))]
      const { data: taskRows } = ids.length
        ? await supabase.schema('focus_gate').from('tasks').select('*').in('id', ids)
        : { data: [] as Task[] }
      const byTask = new Map((taskRows ?? []).map((t) => [(t as Task).id, t as Task]))
      const grouped: Record<string, Task[]> = {}
      for (const it of (items ?? []) as { block_id: string; task_id: string }[]) {
        const t = byTask.get(it.task_id)
        if (!t) continue
        ;(grouped[it.block_id] ??= []).push(t)
      }
      setSessionItems(grouped)
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

      // Backstop for the daily cron: sweep past days' unchecked blocks (+ their
      // calendar events). Fire-and-forget; only meaningful when connected.
      if (connectionRow) {
        fetch('/api/game-plan/sweep-past', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerToken: session?.provider_token ?? null }),
        }).catch(() => {})
      }
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

  // Slot a just-added task into the existing plan (no full replan; nothing else
  // moves). Runs automatically right after the task is created.
  const fitTaskIntoPlan = useCallback(
    async (taskId: string, title: string) => {
      try {
        const res = await fetch('/api/game-plan/insert-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, day, providerToken }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (data.error === 'not_connected') setError('Connect your Google Calendar first.')
          else if (data.error === 'reconnect_needed')
            setError('Calendar access expired — reconnect to finish setup.')
          else setError(`“${title}” added, but couldn’t be scheduled. Try Replan.`)
          return
        }
        setBlocks((data.blocks ?? []) as PlanBlock[])
        if (data.inserted) {
          setMessage(
            `Slotted “${data.inserted.title}” at ${data.inserted.start}–${data.inserted.end}${
              data.pastHours ? ' (just past your work hours)' : ''
            }.`
          )
        } else if (data.reason === 'already_scheduled') {
          setMessage(`“${title}” is already in the plan.`)
        } else {
          setMessage(`“${title}” added, but couldn’t be scheduled — try Replan.`)
        }
      } catch {
        setError(`“${title}” added, but scheduling failed. Try Replan.`)
      }
    },
    [day, providerToken]
  )

  // Create a one-off task from Game Plan → lands in the real to-do list, then is
  // automatically fit into the current plan.
  const addTask = useCallback(
    async (
      title: string,
      priority: TaskPriority,
      dueDate: string | null,
      category: TaskCategory | null
    ) => {
      if (!userId) return
      const { data, error: insertError } = await supabase
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
        .select('id')
        .single()
      if (insertError) {
        setError(insertError.message)
        return
      }
      setError(null)
      setMessage(null)
      // Don't place it — it drops into the tray under the day, and you decide
      // whether it belongs in a session or gets a slot of its own.
      if (data?.id) {
        setJustAdded((prev) => [
          ...prev,
          {
            id: data.id as string,
            title,
            priority,
            due_date: dueDate,
            category,
            is_completed: false,
          } as Task,
        ])
      }
    },
    [supabase, userId]
  )

  // --- reorder tasks inside a session ------------------------------------
  // Press and hold a row in the manage sheet to pick it up, then drag: the list
  // reshuffles live and the new order is written to `position` on release.
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const itemDrag = useRef<{ blockId: string; taskId: string } | null>(null)
  const itemRefs = useRef(new Map<string, HTMLElement>())

  // No handle any more, so the row itself is the drag surface — which means a
  // long-press, exactly like the timeline blocks: the list has to stay
  // scrollable, and holding still keeps the browser from claiming the gesture
  // before we arm. A pre-arm move of >10px is a scroll, not a drag (a couple of
  // pixels of finger jitter is not).
  const itemHold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const itemStart = useRef<{ x: number; y: number } | null>(null)

  function onItemDown(e: React.PointerEvent, blockId: string, taskId: string) {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    itemStart.current = { x: e.clientX, y: e.clientY }
    itemHold.current = setTimeout(() => {
      itemDrag.current = { blockId, taskId }
      setDragItemId(taskId)
    }, 300)
  }

  function onItemMove(e: React.PointerEvent) {
    if (!itemDrag.current) {
      const st = itemStart.current
      if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10 && itemHold.current) {
        clearTimeout(itemHold.current)
        itemHold.current = null
      }
      return
    }
    const { blockId, taskId } = itemDrag.current
    const list = sessionItems[blockId] ?? []
    const from = list.findIndex((t) => t.id === taskId)
    if (from < 0) return
    // Which row is the finger over right now?
    let to = -1
    list.forEach((t, i) => {
      const el = itemRefs.current.get(t.id)
      if (!el) return
      const r = el.getBoundingClientRect()
      if (e.clientY >= r.top && e.clientY <= r.bottom) to = i
    })
    if (to >= 0 && to !== from) {
      const next = [...list]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      setSessionItems((prev) => ({ ...prev, [blockId]: next }))
    }
  }

  const onItemUp = useCallback(() => {
    if (itemHold.current) clearTimeout(itemHold.current)
    itemHold.current = null
    itemStart.current = null
    const d = itemDrag.current
    itemDrag.current = null
    setDragItemId(null)
    if (!d) return
    const order = (sessionItems[d.blockId] ?? []).map((t) => t.id)
    if (order.length < 2) return
    fetch('/api/game-plan/session-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockId: d.blockId, order }),
    }).catch(() => setError('Couldn’t save the new order.'))
  }, [sessionItems])

  // Keep the page still while a row is held.
  useEffect(() => {
    if (!dragItemId) return
    const stop = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', stop, { passive: false })
    return () => document.removeEventListener('touchmove', stop)
  }, [dragItemId])

  // --- drag a tray task onto the day -------------------------------------
  // Press and hold a chip to lift it, drag over the timeline, release on a Deep
  // Work session to put it inside, or anywhere else on the day to give it its
  // own slot. Hit-testing is done with elementFromPoint against `data-drop`
  // markers so the drop zones stay declarative.
  const dragRef = useRef<Task | null>(null)

  const hitTest = useCallback(
    (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      const target = el?.closest('[data-drop]')?.getAttribute('data-drop') ?? null
      setDropTarget(target)
      if (target !== 'day') {
        setDropAfter(null)
        return
      }
      // Insert after the LAST row whose midpoint is above the finger. Measuring
      // every row instead of asking what's directly under the finger matters:
      // elementFromPoint returns null over a locked block, a gap, or the drop
      // indicator itself, and the old code read that as "append to the end" —
      // which is how a task dropped mid-morning landed at 21:40.
      let after: string | null = null
      for (const b of blocks) {
        if (b.locked) continue
        const el2 = document.querySelector(`[data-block="${b.id}"]`) as HTMLElement | null
        if (!el2) continue
        const r = el2.getBoundingClientRect()
        if (y > r.top + r.height / 2) after = b.id
      }
      setDropAfter(after)
    },
    [blocks]
  )

  // While a chip is held, swallow touchmove so the page doesn't scroll under it.
  useEffect(() => {
    if (!dragTask) return
    const stop = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', stop, { passive: false })
    return () => document.removeEventListener('touchmove', stop)
  }, [dragTask])

  // Arm on touch-down rather than after a hold: the chip has no other gesture,
  // and a hold timer was fragile — the slightest finger jitter cancelled it
  // before it ever fired. The chips carry `touch-none` so the browser doesn't
  // claim the gesture for scrolling and pointercancel the drag out from under us.
  function onChipDown(e: React.PointerEvent, task: Task) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = task
    setDragTask(task)
    setDragPos({ x: e.clientX, y: e.clientY })
    hitTest(e.clientX, e.clientY)
  }

  function onChipMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setDragPos({ x: e.clientX, y: e.clientY })
    hitTest(e.clientX, e.clientY)
  }

  /** Drop a tray task into a Deep Work session. */
  const placeInSession = useCallback(
    async (task: Task, blockId: string) => {
      setJustAdded((prev) => prev.filter((t) => t.id !== task.id))
      setSessionItems((prev) => ({ ...prev, [blockId]: [...(prev[blockId] ?? []), task] }))
      const res = await fetch('/api/game-plan/session-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, add: [task.id] }),
      })
      if (!res.ok) {
        setError('Couldn’t add that to the session.')
        if (userId) await loadBlocks(userId, activeDate)
      }
    },
    [userId, activeDate, loadBlocks]
  )

  /** Drop a tray task onto the day itself — it gets a time block of its own. */
  /** Drop onto the day at the exact spot released; the day reflows around it. */
  const placeInDay = useCallback(
    async (task: Task, afterBlockId: string | null) => {
      setPlacing(true)
      setJustAdded((prev) => prev.filter((t) => t.id !== task.id))
      try {
        const res = await fetch('/api/game-plan/insert-at', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, afterBlockId, day, providerToken }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError('Couldn’t fit that into the day.')
        } else if (data.inserted) {
          setMessage(
            `“${data.inserted.title}” · ${data.inserted.minutes} min at ${data.inserted.start}.`
          )
        }
      } catch {
        setError('Couldn’t fit that into the day.')
      } finally {
        setPlacing(false)
        if (userId) await loadBlocks(userId, activeDate)
      }
    },
    [day, providerToken, userId, activeDate, loadBlocks]
  )

  const endDrag = useCallback(() => {
    const task = dragRef.current
    const target = dropTarget
    dragRef.current = null
    setDragTask(null)
    setDragPos(null)
    setDropTarget(null)
    setDropAfter(null)
    if (!task || !target) return
    if (target.startsWith('session:')) placeInSession(task, target.slice('session:'.length))
    else if (target === 'day') placeInDay(task, dropAfter)
  }, [dropTarget, dropAfter, placeInSession, placeInDay])


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
          is_mandatory: draft.mandatory,
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

      const planned = (data.blocks ?? []) as PlanBlock[]
      setBlocks(planned)
      await loadBlocks(userId as string, activeDate)
      // A day with no 2h stretch left gets no session — say so, otherwise the
      // feature just looks broken on a heavily booked day.
      const wantSessions = settings?.deep_work_count ?? 0
      if (wantSessions > 0 && !planned.some((b) => b.kind === 'deep_work')) {
        setMessage(
          'No room for a Deep Work session — routines and calendar events fill the day. Free up a stretch or shorten a routine.'
        )
        return
      }
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
          if (data.overflowCount > 0) {
            setMessage("Day's overbooked — some blocks now run past your work hours.")
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

  // --- Deep Work sessions -------------------------------------------------
  // Complete a task from inside a session (same write as the main list).
  const toggleSessionTask = useCallback(
    async (blockId: string, task: Task) => {
      const done = !task.is_completed
      setSessionItems((prev) => ({
        ...prev,
        [blockId]: (prev[blockId] ?? []).map((t) =>
          t.id === task.id ? { ...t, is_completed: done } : t
        ),
      }))
      const { error: writeError } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .update({ is_completed: done })
        .eq('id', task.id)
      if (writeError) {
        setSessionItems((prev) => ({
          ...prev,
          [blockId]: (prev[blockId] ?? []).map((t) =>
            t.id === task.id ? { ...t, is_completed: !done } : t
          ),
        }))
        setError(writeError.message)
      }
    },
    [supabase]
  )

  // Open tasks that aren't already in a session and don't have their own block.
  const openPicker = useCallback(
    async (block: PlanBlock) => {
      if (!userId) return
      setPickerFor(block)
      setPicked(new Set())
      const { data } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', false)
      const assigned = new Set(Object.values(sessionItems).flat().map((t) => t.id))
      const scheduled = new Set(blocks.map((b) => b.task_id).filter(Boolean) as string[])
      setPickerTasks(
        ((data ?? []) as Task[]).filter((t) => !assigned.has(t.id) && !scheduled.has(t.id))
      )
    },
    [supabase, userId, sessionItems, blocks]
  )

  const commitPicked = useCallback(async () => {
    if (!pickerFor || picked.size === 0) return
    const block = pickerFor
    const add = [...picked]
    setPickerFor(null)
    const res = await fetch('/api/game-plan/session-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockId: block.id, add }),
    })
    if (!res.ok) {
      setError('Couldn’t add those to the session.')
      return
    }
    setSessionItems((prev) => ({
      ...prev,
      [block.id]: [...(prev[block.id] ?? []), ...pickerTasks.filter((t) => picked.has(t.id))],
    }))
  }, [pickerFor, picked, pickerTasks])

  const removeFromSession = useCallback(async (blockId: string, taskId: string) => {
    setSessionItems((prev) => ({
      ...prev,
      [blockId]: (prev[blockId] ?? []).filter((t) => t.id !== taskId),
    }))
    await fetch('/api/game-plan/session-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockId, remove: [taskId] }),
    })
  }, [])

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
      updates: {
        title: string
        priority: TaskPriority
        due_date: string | null
        category: TaskCategory | null
      }
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
      // A task can also live inside a Deep Work session, which has no block —
      // keep those lists in step or the sheet shows the old title.
      setSessionItems((prev) => {
        const next: Record<string, Task[]> = {}
        for (const [blockId, list] of Object.entries(prev)) {
          next[blockId] = list.map((t) => (t.id === task.id ? { ...t, ...updates } : t))
        }
        return next
      })
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
          deep_work_count: next.deep_work_count ?? 2,
          deep_work_min_minutes: next.deep_work_min_minutes ?? 120,
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
        <header className="flex items-center justify-between gap-1.5 pt-2">
          <div className="flex items-center gap-1 min-[390px]:gap-1.5 min-w-0">
            <Link
              href="/"
              aria-label="Back to tasks"
              className="min-h-11 min-w-11 -ml-2 flex items-center justify-center text-text-muted active:text-text transition-colors"
            >
              <IconArrowLeft size={22} />
            </Link>
            <IconCalendarBolt
              size={20}
              stroke={1.5}
              className="text-gold shrink-0 min-[390px]:w-[22px] min-[390px]:h-[22px]"
            />
            <h1 className="text-base min-[390px]:text-lg font-semibold tracking-tight text-text truncate">
              Game Plan
            </h1>
          </div>

          {!loading && connected && (
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center rounded-lg bg-surface border border-border p-0.5">
                {(['yesterday', 'today', 'tomorrow'] as Day[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => switchDay(d)}
                    className={`px-1 min-[390px]:px-1.5 py-1 rounded-md text-[10px] min-[390px]:text-[11px] font-medium capitalize transition-colors ${
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
                className="min-h-11 min-w-8 min-[390px]:min-w-9 -mr-2 flex items-center justify-center text-text-muted active:text-text transition-colors"
              >
                <IconSettings size={18} className="min-[390px]:w-5 min-[390px]:h-5" />
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
                className="lock-in-gold-button self-center flex items-center justify-center gap-2 min-h-12 px-10 rounded-xl text-black font-semibold active:scale-[0.99] transition-transform disabled:opacity-60"
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

            {reordering && (
              <p className="text-text-low text-xs px-1 -mt-1">Saving new order…</p>
            )}
            <Timeline
              blocks={blocks}
              sessionItems={sessionItems}
              trayDragging={!!dragTask}
              dropTarget={dropTarget}
              dropAfter={dropAfter}
              onToggleDone={toggleBlockDone}
              onToggleSessionTask={toggleSessionTask}
              onOpenSession={setSessionSheet}
              onReorder={reorderBlocks}
              onLongPress={onBlockLongPress}
            />

            {/* Not placed yet — drag a chip onto the day or into a session. */}
            {day !== 'yesterday' && justAdded.length > 0 && (
              <div className="mt-1">
                <div className="flex items-center gap-2 px-1 mb-2">
                  <p className="text-text-low text-[11px] uppercase tracking-wide font-semibold">
                    Just added
                  </p>
                  <span className="text-text-low text-[11px]">
                    {dragTask ? 'drop on the day or a session' : 'drag onto your day'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {justAdded.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onPointerDown={(e) => onChipDown(e, t)}
                      onPointerMove={onChipMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`relative max-w-full flex items-center gap-2 pl-3.5 pr-3 py-2 rounded-xl border overflow-hidden text-left select-none touch-none transition-opacity ${
                        dragTask?.id === t.id
                          ? 'opacity-30 border-border bg-surface'
                          : 'bg-surface border-border active:bg-surface-elevated'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          t.priority ? PRIO_ACCENT[t.priority] : 'bg-border-focus'
                        }`}
                      />
                      <IconGripVertical size={14} className="text-text-low shrink-0" />
                      <span className="text-sm text-text truncate">{t.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add task / routine directly from Game Plan → same tables as main list.
                Lives at the bottom, below the planned day. */}
            {day !== 'yesterday' && (
              <div className="mt-2 pt-4 border-t border-border">
                <AddTaskBar
                  onAdd={addTask}
                  onAddRecurring={addRecurring}
                  disabled={!userId}
                  showTag={false}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* The chip riding the finger while dragging */}
      {dragTask && dragPos && (
        <div
          className="fixed z-[60] pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-elevated border border-gold/60 shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-w-[240px]">
            <IconGripVertical size={14} className="text-gold shrink-0" />
            <span className="text-sm text-text truncate">{dragTask.title}</span>
          </div>
        </div>
      )}

      {placing && (
        <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center pointer-events-none">
          <span className="text-xs text-text-muted bg-surface-elevated border border-border rounded-full px-3 py-1.5">
            Finding a slot…
          </span>
        </div>
      )}

      {/* Manage a Deep Work session */}
      {sessionSheet && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          onClick={() => setSessionSheet(null)}
        >
          <div
            className="w-full max-w-[420px] bg-surface-elevated rounded-t-3xl border-t border-border px-4 pt-3"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-9 rounded-full bg-border mx-auto mb-4" />

            <div className="flex items-center gap-2 px-1">
              <IconBolt size={19} className="text-gold shrink-0" stroke={2} />
              <p className="flex-1 text-gold text-lg font-semibold tracking-tight">Deep Work</p>
              <span className="text-[11px] font-semibold text-gold bg-gold/15 px-2 py-1 rounded-full tabular-nums">
                {sessionDone(sessionItems[sessionSheet.id])}/
                {(sessionItems[sessionSheet.id] ?? []).length}
              </span>
            </div>
            <p className="text-text-low text-xs mt-0.5 mb-3 px-1 tabular-nums">
              {sessionSheet.start_local}–{sessionSheet.end_local}
              {sessionSheet.estimated_minutes ? ` · ${fmtDuration(sessionSheet.estimated_minutes)}` : ''}
            </p>

            <div className="max-h-[46dvh] overflow-y-auto -mx-1 px-1">
              {(sessionItems[sessionSheet.id] ?? []).length === 0 ? (
                <div className="py-8 text-center">
                  <IconBolt size={26} className="text-border-focus mx-auto mb-2" stroke={1.5} />
                  <p className="text-text-muted text-sm">This session is empty</p>
                  <p className="text-text-low text-xs mt-1">Add what you want to focus on.</p>
                </div>
              ) : (
                (sessionItems[sessionSheet.id] ?? []).map((t) => (
                  <SessionTaskLine
                    key={t.id}
                    task={t}
                    dragging={dragItemId === t.id}
                    innerRef={(el) => {
                      if (el) itemRefs.current.set(t.id, el)
                      else itemRefs.current.delete(t.id)
                    }}
                    onPointerDown={(e) => onItemDown(e, sessionSheet.id, t.id)}
                    onPointerMove={onItemMove}
                    onPointerUp={onItemUp}
                    onToggleDone={() => toggleSessionTask(sessionSheet.id, t)}
                    onRemove={() => removeFromSession(sessionSheet.id, t.id)}
                    onEdit={() => {
                      setSessionSheet(null)
                      setEditTask(t)
                    }}
                  />
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const b = sessionSheet
                setSessionSheet(null)
                openPicker(b)
              }}
              className="lock-in-gold-button mt-3 w-full min-h-12 rounded-xl text-black font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
            >
              <IconPlus size={18} stroke={2.6} />
              Add tasks
            </button>
          </div>
        </div>
      )}

      {/* Pick tasks to drop into a session */}
      {pickerFor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end justify-center z-50"
          onClick={() => setPickerFor(null)}
        >
          <div
            className="w-full max-w-[420px] bg-surface-elevated rounded-t-3xl border-t border-border px-4 pt-3"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-9 rounded-full bg-border mx-auto mb-4" />

            <div className="flex items-center gap-2 px-1">
              <p className="flex-1 text-text text-lg font-semibold tracking-tight">Add to session</p>
              <span className="text-[11px] font-medium text-text-muted bg-surface border border-border px-2 py-1 rounded-full tabular-nums">
                {pickerFor.start_local}–{pickerFor.end_local}
              </span>
            </div>
            <p className="text-text-low text-xs mt-0.5 mb-3 px-1">
              Tap to choose — these need no time of their own.
            </p>

            <div className="max-h-[46dvh] overflow-y-auto -mx-1 px-1">
              {pickerTasks.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-text-muted text-sm">Nothing left to add</p>
                  <p className="text-text-low text-xs mt-1">
                    Every open task is already scheduled or in a session.
                  </p>
                </div>
              ) : (
                pickerTasks.map((t) => (
                  <SessionTaskLine
                    key={t.id}
                    task={t}
                    selected={picked.has(t.id)}
                    onSelect={() =>
                      setPicked((prev) => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id)
                        else next.add(t.id)
                        return next
                      })
                    }
                  />
                ))
              )}
            </div>

            <button
              type="button"
              onClick={commitPicked}
              disabled={picked.size === 0}
              className="lock-in-gold-button mt-3 w-full min-h-12 rounded-xl text-black font-semibold active:scale-[0.99] transition-transform disabled:opacity-40"
            >
              {picked.size
                ? `Add ${picked.size} task${picked.size > 1 ? 's' : ''}`
                : 'Select tasks to add'}
            </button>
          </div>
        </div>
      )}

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
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          t.priority ? PRIO_ACCENT[t.priority] : 'bg-border'
                        }`}
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-text-muted text-sm">Deep Work sessions</span>
          <p className="text-text-low text-[11px] mt-0.5">2–4h focus blocks a day</p>
        </div>
        <div className="flex items-center rounded-lg bg-surface-elevated border border-border p-0.5">
          {[0, 1, 2, 3].map((n) => {
            const active = (settings.deep_work_count ?? 2) === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ deep_work_count: n })}
                className={`min-w-9 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-gold/15 text-gold' : 'text-text-muted'
                }`}
              >
                {n === 0 ? 'Off' : n}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-text-muted text-sm">Shortest session</span>
          <p className="text-text-low text-[11px] mt-0.5">
            No session is created unless a gap this big is free
          </p>
        </div>
        <div className="flex items-center rounded-lg bg-surface-elevated border border-border p-0.5">
          {[60, 90, 120].map((n) => {
            const active = (settings.deep_work_min_minutes ?? 120) === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ deep_work_min_minutes: n })}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-gold/15 text-gold' : 'text-text-muted'
                }`}
              >
                {n === 60 ? '1h' : n === 90 ? '1.5h' : '2h'}
              </button>
            )
          })}
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

/**
 * A reserved focus session. Shows the first few assigned tasks inline so the day
 * stays readable at a glance, and hands the rest to a sheet so a full session
 * can't push the whole timeline off screen.
 */
const SESSION_PREVIEW = 3

function DeepWorkCard({
  block,
  tasks,
  onToggleTask,
  onOpen,
  dropActive,
}: {
  block: PlanBlock
  tasks: Task[]
  onToggleTask: (blockId: string, t: Task) => void
  onOpen: (b: PlanBlock) => void
  dropActive?: boolean
}) {
  const doneCount = tasks.filter((t) => t.is_completed).length
  const preview = tasks.slice(0, SESSION_PREVIEW)
  const rest = tasks.length - preview.length
  const mins = block.estimated_minutes ?? 0

  return (
    <div
      data-drop={`session:${block.id}`}
      className={`flex-1 min-w-0 relative rounded-xl border overflow-hidden transition-colors ${
        dropActive
          ? 'border-gold bg-gold/20 ring-2 ring-gold/60'
          : 'border-gold/40 bg-gradient-to-b from-gold/10 to-gold/[0.03]'
      }`}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1.5 bg-gold" />
      <button
        type="button"
        data-no-drag
        onClick={() => onOpen(block)}
        className="w-full text-left pl-5 pr-3 pt-2.5 pb-2"
      >
        <div className="flex items-center gap-2">
          <IconBolt size={16} className="text-gold shrink-0" stroke={2} />
          <span className="flex-1 text-base font-semibold text-gold">Deep Work</span>
          <span className="text-[11px] font-semibold text-gold bg-gold/15 px-2 py-0.5 rounded-full tabular-nums">
            {tasks.length ? `${doneCount}/${tasks.length}` : fmtDuration(mins)}
          </span>
        </div>
      </button>

      {preview.length > 0 && (
        <div className="border-t border-gold/20">
          {preview.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 pl-5 pr-3 py-2">
              <button
                type="button"
                data-no-drag
                onClick={() => onToggleTask(block.id, t)}
                aria-label={t.is_completed ? 'Mark not done' : 'Mark done'}
                className={`shrink-0 h-5 w-5 rounded-[5px] border-2 flex items-center justify-center transition-colors ${
                  t.is_completed
                    ? 'bg-gold/10 border-gold text-gold'
                    : 'border-border-focus text-transparent active:border-gold'
                }`}
              >
                <IconCheck size={12} stroke={3} />
              </button>
              <span
                aria-hidden
                className={`shrink-0 h-1.5 w-1.5 rounded-full ${
                  t.priority ? PRIO_ACCENT[t.priority] : 'bg-border-focus'
                }`}
              />
              <span
                className={`flex-1 min-w-0 text-sm leading-snug break-words ${
                  t.is_completed ? 'line-through text-text-low' : 'text-text'
                }`}
              >
                {t.title}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        data-no-drag
        onClick={() => onOpen(block)}
        className="w-full text-left pl-5 pr-3 pb-2.5 pt-1.5 text-gold text-[13px] font-semibold active:opacity-70 transition-opacity"
      >
        {rest > 0 ? `+${rest} more · tap to manage` : '+ Add task to this session'}
      </button>
    </div>
  )
}

const sessionDone = (tasks?: Task[]) => (tasks ?? []).filter((t) => t.is_completed).length

/** 135 → "2h 15m", 180 → "3h", 45 → "45 min". */
function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/**
 * One task line inside a Deep Work sheet — deliberately the same shape as the
 * main list's `TaskRow` (priority rail, square gold checkbox, tag + due chips)
 * so a session reads as part of the app rather than a separate widget.
 * Selecting mode (the picker) turns the whole row into one big tap target.
 */
function SessionTaskLine({
  task,
  selected,
  dragging,
  innerRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onToggleDone,
  onRemove,
  onEdit,
  onSelect,
}: {
  task: Task
  selected?: boolean
  dragging?: boolean
  innerRef?: (el: HTMLElement | null) => void
  onPointerDown?: (e: React.PointerEvent) => void
  onPointerMove?: (e: React.PointerEvent) => void
  onPointerUp?: () => void
  onToggleDone?: () => void
  onRemove?: () => void
  onEdit?: () => void
  onSelect?: () => void
}) {
  const cat = task.category ? TASK_CATEGORIES.find((c) => c.value === task.category) : null
  const due = formatDueChip(task.due_date)
  const checked = onSelect ? !!selected : task.is_completed

  const body = (
    <>
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          task.priority ? PRIO_ACCENT[task.priority] : 'bg-border'
        }`}
      />
      {onSelect ? (
        <span
          aria-hidden
          className={`mt-0.5 shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors ${
            checked ? 'bg-gold/10 border-gold text-gold' : 'border-border-focus text-transparent'
          }`}
        >
          <IconCheck size={14} stroke={3} />
        </span>
      ) : (
        <button
          type="button"
          data-no-drag
          onClick={onToggleDone}
          aria-label={checked ? 'Mark not done' : 'Mark done'}
          className={`mt-0.5 shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors ${
            checked
              ? 'bg-gold/10 border-gold text-gold'
              : 'border-border-focus text-transparent active:border-gold'
          }`}
        >
          <IconCheck size={14} stroke={3} />
        </button>
      )}

      <div className="flex-1 min-w-0">
        <p
          className={`text-base leading-snug break-words ${
            !onSelect && checked ? 'text-text-low line-through' : 'text-text'
          }`}
        >
          {task.title}
        </p>
        {(cat || due) && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {cat && (
              <span
                className="text-[11px] leading-none px-1.5 py-0.5 rounded-md font-medium"
                style={{ color: cat.color, backgroundColor: `${cat.color}1f` }}
              >
                {cat.label}
              </span>
            )}
            {due && (
              <span className={`text-xs ${due.overdue ? 'text-priority-high' : 'text-text-muted'}`}>
                {due.text}
              </span>
            )}
          </div>
        )}
      </div>

      {onEdit && (
        <button
          type="button"
          data-no-drag
          onClick={onEdit}
          aria-label="Edit task"
          className="mt-0.5 shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-text-low active:text-text active:bg-border/40 transition-colors"
        >
          <IconPencil size={17} />
        </button>
      )}

      {onRemove && (
        <button
          type="button"
          data-no-drag
          onClick={onRemove}
          aria-label="Remove from session"
          className="mt-0.5 shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-text-low active:text-text active:bg-border/40 transition-colors"
        >
          <IconX size={16} />
        </button>
      )}
    </>
  )

  const shell = `relative flex items-start gap-3 py-3 pl-5 pr-2 mb-2 rounded-xl overflow-hidden transition-colors ${
    selected ? 'bg-gold/10 ring-1 ring-gold/40' : 'bg-surface'
  } ${
    dragging
      ? 'ring-1 ring-border-focus shadow-[0_8px_24px_rgba(0,0,0,0.5)] scale-[1.02] bg-surface-elevated select-none'
      : ''
  }`

  return onSelect ? (
    <button type="button" onClick={onSelect} className={`${shell} w-full text-left active:bg-surface-elevated`}>
      {body}
    </button>
  ) : (
    <div
      ref={innerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className={shell}
    >
      {body}
    </div>
  )
}

/** Where the dragged task will be squeezed in. */
function DropLine({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-11 right-1 z-20 flex items-center ${
        edge === 'bottom' ? 'bottom-0' : 'top-0'
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-gold shrink-0 -ml-1" />
      <span className="flex-1 h-0.5 rounded-full bg-gold" />
    </span>
  )
}

function Timeline({
  blocks,
  sessionItems,
  trayDragging,
  dropTarget,
  dropAfter,
  onToggleDone,
  onToggleSessionTask,
  onOpenSession,
  onReorder,
  onLongPress,
}: {
  blocks: PlanBlock[]
  sessionItems: Record<string, Task[]>
  trayDragging: boolean
  dropTarget: string | null
  dropAfter: string | null
  onToggleDone: (b: PlanBlock) => void
  onToggleSessionTask: (blockId: string, t: Task) => void
  onOpenSession: (b: PlanBlock) => void
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

  const firstMovableId = blocks.find((b) => !b.locked)?.id ?? null

  return (
    <section
      data-drop="day"
      className={`flex flex-col mt-1 rounded-2xl transition-colors ${
        trayDragging
          ? dropTarget === 'day'
            ? 'ring-2 ring-gold/60 bg-gold/[0.06]'
            : 'ring-1 ring-dashed ring-border-focus'
          : ''
      }`}
    >
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
            data-block={b.locked ? undefined : b.id}
            ref={(el) => {
              if (el) rowRefs.current.set(b.id, el)
              else rowRefs.current.delete(b.id)
            }}
            className={
              dragging
                ? 'relative z-10 transition-none'
                : 'relative transition-transform duration-150 ease-out'
            }
            style={dragging ? { transform: `translateY(${dragOffset}px)` } : undefined}
          >
            {trayDragging && dropTarget === 'day' && (dropAfter === b.id || (dropAfter === null && b.id === firstMovableId)) && (
              <DropLine edge={dropAfter === b.id ? 'bottom' : 'top'} />
            )}
            <div className={`flex gap-2 py-1.5 ${done || continued ? 'opacity-60' : ''}`}>
              <div className="shrink-0 w-11 self-stretch flex flex-col justify-between items-end py-2.5 tabular-nums">
                <span className="text-text-muted text-xs leading-none">{b.start_local}</span>
                <span className="text-text-muted text-xs leading-none">{b.end_local}</span>
              </div>

              {b.kind === 'deep_work' ? (
                <DeepWorkCard
                  block={b}
                  tasks={sessionItems[b.id] ?? []}
                  onToggleTask={onToggleSessionTask}
                  onOpen={onOpenSession}
                  dropActive={dropTarget === `session:${b.id}`}
                />
              ) : (
              <div
                onPointerDown={b.locked ? undefined : (e) => onDown(e, b)}
                onPointerMove={b.locked ? undefined : onMove}
                onPointerUp={b.locked ? undefined : onUp}
                onPointerCancel={b.locked ? undefined : onUp}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative flex-1 min-w-0 flex items-start gap-2 pl-5 pr-2 py-2.5 rounded-xl border overflow-hidden transition-[background-color,border-color,box-shadow] duration-150 ${
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
                    {b.estimated_minutes ? (
                      <span className="text-text-low text-xs tabular-nums">
                        {b.estimated_minutes} min
                      </span>
                    ) : null}
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
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
