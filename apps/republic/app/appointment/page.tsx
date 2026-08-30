'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { getAvailableSlots } from '@/lib/api'
import type { Slot } from '@/lib/slots'
import { APPOINTMENT, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk, playBeep } from '@/lib/sound'

export default function AppointmentPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [confirmed, setConfirmed] = useState<Slot | null>(null)

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
    getAvailableSlots(state.visaType).then(setSlots)
  }, [hydrated, state.visaType, router])

  function pick(slot: Slot) {
    if (!slot.available) return
    playStampThunk()
    update({ slot: slot.time })
    addStamp(`APPOINTMENT ${slot.time} CONFIRMED`)
    setConfirmed(slot)
  }

  if (!hydrated || !state.visaType) return null

  const visa = VISA_BY_SLUG[state.visaType]

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">
          {APPOINTMENT.heading}
        </h1>
        <p className="mt-1 text-center text-[10px] uppercase text-navy/60">
          {visa.name} — {APPOINTMENT.sub}
        </p>

        {!confirmed ? (
          <div className="mt-5 flex flex-col gap-2">
            {slots === null && (
              <p className="text-center text-[11px] uppercase text-navy/50">{APPOINTMENT.loading}</p>
            )}
            {slots?.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => pick(slot)}
                className={`min-h-11 flex items-center justify-between border-2 px-3 py-2 text-left text-[12px] uppercase tracking-wide transition-colors ${
                  slot.available
                    ? 'border-approve text-approve hover:bg-approve hover:text-paper'
                    : 'cursor-not-allowed border-navy/30 text-navy/40 line-through'
                }`}
              >
                <span className="font-stamp">{slot.time}</span>
                <span className="ml-3 flex-1 text-right text-[10px] normal-case italic">{slot.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 animate-fade-in text-center">
            <p className="font-stamp text-base uppercase tracking-wide text-approve">
              {APPOINTMENT.confirmedTitle}
            </p>
            <p className="mt-2 text-[12px] font-bold uppercase text-navy">
              {APPOINTMENT.slotLabelPrefix} {confirmed.time}
            </p>
            {APPOINTMENT.confirmedLines.map((line) => (
              <p key={line} className="mt-1 text-[11px] uppercase text-navy/70">
                {line}
              </p>
            ))}
            <button
              type="button"
              onClick={() => {
                playBeep()
                router.push('/biometric')
              }}
              className="mt-6 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
            >
              {APPOINTMENT.continue}
            </button>
          </div>
        )}
      </div>
      <Footer />
    </PageShell>
  )
}
