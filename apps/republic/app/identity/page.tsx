'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { useApplication } from '@/lib/applicationContext'
import { IDENTITY } from '@/lib/content'
import { playStampThunk } from '@/lib/sound'

// Instagram handle moved to its own /handle page (after visa type +
// appointment, before the photo) per owner feedback — this page is name-only.
export default function IdentityPage() {
  const router = useRouter()
  const { state, update, hydrated } = useApplication()
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  // While the applicant is typing, local state keeps this page editable even
  // though the same value is mirrored to the audit-aware application state.
  const hasIdentity = state.identitySubmitted

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
  }, [hydrated, hasIdentity, state.applicantName, router])

  const nameValid = name.trim().length > 0

  function handleContinue() {
    if (!nameValid) {
      setNameTouched(true)
      return
    }
    update({ applicantName: name.trim(), identitySubmitted: true })
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
              onChange={(e) => {
                const next = e.target.value
                setName(next)
                update({ applicantName: next })
              }}
              onBlur={() => setNameTouched(true)}
              placeholder={IDENTITY.namePlaceholder}
              className="mt-1 w-full border-b-2 border-navy bg-transparent px-1 py-2 font-stamp text-base uppercase tracking-wide text-navy placeholder:text-navy/30 focus:outline-none"
            />
            {nameTouched && !nameValid && (
              <p className="mt-1 text-[10px] uppercase text-stamp">{IDENTITY.nameRequiredError}</p>
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
