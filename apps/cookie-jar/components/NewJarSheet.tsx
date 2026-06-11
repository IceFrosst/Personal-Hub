'use client'

import { useState } from 'react'
import { JAR_COLORS } from '@/lib/jar'
import Sheet from './Sheet'
import ColorSwatches from './ColorSwatches'

export default function NewJarSheet({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, color: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(JAR_COLORS[0].name)
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()

  async function create() {
    if (!trimmed || saving) return
    setSaving(true)
    await onCreate(trimmed, color)
    setSaving(false)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <p className="mb-4 px-1 text-xs uppercase tracking-wide text-text-low">New jar</p>

      <p className="mb-2 px-1 text-xs uppercase tracking-wide text-text-low">Name</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        placeholder="Fitness, Career, Comebacks…"
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
      />

      <p className="mb-2.5 mt-5 px-1 text-xs uppercase tracking-wide text-text-low">Jar colour</p>
      <ColorSwatches value={color} onChange={setColor} />

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
