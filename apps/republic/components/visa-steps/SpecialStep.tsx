'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { Checkbox } from '@/components/Checkbox'
import { useApplication } from '@/lib/applicationContext'
import { SPECIAL, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep, playStampThunk } from '@/lib/sound'

const visa = VISA_BY_SLUG.special

// After submission the statement is briefly shown with random words blacked
// out ("STATEMENT REDACTED FOR YOUR PROTECTION.") before auto-advancing to
// /appointment — auto-advance, not a button, per the standing no-intermediate-
// confirmation rule. The un-redacted statement still prints on the passport.
const REDACTION_DISPLAY_MS = 2600

export function SpecialStep() {
  const router = useRouter()
  const { state, update, selectVisa, hydrated } = useApplication()
  // Seeded from context AFTER hydration (below) — initializing from context
  // during the first render reads the pre-hydration EMPTY_STATE on refresh
  // and would wrongly force re-entering persisted values.
  const [statement, setStatement] = useState('')
  const [otherness, setOtherness] = useState('')
  const [sworn, setSworn] = useState(false)
  const seededRef = useRef(false)
  // null = form phase; an array = redaction phase (indexes of blacked words).
  // Randomness is computed in the submit handler, never during render, so
  // static prerender/hydration never see it (hydration-safety rule).
  const [redactedIndexes, setRedactedIndexes] = useState<number[] | null>(null)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hydrated || seededRef.current) return
    seededRef.current = true
    // `prev ||` so anything entered before hydration finished wins.
    setStatement((prev) => prev || state.specialStatement)
    setOtherness((prev) => prev || state.specialOtherness)
  }, [hydrated, state.specialStatement, state.specialOtherness])

  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('special')
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const complete = Boolean(statement.trim() && otherness && sworn)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!complete || redactedIndexes !== null) return
    playBeep()
    update({ specialStatement: statement.trim(), specialOtherness: otherness })
    addStamp('SWORN STATEMENT FILED')
    // Black out roughly 40% of words (always at least one), then advance.
    const words = statement.trim().split(/\s+/)
    const indexes = words
      .map((_, i) => i)
      .filter(() => Math.random() < 0.4)
    if (indexes.length === 0) indexes.push(Math.floor(Math.random() * words.length))
    setRedactedIndexes(indexes)
    playStampThunk()
    advanceTimerRef.current = setTimeout(() => router.push('/appointment'), REDACTION_DISPLAY_MS)
  }

  if (redactedIndexes !== null) {
    const words = statement.trim().split(/\s+/)
    return (
      <StepShell visa={visa}>
        <div className="animate-fade-in">
          <p className="text-center font-stamp text-sm uppercase tracking-wide text-stamp">
            {SPECIAL.redactedNotice}
          </p>
          <p className="mt-3 border-2 border-navy/30 bg-paper p-3 text-[13px] leading-relaxed text-navy">
            {words.map((word, i) => (
              <span key={i}>
                {redactedIndexes.includes(i) ? (
                  <span className="select-none bg-navy text-transparent" aria-hidden>
                    {word}
                  </span>
                ) : (
                  word
                )}{' '}
              </span>
            ))}
          </p>
        </div>
      </StepShell>
    )
  }

  return (
    <StepShell visa={visa}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Otherness assessment — required before the sworn statement. */}
        <p className="text-[11px] uppercase tracking-wide text-navy">{SPECIAL.othernessPrompt}</p>
        <div className="flex flex-col gap-2">
          {SPECIAL.othernessOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                playBeep()
                setOtherness(option)
              }}
              className={`min-h-11 border-2 px-3 py-2 text-left text-[12px] uppercase tracking-wide transition-all active:scale-[0.97] ${
                otherness === option
                  ? 'border-approve bg-approve text-paper'
                  : 'border-navy/40 text-navy hover:border-approve'
              }`}
            >
              <span className="font-stamp">{option}</span>
            </button>
          ))}
        </div>

        <label htmlFor="statement" className="mt-2 text-[11px] uppercase tracking-wide text-navy">
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
