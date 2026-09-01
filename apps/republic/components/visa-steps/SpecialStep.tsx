'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { Checkbox } from '@/components/Checkbox'
import { useApplication } from '@/lib/applicationContext'
import { SPECIAL, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.special

// TWO screens: first the "HOW OTHER IS YOUR PURPOSE?" question alone
// (selection auto-advances), then the sworn statement, which submits
// straight to /appointment. (A post-submit redaction gag briefly lived
// between the two — removed per owner request.)
export function SpecialStep() {
  const router = useRouter()
  const { state, update, selectVisa, hydrated } = useApplication()
  // Seeded from context AFTER hydration (below) — initializing from context
  // during the first render reads the pre-hydration EMPTY_STATE on refresh
  // and would wrongly force re-entering persisted values.
  const [statement, setStatement] = useState('')
  const [otherness, setOtherness] = useState('')
  const [sworn, setSworn] = useState(false)
  const [stage, setStage] = useState<'otherness' | 'statement'>('otherness')
  const seededRef = useRef(false)

  useEffect(() => {
    if (!hydrated || seededRef.current) return
    seededRef.current = true
    // `prev ||` so anything entered before hydration finished wins.
    setStatement((prev) => prev || state.specialStatement)
    setOtherness((prev) => prev || state.specialOtherness)
    // Already answered this session (refresh/back-navigation) — don't ask
    // the otherness question again, resume at the statement screen.
    if (state.specialOtherness) setStage('statement')
  }, [hydrated, state.specialStatement, state.specialOtherness])

  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('special')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const complete = Boolean(statement.trim() && otherness && sworn)

  function chooseOtherness(option: string) {
    playBeep()
    setOtherness(option)
    update({ specialOtherness: option })
    addStamp('OTHERNESS ASSESSED')
    setStage('statement')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!complete) return
    playBeep()
    update({ specialStatement: statement.trim(), specialOtherness: otherness })
    addStamp('SWORN STATEMENT FILED')
    // Navigates straight to /appointment — no intermediate screen, per the
    // standing flow rule.
    router.push('/appointment')
  }

  // Screen 1: the otherness assessment alone. Selecting an option advances
  // immediately (selection IS the answer — no separate continue button).
  if (stage === 'otherness') {
    return (
      <StepShell visa={visa}>
        <div className="flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-wide text-navy">{SPECIAL.othernessPrompt}</p>
          <div className="flex flex-col gap-2">
            {SPECIAL.othernessOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseOtherness(option)}
                className="min-h-11 border-2 border-navy/40 px-3 py-2 text-left text-[12px] uppercase tracking-wide text-navy transition-all hover:border-approve hover:bg-approve hover:text-paper active:scale-[0.97]"
              >
                <span className="font-stamp">{option}</span>
              </button>
            ))}
          </div>
        </div>
      </StepShell>
    )
  }

  // Screen 2: the sworn statement.
  return (
    <StepShell visa={visa}>
      <form onSubmit={handleSubmit} className="animate-fade-in flex flex-col gap-3">
        <label htmlFor="statement" className="text-[11px] uppercase tracking-wide text-navy">
          {SPECIAL.prompt}
        </label>
        <textarea
          id="statement"
          required
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={4}
          placeholder={SPECIAL.placeholder}
          className="ink-border bg-paper p-2 text-[13px] text-navy placeholder:text-navy/40 focus:outline-none"
        />
        <Checkbox id="sworn-declaration" checked={sworn} onChange={setSworn} label={SPECIAL.declaration} required />
        <button
          type="submit"
          disabled={!complete}
          className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {SPECIAL.submit}
        </button>
      </form>
    </StepShell>
  )
}
