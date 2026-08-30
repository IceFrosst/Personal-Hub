'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StepShell } from './StepShell'
import { Checkbox } from '@/components/Checkbox'
import { useApplication } from '@/lib/applicationContext'
import { SPECIAL, VISA_BY_SLUG } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

const visa = VISA_BY_SLUG.special

export function SpecialStep() {
  const router = useRouter()
  const { state, update } = useApplication()
  const [statement, setStatement] = useState(state.specialStatement)
  const [sworn, setSworn] = useState(false)

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
    // Navigates straight to /appointment — no intermediate "reply" screen or
    // confirmation button anymore (owner flow change).
    router.push('/appointment')
  }

  return (
    <StepShell visa={visa}>
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
        <Checkbox id="sworn-declaration" checked={sworn} onChange={setSworn} label={SPECIAL.declaration} required />
        <button
          type="submit"
          disabled={!statement.trim() || !sworn}
          className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {SPECIAL.submit}
        </button>
      </form>
    </StepShell>
  )
}
