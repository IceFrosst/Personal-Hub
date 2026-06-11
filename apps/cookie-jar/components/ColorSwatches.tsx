'use client'

import { IconCheck } from '@tabler/icons-react'
import { JAR_COLORS } from '@/lib/jar'

// The 7 jar colours in a single row (justify-between — no orphan wrapping),
// 44px touch targets, check + ring on the selected swatch.
export default function ColorSwatches({
  value,
  onChange,
}: {
  value: string
  onChange: (name: string) => void
}) {
  return (
    <div className="flex w-full items-center justify-between">
      {JAR_COLORS.map((c) => {
        const selected = c.name === value
        return (
          <button
            key={c.name}
            type="button"
            aria-label={c.name}
            aria-pressed={selected}
            onClick={() => onChange(c.name)}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 ${selected ? 'ring-2 ring-text ring-offset-2 ring-offset-surface-elevated' : ''}`}
            style={{ backgroundColor: c.hex }}
          >
            {selected && <IconCheck size={20} stroke={3} className="text-white" />}
          </button>
        )
      })}
    </div>
  )
}
