'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const IG_GRADIENT =
  'linear-gradient(135deg, #feda75 0%, #fa7e1e 22%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)'

export default function GatePage() {
  const router = useRouter()
  const [suggestion, setSuggestion] = useState<{
    taskId: string
    taskTitle: string
    reason: string
  } | null>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
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
          body: JSON.stringify({ tasks }),
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

        {suggestion && (
          <div className="w-full mb-8 p-4 bg-surface rounded-2xl border border-border">
            <p className="text-xs uppercase tracking-wide text-text-low mb-1">
              Maybe do this first?
            </p>
            <p className="text-text font-medium text-base">{suggestion.taskTitle}</p>
            <p className="text-text-muted text-sm mt-1">{suggestion.reason}</p>
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => router.push('/tasks')}
            className="lock-in-button w-full min-h-14 py-4 px-4 rounded-2xl text-white text-lg font-bold tracking-wide active:scale-[0.98] transition-transform duration-150"
          >
            Lock in
          </button>
          <button
            onClick={openInstagram}
            className="w-full min-h-11 py-3 px-4 rounded-md bg-transparent border border-border text-text-muted text-sm transition-colors duration-150 active:opacity-80"
          >
            Having a break
          </button>
        </div>
      </div>
    </main>
  )
}
