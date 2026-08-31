'use client'

// Passport registry — asks for the Instagram handle AFTER the visa type is
// chosen and the appointment is booked, right before the photo (owner
// request; it used to live on /identity next to the name). Sits between
// /appointment and /biometric in the funnel.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { HANDLE_STEP } from '@/lib/content'
import { playStampThunk } from '@/lib/sound'

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '')
}

export default function HandlePage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [handle, setHandle] = useState('')
  const [touched, setTouched] = useState(false)

  const hasHandle = state.instagramHandle.trim().length > 0

  useEffect(() => {
    // Same hydration-race guard as every other funnel page.
    if (!hydrated) return
    // Already on file this session (back-navigation) — skip forward.
    if (hasHandle) {
      router.replace('/biometric')
      return
    }
    // Requires everything the appointment step produced — same single-source
    // invariant as /biometric's own guard.
    if (!state.visaType || !state.serial || !state.slot || !state.issuedDate) {
      router.replace('/visa')
    }
  }, [hydrated, hasHandle, state.visaType, state.serial, state.slot, state.issuedDate, router])

  const valid = normalizeHandle(handle).length > 0

  function handleContinue() {
    if (!valid) {
      setTouched(true)
      return
    }
    update({ instagramHandle: normalizeHandle(handle) })
    playStampThunk()
    router.push('/biometric')
  }

  if (!hydrated || hasHandle || !state.visaType) return null

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{HANDLE_STEP.heading}</h1>
        <p className="mt-2 text-center text-[10px] uppercase leading-relaxed text-navy/60">{HANDLE_STEP.note}</p>
        <div className="my-3 h-px bg-navy/20" />

        <label htmlFor="applicant-handle" className="block text-[11px] uppercase tracking-wide text-navy">
          {HANDLE_STEP.handleLabel} <span className="text-stamp">*</span>
        </label>
        <input
          id="applicant-handle"
          type="text"
          required
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={HANDLE_STEP.handlePlaceholder}
          className="mt-1 w-full border-b-2 border-navy bg-transparent px-1 py-2 font-stamp text-base lowercase tracking-wide text-navy placeholder:text-navy/30 focus:outline-none"
        />
        {touched && !valid && <p className="mt-1 text-[10px] uppercase text-stamp">{HANDLE_STEP.handleRequiredError}</p>}

        <button
          type="button"
          onClick={handleContinue}
          className="mt-5 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97]"
        >
          {HANDLE_STEP.continue}
        </button>
      </div>
      <Footer />
    </PageShell>
  )
}
