'use client'

import { useState } from 'react'
import { IconTrash, IconListDetails, IconChevronRight } from '@tabler/icons-react'
import type { Jar } from '@/lib/types'
import Sheet from './Sheet'
import ColorSwatches from './ColorSwatches'

export default function JarMenuSheet({
  jar,
  cookieCount,
  onShowAll,
  onRename,
  onColor,
  onDelete,
  onClose,
}: {
  jar: Jar
  cookieCount: number
  onShowAll?: () => void
  onRename: (name: string) => Promise<void>
  onColor: (color: string) => Promise<void>
  onDelete: (jar: Jar) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(jar.name)
  const [confirming, setConfirming] = useState(false)
  const trimmed = name.trim()
  const renamed = Boolean(trimmed) && trimmed !== jar.name

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex items-baseline justify-between px-1">
        <p className="text-xs uppercase tracking-wide text-text-low">Jar settings</p>
        <p className="text-xs text-text-low">{cookieCount} {cookieCount === 1 ? 'cookie' : 'cookies'}</p>
      </div>

      {onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border bg-surface px-3.5 font-medium text-text transition active:scale-[0.99] active:bg-border"
        >
          <IconListDetails size={18} stroke={1.75} className="text-text-muted" />
          <span className="flex-1 text-left">Show all cookies</span>
          <IconChevronRight size={18} stroke={1.75} className="text-text-low" />
        </button>
      )}

      <p className="mb-2 mt-5 px-1 text-xs uppercase tracking-wide text-text-low">Name</p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && renamed && onRename(trimmed)}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text focus:border-border-focus focus:outline-none"
        />
        {renamed && (
          <button
            type="button"
            onClick={() => onRename(trimmed)}
            className="shrink-0 rounded-xl bg-text px-4 font-medium text-bg transition-transform active:scale-[0.97]"
          >
            Save
          </button>
        )}
      </div>

      <p className="mb-2.5 mt-5 px-1 text-xs uppercase tracking-wide text-text-low">Jar colour</p>
      <ColorSwatches value={jar.color} onChange={onColor} />

      <div className="mt-6 border-t border-border pt-2">
        {confirming ? (
          <button
            type="button"
            onClick={() => onDelete(jar)}
            className="min-h-12 w-full rounded-xl bg-coral/15 font-medium text-coral transition-colors active:bg-coral/25"
          >
            Delete jar and its {cookieCount} {cookieCount === 1 ? 'cookie' : 'cookies'}? Tap again
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-text-muted transition-colors active:text-coral"
          >
            <IconTrash size={18} stroke={1.5} />
            Delete jar
          </button>
        )}
      </div>
    </Sheet>
  )
}
