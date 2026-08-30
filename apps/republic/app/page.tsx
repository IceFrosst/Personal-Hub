'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crest } from '@/components/Crest'
import { Footer } from '@/components/Footer'
import { OfficerMoodBadge } from '@/components/OfficerMoodBadge'
import { BribeButton } from '@/components/BribeButton'
import { SoundToggle } from '@/components/SoundToggle'
import { PageShell } from '@/components/PageShell'
import { Typewriter } from '@/components/Typewriter'
import { getApplicantNumber } from '@/lib/api'
import { getPassport, registerVisit, addStamp } from '@/lib/passport'
import { LANDING, RETURNING_VISITOR, LOYALTY_MESSAGE } from '@/lib/content'
import { playStampThunk } from '@/lib/sound'
import { useApplication } from '@/lib/applicationContext'

function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, '')
}

export default function EntryDeclarationPage() {
  const router = useRouter()
  const { state, update, reset } = useApplication()
  // These are all localStorage/random values — none may be read directly
  // during render (this page is statically prerendered; the server always
  // sees an empty/default environment). They start at SSR-safe defaults and
  // are only ever populated inside the effect below, after mount.
  const [applicantNumber, setApplicantNumber] = useState<number | null>(null)
  const [visits, setVisits] = useState(0)
  const [stampCount, setStampCount] = useState(0)
  const [showQuestion, setShowQuestion] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [handleTouched, setHandleTouched] = useState(false)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')

  useEffect(() => {
    const preservedName = state.applicantName
    const preservedHandle = state.instagramHandle
    reset()
    if (preservedName) update({ applicantName: preservedName })
    if (preservedHandle) update({ instagramHandle: preservedHandle })
    setName(preservedName)
    setHandle(preservedHandle)

    setApplicantNumber(getApplicantNumber())
    const v = registerVisit()
    setVisits(v)
    addStamp('ENTRY DECLARATION VIEWED')
    setStampCount(getPassport().stamps.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nameValid = name.trim().length > 0
  const handleValid = normalizeHandle(handle).length > 0

  function handleAnswer(answer: 'yes' | 'no') {
    if (!nameValid || !handleValid) {
      setNameTouched(true)
      setHandleTouched(true)
      return
    }
    update({ applicantName: name.trim(), instagramHandle: normalizeHandle(handle) })
    playStampThunk()
    if (answer === 'no') {
      router.push('/denied')
    } else {
      router.push('/visa')
    }
  }

  const isReturning = visits > 1
  const isLoyal = visits >= 3

  return (
    <PageShell>
      <div className="paper-card relative p-5">
        <div
          className="absolute right-3 top-3 rotate-[8deg] border-2 border-stamp px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-stamp"
          aria-hidden
        >
          {LANDING.priorityStamp}
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <Crest className="h-16 w-16" />
          <h1 className="font-stamp text-2xl uppercase tracking-wide text-navy">{LANDING.title}</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-navy/70">{LANDING.subtitle}</p>
        </div>

        <div className="my-4 h-px bg-navy/30" />

        <p className="text-center text-[11px] uppercase tracking-wide text-navy/70">{LANDING.formCode}</p>

        <p className="mt-1 text-center text-[11px] text-navy/60">
          {LANDING.applicantNumberPrefix}{' '}
          {applicantNumber !== null
            ? String(applicantNumber).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1,$2')
            : LANDING.applicantNumberPlaceholder}
        </p>

        <div className="barcode mt-3" aria-hidden />

        {isReturning && (
          <p className="mt-3 animate-fade-in text-center text-[11px] font-bold uppercase text-stamp">
            {RETURNING_VISITOR}
          </p>
        )}
        {isLoyal && (
          <p className="mt-1 animate-fade-in text-center text-[11px] font-bold uppercase text-approve">
            {LOYALTY_MESSAGE}
          </p>
        )}
        {stampCount > 3 && (
          <p className="mt-1 text-center text-[10px] uppercase text-navy/50">
            {LANDING.passportStampsLabel} {stampCount}
          </p>
        )}

        <div className="mt-6 min-h-[3.5rem] text-center">
          <Typewriter
            text={LANDING.question}
            className="font-stamp text-lg uppercase tracking-wide text-navy"
            onDone={() => setShowQuestion(true)}
          />
        </div>

        <div
          className={`mt-4 flex flex-col gap-3 transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <div>
            <label htmlFor="applicant-name" className="block text-[11px] uppercase tracking-wide text-navy">
              {LANDING.nameLabel} <span className="text-stamp">*</span>
            </label>
            <input
              id="applicant-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              placeholder={LANDING.namePlaceholder}
              className="mt-1 w-full border-b-2 border-navy bg-transparent px-1 py-2 font-stamp text-base uppercase tracking-wide text-navy placeholder:text-navy/30 focus:outline-none"
            />
            {nameTouched && !nameValid && (
              <p className="mt-1 text-[10px] uppercase text-stamp">{LANDING.nameRequiredError}</p>
            )}
          </div>

          <div>
            <label htmlFor="applicant-handle" className="block text-[11px] uppercase tracking-wide text-navy">
              {LANDING.handleLabel}
              <span className="text-stamp">*</span>
            </label>
            <input
              id="applicant-handle"
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onBlur={() => setHandleTouched(true)}
              placeholder={LANDING.handlePlaceholder}
              className="mt-1 w-full border-b-2 border-navy bg-transparent px-1 py-2 font-stamp text-base lowercase tracking-wide text-navy placeholder:text-navy/30 focus:outline-none"
            />
            {handleTouched && !handleValid && (
              <p className="mt-1 text-[10px] uppercase text-stamp">{LANDING.handleRequiredError}</p>
            )}
          </div>
        </div>

        <div
          className={`mt-4 grid grid-cols-2 gap-4 transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <button
            type="button"
            onClick={() => handleAnswer('yes')}
            className="min-h-11 border-2 border-approve bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-approve transition-colors hover:bg-approve hover:text-paper disabled:opacity-40"
          >
            {LANDING.yes}
          </button>
          <button
            type="button"
            onClick={() => handleAnswer('no')}
            className="min-h-11 border-2 border-stamp bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-stamp transition-colors hover:bg-stamp hover:text-paper disabled:opacity-40"
          >
            {LANDING.no}
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <OfficerMoodBadge />
        <BribeButton />
        <SoundToggle />
      </div>

      <Footer />
    </PageShell>
  )
}
