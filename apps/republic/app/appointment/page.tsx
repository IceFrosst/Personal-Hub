'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { getAvailableDates } from '@/lib/api'
import { WINDOW_DAYS } from '@/lib/calendarAvailability'
import {
  APPOINTMENT,
  VISA_BY_SLUG,
  appointmentPeriodsFor,
  formatIssuedDate,
  formatMonthLabel,
  formatSlot,
  formatSlotDateLabel,
} from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep, playStampThunk } from '@/lib/sound'

type LoadState = 'loading' | 'ready' | 'unavailable'

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

const periodButtonClass =
  'min-h-11 border-2 border-approve px-3 py-2 text-left text-[12px] uppercase tracking-wide text-approve transition-all hover:bg-approve hover:text-paper active:scale-[0.97]'

interface CalendarCell {
  day: number
  iso: string
  available: boolean
}

/**
 * Month grid rows for a 'YYYY-MM' month: leading nulls pad the first week so
 * day 1 lands under its real weekday (Monday-first, like a paper calendar).
 */
function buildMonthCells(monthIso: string, available: ReadonlySet<string>): (CalendarCell | null)[] {
  const [year, month] = monthIso.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // getUTCDay(): 0=Sun..6=Sat → Monday-first column index 0..6.
  const firstColumn = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const cells: (CalendarCell | null)[] = Array.from({ length: firstColumn }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ day, iso, available: available.has(iso) })
  }
  return cells
}

