'use client'

import { useState } from 'react'
import Sheet from './Sheet'

export default function NewJarSheet({
  onCreate,
  onClose,
}: {
  onCreate: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const trimmed = name.trim()

  async function create() {
    if (!trimmed || saving) return
    setSaving(true)
    await onCreate(trimmed)
    setSaving(false)
    onClose()
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
      <button
        type="button"
        onClick={create}
        disabled={!trimmed || saving}
        className="mt-4 min-h-12 w-full rounded-xl bg-coral font-semibold text-white transition-colors active:bg-coral-bright disabled:opacity-40"
      >
        {saving ? 'Creating…' : 'Create jar'}
      </button>
    </Sheet>
  )
}
