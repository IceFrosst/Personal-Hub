'use client'

import { useState } from 'react'
import { recordBribe, getBribeCount } from '@/lib/api'
import { BRIBE, formatBribeStatus } from '@/lib/content'
import { playBeep } from '@/lib/sound'

export function BribeButton() {
  const [count, setCount] = useState<number | null>(null)
  const [justOffered, setJustOffered] = useState(false)

  async function handleClick() {
    playBeep()
    const next = await recordBribe()
    setCount(next)
    setJustOffered(true)
  }

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-sm border-2 border-navy bg-paper px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-navy transition-colors hover:bg-navy hover:text-paper"
      >
        {BRIBE.button}
      </button>
      {justOffered && (
        <p className="max-w-[240px] text-[10px] uppercase leading-snug text-stamp">
          {formatBribeStatus(count ?? getBribeCount())}
        </p>
      )}
    </div>
  )
}
