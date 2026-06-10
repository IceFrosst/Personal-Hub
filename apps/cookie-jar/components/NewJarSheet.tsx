'use client'

import { useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import { JAR_COLORS } from '@/lib/jar'
import Sheet from './Sheet'

export default function NewJarSheet({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, color: string) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(JAR_COLORS[0].name)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const trimmed = name.trim()

  // keep the sheet (and the typed name) when the insert fails
  async function create() {
    if (!trimmed || saving) return
    setSaving(true); setFailed(false)
    const ok = await onCreate(trimmed, color)
    setSaving(false)
    if (ok) onClose()
    else setFailed(true)
  }

  return (
    <Sheet onClose={onClose}>
      <p className="mb-3 px-1 text-xs uppercase tracking-wide text-text-low">New jar</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        placeholder="Name your jar — Fitness, Career, Comebacks…"
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
      />

      <p className="mb-2 mt-5 px-1 text-xs uppercase tracking-wide text-text-low">Jar colour</p>
      <div className="flex flex-wrap gap-3">
        {JAR_COLORS.map((c) => {
          const selected = c.name === color
          return (
            <button
              key={c.name}
              type="button"
              aria-label={c.name}
              aria-pressed={selected}
              onClick={() => setColor(c.name)}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 ${selected ? 'ring-2 ring-text ring-offset-2 ring-offset-surface-elevated' : ''}`}
              style={{ backgroundColor: c.hex }}
            >
              {selected && <IconCheck size={20} stroke={3} className="text-white" />}
            </button>
          )
        })}
      </div>

      {failed && (
        <p role="alert" className="mt-4 px-1 text-xs leading-snug text-coral">Couldn&apos;t create the jar — try again.</p>
      )}

      <button
        type="button"
        onClick={create}
        disabled={!trimmed || saving}
        className="mt-6 min-h-12 w-full rounded-xl bg-coral font-semibold text-white transition active:scale-[0.98] active:bg-coral-bright disabled:opacity-40"
      >
        {saving ? 'Creating…' : 'Create jar'}
      </button>
    </Sheet>
  )
}
