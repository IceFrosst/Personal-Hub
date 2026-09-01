'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { Checkbox } from '@/components/Checkbox'
import { useApplication } from '@/lib/applicationContext'
import { SIDEQUEST, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.tourist

// TWO screens (owner request): first "WHAT'S THE IDEA?" alone, then the
// customs supply declaration on its own screen. The supplies remain
// optional; declaring all four earns the FULLY EQUIPPED passport stamp.
export function TouristStep() {
  const router = useRouter()
  const { state, update, selectVisa, hydrated } = useApplication()
  // Seeded from context AFTER hydration (below), never from the initial
  // render — the provider reads sessionStorage in its own effect, so state
  // here is still EMPTY_STATE on a mid-funnel refresh and initializing from
  // it directly would silently discard persisted values on resubmit.
  const [idea, setIdea] = useState('')
  const [supplies, setSupplies] = useState<string[]>([])
  const [stage, setStage] = useState<'idea' | 'supplies'>('idea')
  const seededRef = useRef(false)

  useEffect(() => {
    if (!hydrated || seededRef.current) return
    seededRef.current = true
    // Forward-lock: everything here was already answered — nothing is
    // editable after the fact (owner rule).
    if (state.sidequestSuppliesDeclared) {
      router.replace('/appointment')
      return
    }
    // `prev ||` so anything typed before hydration finished wins.
    setIdea((prev) => prev || state.sidequestIdea)
    setSupplies((prev) => (prev.length ? prev : state.sidequestSupplies))
    // Idea already filed — resume at the supply declaration, don't re-ask.
    if (state.sidequestIdea) setStage('supplies')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, state.sidequestIdea, state.sidequestSupplies, state.sidequestSuppliesDeclared])

  useEffect(() => {
    // `selectVisa` (not a bare `update`) so a direct/deep link straight into
    // this sub-step still establishes SERIAL № together with visaType — see
    // lib/applicationContext.tsx#selectVisa.
    selectVisa('tourist')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleSupply(name: string, checked: boolean) {
    setSupplies((prev) => (checked ? [...prev, name] : prev.filter((s) => s !== name)))
  }

  function submitIdea(e: React.FormEvent) {
    e.preventDefault()
    if (!idea.trim()) return
    playBeep()
    update({ sidequestIdea: idea.trim() })
    addStamp('SIDEQUEST IDEA FILED')
    setStage('supplies')
  }

  function submitSupplies(e: React.FormEvent) {
    e.preventDefault()
    playBeep()
    // Preserve the canonical declaration order regardless of check order.
    update({
      sidequestSupplies: SIDEQUEST.supplies.filter((s) => supplies.includes(s)),
      sidequestSuppliesDeclared: true,
    })
    addStamp('EXPEDITION SUPPLIES DECLARED')
    // Navigates straight to /appointment — no confirmation screen, per the
    // standing flow rule.
    router.push('/appointment')
  }

  if (hydrated && state.sidequestSuppliesDeclared) return null

  if (stage === 'supplies') {
    return (
      <StepShell visa={visa}>
        <form onSubmit={submitSupplies} className="animate-fade-in flex flex-col gap-3">
          <p className="text-[11px] uppercase tracking-wide text-navy">{SIDEQUEST.suppliesHeading}</p>
          <div className="flex flex-col gap-2">
            {SIDEQUEST.supplies.map((name) => (
              <Checkbox
                key={name}
                id={`supply-${name.replace(/\s+/g, '-').toLowerCase()}`}
                checked={supplies.includes(name)}
                onChange={(checked) => toggleSupply(name, checked)}
                label={name}
              />
            ))}
          </div>
          <button
            type="submit"
            className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            {SIDEQUEST.suppliesSubmit}
          </button>
        </form>
      </StepShell>
    )
  }

  return (
    <StepShell visa={visa}>
      <form onSubmit={submitIdea} className="flex flex-col gap-3">
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
