'use client'

import { useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import type { Cookie } from '@/lib/types'
import { formatEarned } from '@/lib/format'
import Sheet from './Sheet'

export default function CookieDetailSheet({
  cookie,
  onDelete,
  onClose,
}: {
  cookie: Cookie
  onDelete: (cookie: Cookie) => Promise<void>
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const earned = formatEarned(cookie.earned_on)

  return (
    <Sheet onClose={onClose}>
      <h2 className="px-1 text-xl font-semibold leading-snug text-text">{cookie.title}</h2>
      {cookie.description && (
        <p className="mt-2 px-1 text-base leading-relaxed text-text-muted">
          {cookie.description}
        </p>
      )}
      {earned && <p className="mt-2 px-1 text-sm text-text-low">{earned}</p>}

      {confirming ? (
        <button
          type="button"
          onClick={() => onDelete(cookie)}
          className="mt-5 min-h-12 w-full rounded-xl bg-coral/15 font-medium text-coral transition-colors active:bg-coral/25"
        >
          Tap again to remove this cookie
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-text-muted transition-colors active:text-text"
        >
          <IconTrash size={18} stroke={1.5} />
          Remove
        </button>
      )}
    </Sheet>
  )
}
