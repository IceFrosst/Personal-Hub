'use client'

import { useState } from 'react'
import { IconRefresh } from '@tabler/icons-react'
import { formatRefreshSummary, type RefreshResult } from '@/lib/refresh-summary'

const ERROR_MESSAGES: Record<number, string> = {
  401: 'Your session expired — sign in again.',
  403: 'This refresh is available only to the app owner.',
  409: 'A refresh is already running — try again in a minute.',
  503: 'Manual refresh is not configured on this deployment.',
}

export default function ManualRefresh() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RefreshResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    if (busy) return
    setBusy(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch('/api/ingest/refresh', {
        method: 'POST',
        headers: { 'X-Event-Radar-Action': 'refresh-sources' },
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        setError(ERROR_MESSAGES[response.status] ?? 'Couldn’t refresh sources — try again.')
        return
      }
      setResult(formatRefreshSummary(body))
    } catch {
      setError('Couldn’t refresh sources — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        aria-busy={busy}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-text-muted transition-colors duration-150 ease-out hover:border-border-focus disabled:cursor-wait disabled:opacity-60"
      >
        <IconRefresh
          size={18}
          stroke={1.5}
          aria-hidden="true"
          className={busy ? 'motion-safe:animate-spin' : ''}
        />
        {busy ? 'Refreshing sources…' : 'Refresh hackathon sources'}
      </button>
      <p className="text-xs text-text-muted">
        Runs the daily source sweep without sending push notifications. It can take up to a
        minute.
      </p>
      <div aria-live="polite" aria-atomic="true">
        {result && (
          <div className="flex flex-col gap-1">
            <p className={`text-xs ${result.tone === 'warning' ? 'text-amber' : 'text-green'}`}>
              {result.message}
            </p>
            {result.details && <p className="text-xs text-text-low">{result.details}</p>}
          </div>
        )}
        {error && <p className="text-xs text-coral">{error}</p>}
      </div>
    </div>
  )
}
