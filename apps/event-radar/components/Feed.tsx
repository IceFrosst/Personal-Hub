'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isUpcomingAndOpen, scoreHackathon } from '@/lib/scoring'
import { isDormantCircuit, matchDormantCircuit } from '@/lib/dormant-tier-a'
import { isNewHackathon, NEW_BADGE_HOURS } from '@/lib/digest'
import { selectNewArrivals } from '@/lib/new-arrivals'
import { matchesFeedFilters, type FormatMode } from '@/lib/feed-filters'
import {
  coerceHackathon,
  coerceNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type Hackathon,
  type NotificationSettings,
  type UserStatus,
} from '@/lib/types'
import HackathonCard from './HackathonCard'
import DetailSheet from './DetailSheet'
import { IconRadar2, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'

type ListMode = 'feed' | 'applied' | 'dormant' | 'new'

export default function Feed({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [prefs, setPrefs] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS)
  /** IRL ↔ Online switch (ignored when Applied/Dormant is active) */
  const [formatMode, setFormatMode] = useState<FormatMode>('irl')
  /** Multi-day on/off (ignored when Applied/Dormant is active) */
  const [multiDayOnly, setMultiDayOnly] = useState(false)
  /** Travel ✓ on/off — only events whose travel policy is useful from home */
  const [travelOnly, setTravelOnly] = useState(false)
  /** Applied / Dormant override the format + multi-day filters */
  const [listMode, setListMode] = useState<ListMode>('feed')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: rows }, { data: statusRows }, { data: prefRow }] = await Promise.all([
      supabase
        .schema('hackathon')
        .from('hackathons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .schema('hackathon')
        .from('user_hackathon_status')
        .select('hackathon_id, status, notes'),
      supabase
        .schema('hackathon')
        .from('user_preferences')
        .select('notification_settings')
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    setHackathons((rows ?? []).map((r) => coerceHackathon(r as Record<string, unknown>)))
    setStatuses(
      Object.fromEntries((statusRows ?? []).map((r) => [r.hackathon_id, r.status as UserStatus]))
    )
    setNotes(
      Object.fromEntries(
        (statusRows ?? []).filter((r) => r.notes).map((r) => [r.hackathon_id, r.notes as string])
      )
    )
    setPrefs(coerceNotificationSettings(prefRow?.notification_settings))
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = async (hackathonId: string, status: UserStatus) => {
    const current = statuses[hackathonId]
    if (current === status) {
      setStatuses((prev) => {
        const next = { ...prev }
        delete next[hackathonId]
        return next
      })
      setNotes((prev) => {
        const next = { ...prev }
        delete next[hackathonId]
        return next
      })
      await supabase
        .schema('hackathon')
        .from('user_hackathon_status')
        .delete()
        .eq('hackathon_id', hackathonId)
      return
    }
    setStatuses((prev) => ({ ...prev, [hackathonId]: status }))
    await supabase
      .schema('hackathon')
      .from('user_hackathon_status')
      .upsert(
        {
          user_id: userId,
          hackathon_id: hackathonId,
          status,
          notes: notes[hackathonId] ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,hackathon_id' }
      )
  }

  const saveNotes = async (hackathonId: string, value: string) => {
    setNotes((prev) => ({ ...prev, [hackathonId]: value }))
    const status = statuses[hackathonId] ?? 'interested'
    if (!statuses[hackathonId]) setStatuses((prev) => ({ ...prev, [hackathonId]: status }))
    await supabase
      .schema('hackathon')
      .from('user_hackathon_status')
      .upsert(
        {
          user_id: userId,
          hackathon_id: hackathonId,
          status,
          notes: value || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,hackathon_id' }
      )
  }

  const scoreOpts = useMemo(
    () => ({
      priority_countries: prefs.priority_countries,
      home_base: prefs.home_base,
    }),
    [prefs.priority_countries, prefs.home_base]
  )

  /**
   * The chips apply to the feed AND to New, so tapping one while New is open
   * must refine that list rather than throw you back to the feed. Applied and
   * Dormant genuinely ignore the chips, so tapping a chip there still exits.
   */
  const keepListMode = () => {
    if (listMode === 'applied' || listMode === 'dormant') setListMode('feed')
  }
  /** True when the chip row is actually in force — feed and New. */
  const chipsApply = listMode === 'feed' || listMode === 'new'

  const chipClass = (active: boolean) =>
    `min-h-11 shrink-0 rounded-md border px-3 text-sm transition-colors duration-150 ease-out ${
      active
        ? 'border-purple/50 bg-purple/15 text-purple'
        : 'border-border text-text-muted hover:border-border-focus'
    }`

  const filters = useMemo(
    () => ({ formatMode, multiDayOnly, travelOnly, homeBase: prefs.home_base }),
    [formatMode, multiDayOnly, travelOnly, prefs.home_base]
  )

  const visible = useMemo(() => {
    // Applied / Dormant override format + multi-day entirely
    if (listMode === 'dormant') {
      return hackathons
        .filter((h) => isDormantCircuit(h))
        .map((h) => ({
          h,
          scored: scoreHackathon(h, new Date(), scoreOpts),
          status: statuses[h.id] ?? null,
        }))
        .sort((a, b) => a.h.title.localeCompare(b.h.title))
    }

    // "New" answers one question: what did the last refresh actually bring in?
    //
    // It deliberately does NOT apply isUpcomingAndOpen. A freshly ingested row
    // usually has no registration_deadline yet — enrichment fills that on a
    // later pass — and the feed is fail-closed, so requiring eligibility here
    // would show an empty tab immediately after a refresh, which is precisely
    // the moment you want to look. Past events are still dropped; the only gate
    // relaxed is the unknown deadline.
    if (listMode === 'new') {
      const now = new Date()
      return selectNewArrivals(hackathons, (h) => statuses[h.id] === 'hidden', now)
        .filter((h) => matchesFeedFilters(h, filters))
        .map((h) => ({
          h,
          scored: scoreHackathon(h, now, scoreOpts),
          status: statuses[h.id] ?? null,
        }))
    }

    if (listMode === 'applied') {
      return hackathons
        .filter((h) => statuses[h.id] === 'applied')
        .map((h) => ({
          h,
          scored: scoreHackathon(h, new Date(), scoreOpts),
          status: 'applied' as UserStatus,
        }))
        .sort((a, b) => {
          const da = a.h.starts_at ?? '9999'
          const db = b.h.starts_at ?? '9999'
          return da < db ? -1 : 1
        })
    }

    // Main feed: isUpcomingAndOpen + IRL/Online + Multi-day.
    // Dormant circuits (TreeHacks, PennApps, …) are NOT excluded here: their
    // gate lives inside isUpcomingAndOpen, which requires a real future
    // registration deadline for them. Excluding them again here hid circuits
    // that had genuinely reopened — PennApps was travel-covered and closing in
    // three weeks while only reachable from the Dormant tab.
    // Exclude applied + hidden so they only live in their own tabs
    const scored = hackathons
      .filter((h) => isUpcomingAndOpen(h))
      .map((h) => ({
        h,
        scored: scoreHackathon(h, new Date(), scoreOpts),
        status: statuses[h.id] ?? null,
      }))

    const filtered = scored.filter(({ h, status }) => {
      if (status === 'hidden' || status === 'applied') return false
      return matchesFeedFilters(h, filters)
    })

    return filtered.sort((a, b) => {
      if (b.scored.score !== a.scored.score) return b.scored.score - a.scored.score
      const da = a.h.registration_deadline ?? a.h.starts_at ?? '9999'
      const db = b.h.registration_deadline ?? b.h.starts_at ?? '9999'
      return da < db ? -1 : 1
    })
  }, [hackathons, statuses, listMode, filters, scoreOpts])

  /**
   * Count on the tab, so a refresh is visible without opening it. Runs the exact
   * pipeline the tab body runs — arrivals, then the chip filters — so the number
   * always equals the number of cards you get when you tap it. That means the
   * count moves when you toggle IRL/Online/Multi-day/Travel, which is the point:
   * it answers "how many new ones match what I'm looking at", not "how many rows
   * landed in the database".
   */
  const newCount = useMemo(() => {
    const now = new Date()
    return selectNewArrivals(hackathons, (h) => statuses[h.id] === 'hidden', now).filter((h) =>
      matchesFeedFilters(h, filters)
    ).length
  }, [hackathons, statuses, filters])

  /** Arrivals before the chips — the denominator for "X of Y new". */
  const newTotal = useMemo(
    () => selectNewArrivals(hackathons, (h) => statuses[h.id] === 'hidden').length,
    [hackathons, statuses]
  )

  const selected = useMemo(() => {
    if (!selectedId) return null
    const h = hackathons.find((x) => x.id === selectedId)
    return h ? { h, scored: scoreHackathon(h, new Date(), scoreOpts) } : null
  }, [selectedId, hackathons, scoreOpts])

  const emptyMessage = (() => {
    if (hackathons.length === 0) return 'Nothing on the radar yet — the first sweep runs tonight.'
    if (listMode === 'applied') return 'No applied events yet — mark one from a card.'
    if (listMode === 'dormant')
      return 'No dormant circuit rows in the catalog. Weekly probe watches TreeHacks, PennApps, HackUPC, etc.'
    if (listMode === 'new') {
      const anyNew = hackathons.some((h) => isNewHackathon(h))
      return anyNew
        ? `Nothing new matches these filters — ${formatMode === 'irl' ? 'try Online' : 'try IRL'}, or clear Multi-day/Travel.`
        : `Nothing new in the last ${NEW_BADGE_HOURS} hours. Pull to refresh, or wait for the nightly sweep.`
    }
    if (travelOnly)
      return 'No events with confirmed travel cover from your home base right now.'
    if (formatMode === 'online') return 'No open online events right now.'
    if (multiDayOnly) return 'No multi-day events match the current filters.'
    return 'No open in-person events starting at least 1 week from now.'
  })()

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-6 safe-b safe-t">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <IconRadar2 size={26} stroke={1.5} className="text-purple" />
          Event Radar
        </h1>
        <Link
          href="/settings"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted transition-colors duration-150 ease-out hover:text-text"
          aria-label="Settings"
        >
          <IconSettings size={22} stroke={1.5} />
        </Link>
      </header>

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            keepListMode()
            setFormatMode('irl')
          }}
          className={chipClass(chipsApply && formatMode === 'irl')}
        >
          IRL
        </button>
        <button
          type="button"
          onClick={() => {
            keepListMode()
            setFormatMode('online')
          }}
          className={chipClass(chipsApply && formatMode === 'online')}
        >
          Online
        </button>

        <button
          type="button"
          onClick={() => {
            keepListMode()
            setMultiDayOnly((v) => !v)
          }}
          className={chipClass(chipsApply && multiDayOnly)}
          aria-pressed={multiDayOnly}
        >
          Multi-day{multiDayOnly ? ' ✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => {
            keepListMode()
            setTravelOnly((v) => !v)
          }}
          className={chipClass(chipsApply && travelOnly)}
          aria-pressed={travelOnly}
          title="Only events whose travel policy covers someone based in your home country"
        >
          Travel{travelOnly ? ' ✓' : ''}
        </button>

        <button
          type="button"
          onClick={() => setListMode(listMode === 'new' ? 'feed' : 'new')}
          className={chipClass(listMode === 'new')}
          title={`Everything ingested in the last ${NEW_BADGE_HOURS} hours, newest first`}
        >
          New{newCount > 0 ? ` ${newCount}` : ''}
        </button>
        <button
          type="button"
          onClick={() => setListMode(listMode === 'applied' ? 'feed' : 'applied')}
          className={chipClass(listMode === 'applied')}
        >
          Applied
        </button>
        <button
          type="button"
          onClick={() => setListMode(listMode === 'dormant' ? 'feed' : 'dormant')}
          className={chipClass(listMode === 'dormant')}
        >
          Dormant
        </button>
      </div>

      {listMode === 'new' && newTotal > 0 && (
        <p className="mb-3 text-xs text-text-low">
          {newCount === newTotal ? (
            <>
              {newTotal} new in the last {NEW_BADGE_HOURS}h
            </>
          ) : (
            <>
              Showing <span className="text-text-muted">{newCount}</span> of {newTotal} new —{' '}
              {[
                formatMode === 'irl' ? 'IRL' : 'Online',
                multiDayOnly ? 'Multi-day' : null,
                travelOnly ? 'Travel' : null,
              ]
                .filter(Boolean)
                .join(' + ')}{' '}
              is hiding the rest
            </>
          )}
        </p>
      )}

      {loading ? (
        <p className="mt-16 text-center text-sm text-text-low">Scanning the radar…</p>
      ) : visible.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <IconRadar2 size={40} stroke={1.5} className="text-text-low" />
          <p className="text-sm text-text-muted">{emptyMessage}</p>
          {listMode === 'dormant' && (
            <p className="mt-2 max-w-xs text-xs text-text-low">
              Dormant circuits are hidden from the main feed until registration opens. Check the
              weekly GitHub issue for promote candidates.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {listMode === 'dormant' && (
            <p className="text-xs text-text-muted">
              Between editions — not on the main feed until reg opens.
              {visible[0] && matchDormantCircuit(visible[0].h)
                ? ` Watching ${visible.length} catalog row(s).`
                : ''}
            </p>
          )}
          {visible.map(({ h, scored, status }) => (
            <HackathonCard
              key={h.id}
              hackathon={h}
              scored={scored}
              status={status}
              homeBase={prefs.home_base}
              onSetStatus={(s) => setStatus(h.id, s)}
              onOpen={() => setSelectedId(h.id)}
            />
          ))}
        </div>
      )}

      {selected && (
        <DetailSheet
          hackathon={selected.h}
          scored={selected.scored}
          status={statuses[selected.h.id] ?? null}
          notes={notes[selected.h.id] ?? ''}
          onSetStatus={(s) => setStatus(selected.h.id, s)}
          onSaveNotes={(v) => saveNotes(selected.h.id, v)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </main>
  )
}
