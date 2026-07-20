'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isUpcomingAndOpen, scoreHackathon } from '@/lib/scoring'
import { isTravelPriority } from '@/lib/travel-priority'
import { isBalticOrPoland } from '@/lib/region-baltic'
import {
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

type FilterKey = 'all' | 'travel' | 'travel_tier' | 'baltic_pl' | 'online' | 'biz' | 'hidden'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'baltic_pl', label: 'Baltics+PL' },
  { key: 'travel', label: 'Travel ✓' },
  { key: 'travel_tier', label: 'Travel tier' },
  { key: 'online', label: 'Online' },
  { key: 'biz', label: 'Open to biz' },
  { key: 'hidden', label: 'Hidden' },
]

export default function Feed({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [hackathons, setHackathons] = useState<Hackathon[]>([])
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [prefs, setPrefs] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [{ data: rows }, { data: statusRows }, { data: prefRow }] = await Promise.all([
      supabase
        .schema('hackathon')
        .from('hackathons')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300),
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
    setHackathons((rows ?? []) as Hackathon[])
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
    () => ({ priority_countries: prefs.priority_countries }),
    [prefs.priority_countries]
  )

  const visible = useMemo(() => {
    const scored = hackathons
      .filter((h) => isUpcomingAndOpen(h))
      .map((h) => ({
        h,
        scored: scoreHackathon(h, new Date(), scoreOpts),
        status: statuses[h.id] ?? null,
      }))

    const filtered = scored.filter(({ h, status }) => {
      if (filter === 'hidden') return status === 'hidden'
      if (status === 'hidden') return false
      if (filter === 'travel') return h.travel_covered === true
      if (filter === 'travel_tier') return isTravelPriority(h)
      if (filter === 'baltic_pl') return isBalticOrPoland(h)
      if (filter === 'online') return h.format === 'online'
      if (filter === 'biz') return h.open_to_business_students !== false
      return true
    })

    return filtered.sort((a, b) => {
      if (b.scored.score !== a.scored.score) return b.scored.score - a.scored.score
      const da = a.h.registration_deadline ?? a.h.starts_at ?? '9999'
      const db = b.h.registration_deadline ?? b.h.starts_at ?? '9999'
      return da < db ? -1 : 1
    })
  }, [hackathons, statuses, filter, scoreOpts])

  const selected = useMemo(() => {
    if (!selectedId) return null
    const h = hackathons.find((x) => x.id === selectedId)
    return h ? { h, scored: scoreHackathon(h, new Date(), scoreOpts) } : null
  }, [selectedId, hackathons, scoreOpts])

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
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`min-h-11 shrink-0 rounded-md border px-3 text-sm transition-colors duration-150 ease-out ${
              filter === key
                ? 'border-purple/50 bg-purple/15 text-purple'
                : 'border-border text-text-muted hover:border-border-focus'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-16 text-center text-sm text-text-low">Scanning the radar…</p>
      ) : visible.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-2 text-center">
          <IconRadar2 size={40} stroke={1.5} className="text-text-low" />
          <p className="text-sm text-text-muted">
            {hackathons.length === 0
              ? 'Nothing on the radar yet — the first sweep runs tonight.'
              : filter === 'all'
                ? 'No open events starting at least 1 week from now.'
                : filter === 'travel_tier'
                  ? 'No Tier A/B travel-priority events open right now.'
                  : filter === 'baltic_pl'
                    ? 'No Baltics / Poland events open right now.'
                    : 'Nothing matches this filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(({ h, scored, status }) => (
            <HackathonCard
              key={h.id}
              hackathon={h}
              scored={scored}
              status={status}
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
