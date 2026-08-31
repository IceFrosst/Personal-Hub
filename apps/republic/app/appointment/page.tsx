'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { getAvailableDates } from '@/lib/api'
import { APPOINTMENT, APPOINTMENT_TIMES, VISA_BY_SLUG, formatIssuedDate, formatSlot, formatSlotDateLabel } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep, playStampThunk } from '@/lib/sound'

type LoadState = 'loading' | 'ready' | 'unavailable'

const dayButtonClass =
  'min-h-11 border-2 border-approve px-3 py-2 text-left text-[12px] uppercase tracking-wide text-approve transition-all hover:bg-approve hover:text-paper active:scale-[0.97]'

export default function AppointmentPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [dates, setDates] = useState<string[]>([])
  // The day-then-time flow lives entirely in local component state, not
  // context — there's nothing worth persisting mid-pick; the funnel's own
  // persisted state only ever gains a value once a time is actually chosen
  // (see pickTime below), same instant it navigates on.
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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
  }, [hydrated, state.visaType, router])

  const pickDate = useCallback((date: string) => {
    playBeep()
    setSelectedDate(date)
  }, [])

  const changeDay = useCallback(() => {
    // Goes straight back to the day list — no confirmation step, matches
    // the "no extra click" requirement on the time screen's back control.
    playBeep()
    setSelectedDate(null)
  }, [])

  function pickTime(time: string) {
    if (!selectedDate) return
    playStampThunk()
    const slot = formatSlot(selectedDate, time)
    // ISSUED fills as soon as the appointment is confirmed (well before
    // actual issuance on /visa-issued), using the same formatIssuedDate
    // helper that page renders with — so the two always agree even if the
    // session spans midnight. `slot` itself is the single unambiguous
    // date+time string everything downstream (DocumentProgress, the DM
    // reference line, buildApplicationRecord) reads from state.
    update({ slot, issuedDate: formatIssuedDate() })
    addStamp(`APPOINTMENT ${slot} CONFIRMED`)
    router.push('/biometric')
  }

  if (!hydrated || !state.visaType) return null

  const visa = VISA_BY_SLUG[state.visaType]

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{APPOINTMENT.heading}</h1>
        <p className="mt-1 text-center text-[10px] uppercase text-navy/60">
          {visa.name} — {selectedDate ? APPOINTMENT.timeSub : APPOINTMENT.daySub}
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

        {loadState === 'ready' && !selectedDate && (
          <div className="mt-5 flex flex-col gap-2">
            {dates.map((date) => (
              <button key={date} type="button" onClick={() => pickDate(date)} className={dayButtonClass}>
                <span className="font-stamp">{formatSlotDateLabel(date)}</span>
              </button>
            ))}
          </div>
        )}

        {loadState === 'ready' && selectedDate && (
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
              {APPOINTMENT_TIMES.map((time) => (
                <button key={time} type="button" onClick={() => pickTime(time)} className={dayButtonClass}>
                  <span className="font-stamp">{time}</span>
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
