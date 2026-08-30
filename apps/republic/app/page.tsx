'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crest } from '@/components/Crest'
import { Footer } from '@/components/Footer'
import { OfficerMoodBadge } from '@/components/OfficerMoodBadge'
import { HiddenBribe } from '@/components/HiddenBribe'
import { PageShell } from '@/components/PageShell'
import { Typewriter } from '@/components/Typewriter'
import { getPassport, registerVisit, addStamp } from '@/lib/passport'
import { clearAnimatedFields } from '@/lib/formProgress'
import { LANDING, RETURNING_VISITOR, LOYALTY_MESSAGE } from '@/lib/content'
import { playStampThunk } from '@/lib/sound'
import { useApplication } from '@/lib/applicationContext'

export default function EntryDeclarationPage() {
  const router = useRouter()
  const { state, update, reset } = useApplication()
  // localStorage-derived values — never read directly during render (this
  // page is statically prerendered, so the server always sees an empty/
  // default environment). Both start at SSR-safe defaults and are only ever
  // populated inside the effect below, after mount.
  const [visits, setVisits] = useState(0)
  const [stampCount, setStampCount] = useState(0)
  const [showQuestion, setShowQuestion] = useState(false)

  useEffect(() => {
    // Landing restarts the funnel on every visit, but identity is preserved
    // across that restart (thematically: your passport doesn't get reset
    // every time you walk up to the counter, only the application does) —
    // capture it before reset(), then re-apply it after.
    const preservedName = state.applicantName
    const preservedHandle = state.instagramHandle
    reset()
    clearAnimatedFields()
    if (preservedName) update({ applicantName: preservedName })
    if (preservedHandle) update({ instagramHandle: preservedHandle })

    const v = registerVisit()
    setVisits(v)
    addStamp('ENTRY DECLARATION VIEWED')
    setStampCount(getPassport().stamps.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAnswer(answer: 'yes' | 'no') {
    playStampThunk()
    router.push(answer === 'no' ? '/denied' : '/identity')
  }

  const isReturning = visits > 1
  const isLoyal = visits >= 3

  return (
    <PageShell fullHeight>
      <div className="paper-card relative p-4">
        <div
          className="absolute right-2 top-2 rotate-[8deg] border-2 border-stamp px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-stamp"
          aria-hidden
        >
          {LANDING.priorityStamp}
        </div>

        <div className="flex flex-col items-center gap-1">
          <Crest className="h-10 w-10" />
          <h1 className="font-stamp text-lg uppercase tracking-wide text-navy">{LANDING.title}</h1>
          <p className="text-[10px] uppercase tracking-[0.25em] text-navy/70">{LANDING.subtitle}</p>
        </div>

        <div className="my-2 h-px bg-navy/30" />

        <p className="text-center text-[10px] uppercase tracking-wide text-navy/70">{LANDING.formCode}</p>
        <p className="mt-0.5 text-center text-[10px] text-navy/60">{LANDING.applicantNumberLine}</p>

        <div className="barcode mt-2 !h-3" aria-hidden />

        {isReturning && (
          <p className="mt-2 animate-fade-in text-center text-[10px] font-bold uppercase leading-tight text-stamp">
            {RETURNING_VISITOR}
          </p>
        )}
        {isLoyal && (
          <p className="mt-0.5 animate-fade-in text-center text-[10px] font-bold uppercase leading-tight text-approve">
            {LOYALTY_MESSAGE}
          </p>
        )}
        {stampCount > 3 && (
          <p className="mt-0.5 text-center text-[9px] uppercase leading-tight text-navy/50">
            {LANDING.passportStampsLabel} {stampCount}
          </p>
        )}

        <div className="mt-3 min-h-[3rem] text-center">
          <Typewriter
            text={LANDING.question}
            className="font-stamp text-base uppercase tracking-wide text-navy"
            onDone={() => setShowQuestion(true)}
          />
        </div>

        <div
          className={`mt-3 grid grid-cols-2 gap-4 transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <button
            type="button"
            onClick={() => handleAnswer('yes')}
            className="min-h-11 border-2 border-approve bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-approve transition-colors hover:bg-approve hover:text-paper"
          >
            {LANDING.yes}
          </button>
          <button
            type="button"
            onClick={() => handleAnswer('no')}
            className="min-h-11 border-2 border-stamp bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-stamp transition-colors hover:bg-stamp hover:text-paper"
          >
            {LANDING.no}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center">
        <OfficerMoodBadge />
      </div>

      <Footer compact />
      <HiddenBribe />
    </PageShell>
  )
}