export default function AppointmentPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [dates, setDates] = useState<string[]>([])
  // The day-then-time flow lives entirely in local component state, not
  // context — there's nothing worth persisting mid-pick; the funnel's own
  // persisted state only ever gains a value once the appointment is actually
  // confirmed (see confirmSlot below), same instant it navigates on.
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [monthIndex, setMonthIndex] = useState(0)

  useEffect(() => {
    // Don't redirect (or fetch) until the context has finished reading
    // sessionStorage — otherwise a mid-funnel refresh reads the transient
    // empty state on the very first render and bounces a valid session back
    // to /visa before the real (persisted) visaType has loaded.
    if (!hydrated) return
    if (!state.visaType) {
      router.replace('/visa')
      return
    }
    // Forward-lock: a confirmed appointment cannot be changed (owner rule).
    if (state.slot && state.issuedDate) {
      router.replace('/handle')
      return
    }
    let cancelled = false
    getAvailableDates().then((freeDates) => {
      if (cancelled) return
      if (freeDates.length === 0) {
        setLoadState('unavailable')
        return
      }
      setDates(freeDates)
      setLoadState('ready')
    })
    return () => {
      cancelled = true
    }
  }, [hydrated, state.visaType, state.slot, state.issuedDate, router])

  const availableSet = useMemo(() => new Set(dates), [dates])
  // Every month the bookable window touches (tomorrow → today+WINDOW_DAYS),
  // browsable even when a month has zero free days — the › arrow must always
  // be able to reach next month (owner request); an empty month just renders
  // all-muted with the emptyMonth note. Computed from the client clock, which
  // can disagree with the server's timezone by at most a day at the window
  // edges — harmless, since day availability itself only ever comes from the
  // fetched dates.
  const months = useMemo(() => {
    const seen: string[] = []
    const cursor = new Date()
    for (let day = 1; day <= WINDOW_DAYS; day++) {
      cursor.setDate(cursor.getDate() + 1)
      const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      if (seen[seen.length - 1] !== month) seen.push(month)
    }
    // Never hide a month that actually has a bookable day (e.g. client clock
    // lags the server's timezone across a month boundary).
    for (const date of dates) {
      const month = date.slice(0, 7)
      if (!seen.includes(month)) seen.push(month)
    }
    return seen.sort()
  }, [dates])
  const activeMonth = months[Math.min(monthIndex, Math.max(months.length - 1, 0))] ?? null

  useEffect(() => {
    // Once availability arrives, open on the first month that actually has a
    // bookable day rather than a possibly-empty current month. Runs only on
    // the loading→ready transition, so it never fights later manual browsing.
    if (loadState !== 'ready' || dates.length === 0) return
    const firstAvailableMonth = dates[0].slice(0, 7)
    const index = months.indexOf(firstAvailableMonth)
    if (index > 0) setMonthIndex(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState])
  const cells = useMemo(
    () => (activeMonth ? buildMonthCells(activeMonth, availableSet) : []),
    [activeMonth, availableSet]
  )

  const confirmSlot = useCallback(
    (date: string, period?: string) => {
      playStampThunk()
      const slot = formatSlot(date, period)
      // ISSUED fills as soon as the appointment is confirmed (well before
      // actual issuance on /visa-issued), using the same formatIssuedDate
      // helper that page renders with — so the two always agree even if the
      // session spans midnight. `slot` itself is the single unambiguous
      // string everything downstream (DocumentProgress, the DM reference
      // line, buildApplicationRecord) reads from state.
      update({ slot, issuedDate: formatIssuedDate() })
      addStamp(`APPOINTMENT ${slot} CONFIRMED`)
      // Handle registry first, then photo — see app/handle/page.tsx.
      router.push('/handle')
    },
    [update, router]
  )

  const periods = state.visaType ? appointmentPeriodsFor(state.visaType) : null

  const pickDate = useCallback(
    (date: string) => {
      // Visas with no time step (SEEK ADVICE PERMIT) are done the moment a
      // day is tapped — no extra confirmation click, same as picking a time.
      if (!periods) {
        confirmSlot(date)
        return
      }
      playBeep()
      setSelectedDate(date)
    },
    [periods, confirmSlot]
  )

  const changeDay = useCallback(() => {
    // Goes straight back to the calendar — no confirmation step, matches
    // the "no extra click" requirement on the time screen's back control.
    playBeep()
    setSelectedDate(null)
  }, [])

  const changeMonth = useCallback(
    (delta: number) => {
      playBeep()
      setMonthIndex((index) => Math.min(Math.max(index + delta, 0), months.length - 1))
    },
    [months.length]
  )

  if (!hydrated || !state.visaType || (state.slot && state.issuedDate)) return null

  const visa = VISA_BY_SLUG[state.visaType]

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">
          {loadState === 'ready'
            ? selectedDate
              ? APPOINTMENT.timeHeading
              : APPOINTMENT.dayHeading
            : APPOINTMENT.neutralHeading}
        </h1>
        {/* Day/time subcopy only ever applies once a day is actually pickable
            — showing it during loading/unavailable would duplicate the
            heading's claim ("SELECT DAY"/"SELECT AN AVAILABLE DAY") while the
            calendar hasn't confirmed one is selectable yet. */}
        <p className="mt-1 text-center text-[10px] uppercase text-navy/60">
          {visa.name}
          {loadState === 'ready' ? ` — ${selectedDate ? APPOINTMENT.timeSub : APPOINTMENT.daySub}` : ''}
        </p>

        {loadState === 'loading' && (
          <p className="mt-5 text-center text-[11px] uppercase text-navy/50">{APPOINTMENT.loadingDays}</p>
        )}

        {loadState === 'unavailable' && (
          <div className="mt-5 text-center">
            <p className="font-stamp text-base uppercase tracking-wide text-stamp">{APPOINTMENT.unavailableHeading}</p>
            <p className="mt-2 text-[11px] uppercase leading-relaxed text-navy/70">{APPOINTMENT.unavailableNote}</p>
          </div>
        )}

        {loadState === 'ready' && !selectedDate && activeMonth && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                disabled={monthIndex === 0}
                aria-label="Previous month"
                className="min-h-11 min-w-11 text-lg text-navy transition-colors disabled:text-navy/20"
              >
                ‹
              </button>
              <span className="font-stamp text-sm uppercase tracking-widest text-navy">
                {formatMonthLabel(activeMonth)}
              </span>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                disabled={monthIndex >= months.length - 1}
                aria-label="Next month"
                className="min-h-11 min-w-11 text-lg text-navy transition-colors disabled:text-navy/20"
              >
                ›
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1 text-center text-[9px] uppercase tracking-wide text-navy/50">
                  {label}
                </div>
              ))}
              {!cells.some((cell) => cell?.available) && (
                <p className="col-span-7 py-2 text-center text-[10px] uppercase text-navy/50">
                  {APPOINTMENT.emptyMonth}
                </p>
              )}
              {cells.map((cell, index) =>
                cell === null ? (
                  <div key={`pad-${index}`} />
                ) : cell.available ? (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => pickDate(cell.iso)}
                    className="flex min-h-11 items-center justify-center border-2 border-approve bg-approve/10 font-stamp text-[13px] text-approve transition-all hover:bg-approve hover:text-paper active:scale-[0.93]"
                  >
                    {cell.day}
                  </button>
                ) : (
                  <div
                    key={cell.iso}
                    aria-disabled="true"
                    className="flex min-h-11 items-center justify-center font-stamp text-[13px] text-navy/25"
                  >
                    {cell.day}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {loadState === 'ready' && selectedDate && periods && (
          <div className="mt-5">
            <button
              type="button"
              onClick={changeDay}
              className="mb-3 min-h-11 text-[10px] uppercase tracking-wide text-navy/60 underline underline-offset-2 transition-colors hover:text-navy"
            >
              ‹ {APPOINTMENT.changeDay}
            </button>
            <p className="mb-2 text-center font-stamp text-sm uppercase tracking-wide text-navy">
              {formatSlotDateLabel(selectedDate)}
            </p>
            <div className="flex flex-col gap-2">
              {periods.map((period) => (
                <button key={period} type="button" onClick={() => confirmSlot(selectedDate, period)} className={periodButtonClass}>
                  <span className="font-stamp">{period}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </PageShell>
  )
}
