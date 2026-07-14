'use client'

import { useEffect, useRef } from 'react'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
const pad = (n: number) => String(n).padStart(2, '0')
const ITEM_H = 36 // must match the h-9 rows below

function Column({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: number[]
  value: number
  onChange: (n: number) => void
  ariaLabel: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Center the initial value once on mount (don't fight the user's scroll after).
  useEffect(() => {
    const idx = items.indexOf(value)
    if (ref.current && idx >= 0) ref.current.scrollTop = idx * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScroll() {
    if (settleRef.current) clearTimeout(settleRef.current)
    settleRef.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      let idx = Math.round(el.scrollTop / ITEM_H)
      idx = Math.max(0, Math.min(items.length - 1, idx))
      const target = idx * ITEM_H
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target, behavior: 'smooth' })
      if (items[idx] !== value) onChange(items[idx])
    }, 110)
  }

  return (
    <div className="relative h-[108px] w-12 overflow-hidden">
      <div
        ref={ref}
        onScroll={handleScroll}
        role="listbox"
        aria-label={ariaLabel}
        className="h-full overflow-y-auto snap-y snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        <div style={{ height: ITEM_H }} />
        {items.map((it) => {
          const active = it === value
          return (
            <div
              key={it}
              className={`h-9 snap-center flex items-center justify-center text-lg tabular-nums transition-colors ${
                active ? 'text-text font-semibold' : 'text-text-low'
              }`}
            >
              {pad(it)}
            </div>
          )
        })}
        <div style={{ height: ITEM_H }} />
      </div>

      {/* center selection band */}
      <div className="pointer-events-none absolute inset-x-0 top-9 h-9 rounded-md border border-border-focus bg-white/5" />
      {/* top / bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-gradient-to-b from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-surface to-transparent" />
    </div>
  )
}

export default function TimeWheel({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [h, m] = value.split(':').map(Number)
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-surface border border-border px-3">
      <Column
        items={HOURS}
        value={h}
        ariaLabel="Hour"
        onChange={(nh) => onChange(`${pad(nh)}:${pad(m)}`)}
      />
      <span className="text-text font-semibold pb-0.5">:</span>
      <Column
        items={MINUTES}
        value={m}
        ariaLabel="Minute"
        onChange={(nm) => onChange(`${pad(h)}:${pad(nm)}`)}
      />
    </div>
  )
}
