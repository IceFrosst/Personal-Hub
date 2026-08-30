'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { IDENTITY } from '@/lib/content'
import { playStampThunk } from '@/lib/sound'

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '')
}

export default function IdentityPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [handleTouched, setHandleTouched] = useState(false)

  const hasIdentity = state.applicantName.trim().length > 0 && state.instagramHandle.trim().length > 0

  useEffect(() => {
    // Same hydration race as every other route guard in this funnel.
    if (!hydrated) return
    // Already on file this session (e.g. back-navigation between /identity
    // and /visa, or arriving via the denied/appeal loop after already
    // declaring once) — skip straight to visa selection instead of asking
    // again.
    if (hasIdentity) {
      router.replace('/visa')
      return
    }
    setName(state.applicantName)
    setHandle(state.instagramHandle)
  }, [hydrated, hasIdentity, state.applicantName, state.instagramHandle, router])

  const nameValid = name.trim().length > 0
  const handleValid = normalizeHandle(handle).length > 0

  function handleContinue() {
    if (!nameValid || !handleValid) {
      setNameTouched(true)
      setHandleTouched(true)
      return
    }
    update({ applicantName: name.trim(), instagramHandle: normalizeHandle(handle) })
    playStampThunk()
    router.push('/visa')
  }

  if (!hydrated || hasIdentity) return null

  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{IDENTITY.heading}</h1>
        <div className="my-3 h-px bg-navy/20" />

        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="applicant-name" className="block text-[11px] uppercase tracking-wide text-navy">
              {IDENTITY.nameLabel} <span className="text-stamp">*</span>
            </label>
            <input
              id="applicant-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder={IDENTITY.namePlaceholder}
              className="mt-1 w-full border-b-2 border-navy bg-transparent px-1 py-2 font-stamp text-base uppercase tracking-wide text-navy placeholder:text-navy/30 focus:outline-none"
            />
            {nameTouched && !nameValid && (
              <p className="mt-1 text-[10px] uppercase text-stamp">{IDENTITY.nameRequiredError}</p>
            )}
          </div>

          <div>
            <label htmlFor="applicant-handle" className="block text-[11px] uppercase tracking-wide text-navy">
              {IDENTITY.handleLabel}
              <span className="text-stamp">*</span>
            </label>
            <input
              id="applicant-handle"
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onBlur={() => setHandleTouched(true)}
              placeholder={IDENTITY.handlePlaceholder}
              className="mt-1 w-full border-b-2 border-navy bg-transparent px-1 py-2 font-stamp text-base lowercase tracking-wide text-navy placeholder:text-navy/30 focus:outline-none"
            />
            {handleTouched && !handleValid && (
              <p className="mt-1 text-[10px] uppercase text-stamp">{IDENTITY.handleRequiredError}</p>
            )}
          </div>

          <button
            type="button"
            onClick={handleContinue}
            className="mt-2 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97]"
          >
            {IDENTITY.continue}
          </button>
        </div>
      </div>
      <Footer />
    </PageShell>
  )
}
