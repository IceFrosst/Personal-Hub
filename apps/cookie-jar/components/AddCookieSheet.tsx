'use client'

import { useState } from 'react'
import Sheet from './Sheet'

export default function AddCookieSheet({
  jarName,
  onSave,
  onClose,
}: {
  jarName: string
  onSave: (input: { title: string; description: string | null; earnedOn: string | null }) => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [earnedOn, setEarnedOn] = useState('')
  const [saving, setSaving] = useState(false)

  const trimmed = title.trim()

  async function save() {
    if (!trimmed || saving) return
    setSaving(true)
    await onSave({
      title: trimmed,
      description: description.trim() || null,
      earnedOn: earnedOn || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <p className="mb-3 px-1 text-xs uppercase tracking-wide text-text-low">
        New cookie · {jarName}
      </p>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="What did you conquer?"
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="The story — what made it hard, how you pushed through (optional)"
        rows={3}
        className="mt-2 w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text placeholder:text-text-low focus:border-border-focus focus:outline-none"
      />

      <label className="mt-2 flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-3">
        <span className="text-sm text-text-muted">Date earned (optional)</span>
        <input
          type="date"
          value={earnedOn}
          onChange={(e) => setEarnedOn(e.target.value)}
          className="bg-transparent text-sm text-text focus:outline-none"
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={!trimmed || saving}
        className="mt-4 min-h-12 w-full rounded-xl bg-coral font-semibold text-white transition-colors active:bg-coral-bright disabled:opacity-40"
      >
        {saving ? 'Adding…' : 'Add to jar'}
      </button>
    </Sheet>
  )
}
