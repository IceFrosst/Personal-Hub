'use client'

import { useState } from 'react'
import { IconTrash, IconCheck } from '@tabler/icons-react'
import type { Jar } from '@/lib/types'
import { JAR_COLORS } from '@/lib/jar'
import Sheet from './Sheet'

export default function JarMenuSheet({
  jar,
  cookieCount,
  onRename,
  onColor,
  onDelete,
  onClose,
}: {
  jar: Jar
  cookieCount: number
  onRename: (name: string) => Promise<void>
  onColor: (color: string) => Promise<void>
  onDelete: (jar: Jar) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(jar.name)
  const [confirming, setConfirming] = useState(false)
  const trimmed = name.trim()
  const renamed = trimmed && trimmed !== jar.name

  return (
    <Sheet onClose={onClose}>
      <p className="mb-3 px-1 text-xs uppercase tracking-wide text-text-low">Jar settings</p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-text focus:border-border-focus focus:outline-none"
      />
      {renamed && (
        <button
          type="button"
          onClick={async () => {
            await onRename(trimmed)
            onClose()
          }}
          className="mt-2 min-h-11 w-full rounded-xl bg-surface font-medium text-text transition-colors active:bg-border"
        >
          Save name
        </button>
      )}

      {/* jar colour */}
      <p className="mb-2 mt-5 px-1 text-xs uppercase tracking-wide text-text-low">Jar colour</p>
      <div className="flex flex-wrap gap-3">
        {JAR_COLORS.map((c) => {
          const selected = c.name === jar.color
          return (
            <button
              key={c.name}
              type="button"
              aria-label={c.name}
              aria-pressed={selected}
              onClick={() => onColor(c.name)}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 ${selected ? 'ring-2 ring-text ring-offset-2 ring-offset-surface-elevated' : ''}`}
              style={{ backgroundColor: c.hex }}
            >
              {selected && <IconCheck size={20} stroke={3} className="text-white" />}
            </button>
          )
        })}
      </div>

      {confirming ? (
        <button
          type="button"
          onClick={() => onDelete(jar)}
          className="mt-6 min-h-12 w-full rounded-xl bg-coral/15 font-medium text-coral transition-colors active:bg-coral/25"
        >
          Delete jar and its {cookieCount} {cookieCount === 1 ? 'cookie' : 'cookies'}? Tap again
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-text-muted transition-colors active:text-text"
        >
          <IconTrash size={18} stroke={1.5} />
          Delete jar
        </button>
      )}
    </Sheet>
  )
}
