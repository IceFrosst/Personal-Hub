'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Suggestion } from '@/lib/types'

const IG_GRADIENT =
  'linear-gradient(135deg, #feda75 0%, #fa7e1e 22%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)'

// Iron-rule #1 gotcha: this cross-app URL belongs in apps/hub/config/apps.json.
// Hoisted to one constant until shared config exists (see apps/focus-gate/CLAUDE.md → Next).
const LOCK_IN_URL = 'https://icefrosst-lock-in.vercel.app'

// Preview-only sample so the popup/inline card can be compared without tasks or Gemini (?demo=1).
const DEMO_SUGGESTION: Suggestion = {
  taskId: 'demo',
  taskTitle: 'Text Mum back',
  reason: 'A small one to close the day — then rest.',
}

type Mode = 'popup' | 'card'

export default function GatePage() {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  // Preview: 'popup' is the new headline presentation; ?s=card shows the inline version.
  const [mode, setMode] = useState<Mode>('popup')
  const [popupOpen, setPopupOpen] = useState(true)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const params = new URLSearchParams(window.location.search)
    const s = params.get('s')
    if (s === 'card' || s === 'popup') setMode(s)

    if (params.get('demo') === '1') {
      setSuggestion(DEMO_SUGGESTION)
      return
    }

    async function loadSuggestion() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: tasks } = await supabase
        .schema('focus_gate')
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', false)

      if (!tasks?.length) return

      try {
        const res = await fetch('/api/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks, clientHour: new Date().getHours() }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.taskId) setSuggestion(data)
        }
      } catch {}
    }

    loadSuggestion()
  }, [])

  function openInstagram() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    if (/Android/i.test(ua)) {
      window.location.href =
        'intent://instagram.com/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=https%3A%2F%2Fwww.instagram.com;end'
      return
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      window.location.href = 'instagram://app'
      setTimeout(() => {
        window.location.href = 'https://www.instagram.com'
      }, 800)
      return
    }
    window.location.href = 'https://www.instagram.com'
  }

  function goLockIn() {
    window.location.href = LOCK_IN_URL
  }

  return (
    <main
      className="flex flex-col items-center justify-center px-4 bg-black"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-[340px] flex flex-col items-center">
        <h1
          className="text-7xl font-black tracking-tight mb-12 select-none"
          style={{
            backgroundImage: IG_GRADIENT,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          HOLD UP
        </h1>

        {mode === 'card' && suggestion && (
          <div className="w-full mb-8 p-4 bg-surface rounded-2xl border border-border">
            <p className="text-xs uppercase tracking-wide text-text-low mb-1">
              Maybe do this first?
            </p>
            <p className="text-text font-medium text-base">{suggestion.taskTitle}</p>
            <p className="text-text-muted text-sm mt-1">{suggestion.reason}</p>
          </div>
        )}

        <div className="flex flex-col items-stretch gap-2.5 w-[150px] mx-auto">
          <button
            onClick={goLockIn}
            className="lock-in-gold-button min-h-11 py-2.5 px-4 rounded-xl text-black text-base font-bold tracking-wide text-center whitespace-nowrap active:scale-[0.97] transition-transform duration-150"
          >
            Lock in
          </button>
          <button
            onClick={openInstagram}
            className="lock-in-button min-h-11 py-2.5 px-4 rounded-xl text-white text-base font-bold tracking-wide text-center whitespace-nowrap active:scale-[0.98] transition-transform duration-150"
          >
            Having a break
          </button>
        </div>
      </div>

      {/* Popup presentation — bottom sheet, auto on load */}
      {mode === 'popup' && popupOpen && suggestion && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPopupOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[440px] bg-surface-elevated rounded-t-3xl border-t border-x border-border px-6 pt-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <p className="text-xs uppercase tracking-wide text-text-low mb-1">
              Maybe do this first?
            </p>
            <p className="text-text font-semibold text-lg">{suggestion.taskTitle}</p>
            <p className="text-text-muted text-sm mt-1">{suggestion.reason}</p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                onClick={goLockIn}
                className="lock-in-gold-button min-h-11 py-3 px-4 rounded-xl text-black text-base font-bold tracking-wide text-center active:scale-[0.98] transition-transform duration-150"
              >
                Lock in &amp; do it
              </button>
              <button
                onClick={() => setPopupOpen(false)}
                className="min-h-11 py-3 px-4 rounded-xl text-text-muted text-base font-medium text-center active:scale-[0.98] transition-transform duration-150"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview-only toggle to compare the two presentations. Remove once a version is chosen. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[60] flex gap-1 p-1 rounded-full bg-surface border border-border"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        {(['popup', 'card'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m)
              if (m === 'popup') setPopupOpen(true)
            }}
            className={`min-h-9 px-3 rounded-full text-xs font-medium transition-colors duration-150 ${
              mode === m ? 'bg-surface-elevated text-text' : 'text-text-low'
            }`}
          >
            {m === 'popup' ? 'Popup' : 'Inline'}
          </button>
        ))}
      </div>
    </main>
  )
}
