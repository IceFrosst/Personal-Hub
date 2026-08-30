'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { useApplication } from '@/lib/applicationContext'
import { SPECIAL, SPECIAL_REPLIES, VISA_BY_SLUG, CONTINUE_TO_APPOINTMENT } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.special

export function SpecialStep() {
  const router = useRouter()
  const { state, update } = useApplication()
  const [statement, setStatement] = useState(state.specialStatement)
  const [sworn, setSworn] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const reply = useMemo(() => SPECIAL_REPLIES[Math.floor(Math.random() * SPECIAL_REPLIES.length)], [])

  useEffect(() => {
    update({ visaType: 'special' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!statement.trim() || !sworn) return
    playBeep()
    update({ specialStatement: statement.trim() })
    addStamp('SWORN STATEMENT FILED')
    setSubmitted(true)
  }

  return (
    <StepShell visa={visa}>
      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
          <label className="flex items-start gap-2 text-[11px] uppercase text-navy">
            <input
              type="checkbox"
              checked={sworn}
              onChange={(e) => setSworn(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
              required
            />
            <span>{SPECIAL.declaration}</span>
          </label>
          <button
            type="submit"
            disabled={!statement.trim() || !sworn}
            className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {SPECIAL.submit}
          </button>
        </form>
      ) : (
        <div className="animate-fade-in">
          <p className="text-[12px] uppercase leading-relaxed text-navy">{reply}</p>
          <button
            type="button"
            onClick={() => router.push('/appointment')}
            className="mt-6 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            {CONTINUE_TO_APPOINTMENT}
          </button>
        </div>
      )}
    </StepShell>
  )
}
