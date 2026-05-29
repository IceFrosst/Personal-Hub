'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Priority, Suggestion } from '@/lib/types'

const IG_GRADIENT =
  'linear-gradient(135deg, #feda75 0%, #fa7e1e 22%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)'

// Iron-rule #1 gotcha: this cross-app URL belongs in apps/hub/config/apps.json.
// Hoisted to one constant until shared config exists (see apps/focus-gate/CLAUDE.md → Next).
const LOCK_IN_URL = 'https://icefrosst-lock-in.vercel.app'

// Priority label + accent. high → coral, medium → amber, low → muted (portfolio palette).
const PRIORITY_STYLE: Record<Priority, { label: string; className: string }> = {
  high: { label: 'High', className: 'text-coral' },
  medium: { label: 'Medium', className: 'text-amber' },
  low: { label: 'Low', className: 'text-text-low' },
}

// Due date as a short, friendly label — relative when close, otherwise a day/month.
function formatDue(due: string | null): string | null {
  if (!due) return null
  const d = new Date(due + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function GatePage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const params = new URLSearchParams(window.location.search)

    // Preview-only sample so the card can be seen without tasks or Gemini (?demo=1).
    // Remove before shipping to production (see apps/focus-gate/CLAUDE.md → Next).
    if (params.get('demo') === '1') {
      const iso = (offset: number) => {
        const d = new Date()
        d.setDate(d.getDate() + offset)
        return d.toISOString().slice(0, 10)
      }
      setSuggestions([
        { taskId: 'demo-1', taskTitle: 'Finish the maths problem set', priority: 'high', dueDate: iso(0) },
        { taskId: 'demo-2', taskTitle: 'Reply to landlord email', priority: 'medium', dueDate: iso(2) },
      ])
      return
    }

    async function loadSuggestions() {
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
          if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions)
        }
      } catch {}
    }

    loadSuggestions()
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
      className="flex flex-col px-4 bg-black"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* Suggested tasks — near the top of the screen */}
      {suggestions.length > 0 && (
        <div className="w-full max-w-[340px] mx-auto p-4 bg-surface rounded-2xl border border-border">
          <p className="text-xs uppercase tracking-wide text-text-low mb-3">Suggested tasks</p>
          <ul className="flex flex-col">
            {suggestions.map((s, i) => {
              const ps = s.priority ? PRIORITY_STYLE[s.priority] : null
              const due = formatDue(s.dueDate)
              return (
                <li
                  key={s.taskId}
                  className={i > 0 ? 'mt-3 pt-3 border-t border-border' : ''}
                >
                  <p className="text-text font-medium text-base leading-snug">{s.taskTitle}</p>
                  {(ps || due) && (
                    <div className="mt-1 flex items-center gap-2 text-sm">
                      {ps && <span className={`font-medium ${ps.className}`}>{ps.label}</span>}
                      {ps && due && <span className="text-text-low">·</span>}
                      {due && <span className="text-text-muted">{due}</span>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Hero — centered in the space below the suggestions */}
      <div className="flex-1 flex flex-col items-center justify-center">
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
      </div>
    </main>
  )
}
