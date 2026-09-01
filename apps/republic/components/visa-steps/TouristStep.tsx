'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { SIDEQUEST, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.tourist

// The sidequest visa has a real sub-step again (owner request): "WHAT'S THE
// IDEA?" with a free-text box whose placeholder ("It better be good")
// disappears the moment typing starts — standard placeholder behavior, no
// custom logic needed. The idea prints on the progress card and final
// document via lib/visaAddendum.ts, same as every other visa's sub-step.
// (It previously rendered nothing and bounced straight to /appointment.)
export function TouristStep() {
  const router = useRouter()
  const { state, update, selectVisa } = useApplication()
  const [idea, setIdea] = useState(state.sidequestIdea)

  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('tourist')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!idea.trim()) return
    playBeep()
    update({ sidequestIdea: idea.trim() })
    addStamp('SIDEQUEST IDEA FILED')
    // Navigates straight to /appointment — same no-confirmation flow as
    // every other sub-step.
    router.push('/appointment')
  }

  return (
    <StepShell visa={visa}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="sidequest-idea" className="text-[11px] uppercase tracking-wide text-navy">
          {SIDEQUEST.prompt}
        </label>
        <textarea
          id="sidequest-idea"
          required
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={4}
          placeholder={SIDEQUEST.placeholder}
          className="ink-border bg-paper p-2 text-[13px] text-navy placeholder:text-navy/40 focus:outline-none"
        />
        <button
          type="submit"
          className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
        >
          {SIDEQUEST.submit}
        </button>
      </form>
    </StepShell>
  )
}
