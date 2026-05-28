'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  function handleInstagram() {
    window.location.href = 'instagram://'
    setTimeout(() => {
      window.location.href = 'https://www.instagram.com'
    }, 800)
  }

  return (
    <main
      className="flex flex-col items-center justify-center px-4 bg-bg"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="mb-10 flex flex-col items-center gap-4">
        <div
          className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={{
            background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="8" width="32" height="32" rx="10" stroke="white" strokeWidth="3" fill="none" />
            <circle cx="24" cy="24" r="8" stroke="white" strokeWidth="3" fill="none" />
            <circle cx="34.5" cy="13.5" r="2" fill="white" />
          </svg>
        </div>
        <p className="text-text-muted text-sm">Pause before you open Instagram</p>
      </div>

      {suggestion && (
        <div className="w-full max-w-[340px] mb-8 p-4 bg-surface rounded-2xl border border-border">
          <p className="text-xs uppercase tracking-wide text-text-low mb-1">Maybe do this first?</p>
          <p className="text-text font-medium text-base">{suggestion.taskTitle}</p>
          <p className="text-text-muted text-sm mt-1">{suggestion.reason}</p>
        </div>
      )}

      <div className="w-full max-w-[340px] flex flex-col gap-3">
        <button
          onClick={handleInstagram}
          className="w-full min-h-11 py-3 px-4 rounded-md text-white text-base font-medium transition-colors duration-150 active:opacity-80"
          style={{
            background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)',
          }}
        >
          Taking a real break
        </button>
        <button
          onClick={() => router.push('/tasks')}
          className="w-full min-h-11 py-3 px-4 rounded-md bg-surface border border-border text-text text-base transition-colors duration-150 active:opacity-80"
        >
          Avoiding something
        </button>
      </div>
    </main>
  )
}
