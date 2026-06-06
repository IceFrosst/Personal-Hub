'use client'

import { IconCookie } from '@tabler/icons-react'
import type { Cookie } from '@/lib/types'
import { formatEarned } from '@/lib/format'

export default function CookieCard({
  cookie,
  onTap,
}: {
  cookie: Cookie
  onTap: (cookie: Cookie) => void
}) {
  const earned = formatEarned(cookie.earned_on)
  return (
    <button
      type="button"
      onClick={() => onTap(cookie)}
      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left transition-colors active:bg-surface-elevated"
    >
      <IconCookie size={20} stroke={1.5} className="mt-0.5 shrink-0 text-coral" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text">{cookie.title}</p>
        {cookie.description && (
          <p className="mt-0.5 truncate text-sm text-text-muted">{cookie.description}</p>
        )}
        {earned && <p className="mt-1 text-xs text-text-low">{earned}</p>}
      </div>
    </button>
  )
}
