'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Suggestion } from '@/lib/types'

const IG_GRADIENT =
  'linear-gradient(135deg, #feda75 0%, #fa7e1e 22%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)'

// Iron-rule #1 gotcha: this cross-app URL belongs in apps/hub/config/apps.json.
// Hoisted to one constant until shared config exists (see apps/focus-gate/CLAUDE.md → Next).
const LOCK_IN_URL = 'https://icefrosst-lock-in.vercel.app'

// Friction before Instagram: "Having a break" dodges instead of going straight through.
// It can respawn at most 3 times, with falling odds each press; a failed roll — or the
// 4th press once it's out of respawns — lets you through. The decreasing odds guarantee
// you always get there within a few taps, it just isn't a reflex any more.
const DODGE_ODDS = [0.75, 0.5, 0.33]

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
  if (diff <= 6) return d.toLocaleDateString('en-GB', { weekday: 'short' }) // e.g. Fri
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function GatePage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  // Dodging "Having a break" button.
  const [dodges, setDodges] = useState(0) // successful respawns so far (0..3)
  const [escaped, setEscaped] = useState(false) // has left its slot and gone fixed-position
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [hidden, setHidden] = useState(false) // mid-teleport: invisible while relocating
  const [spin, setSpin] = useState(0) // playful spin-in angle
  const breakBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    const params = new URLSearchParams(window.location.search)

    // Preview-only sample so the panel can be seen without tasks or Gemini (?demo=1).
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

  // Keep the escaped button on-screen if the viewport changes.
  useEffect(() => {
    if (!escaped) return
    const clamp = () => {
      const bw = breakBtnRef.current?.offsetWidth ?? 150
      const bh = breakBtnRef.current?.offsetHeight ?? 48
      setPos((p) => ({
        top: Math.min(p.top, Math.max(72, window.innerHeight - bh - 24)),
        left: Math.min(p.left, Math.max(14, window.innerWidth - bw - 14)),
      }))
    }
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [escaped])

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

  // Pick a fresh on-screen spot clearly away from where the button is right now.
  function randomSpot(): { top: number; left: number } {
    const el = breakBtnRef.current
    const bw = el?.offsetWidth ?? 150
    const bh = el?.offsetHeight ?? 48
    const rect = el?.getBoundingClientRect()
    const curLeft = rect ? rect.left : pos.left
    const curTop = rect ? rect.top : pos.top
    const padX = 14
    const padTop = 72 // keep clear of the status bar / safe area up top
    const padBottom = 24
    const maxLeft = Math.max(padX, window.innerWidth - bw - padX)
    const maxTop = Math.max(padTop, window.innerHeight - bh - padBottom)
    let spot = { top: padTop, left: padX }
    for (let i = 0; i < 16; i++) {
      spot = {
        left: padX + Math.random() * (maxLeft - padX),
        top: padTop + Math.random() * (maxTop - padTop),
      }
      // Enforce a real jump (from the in-slot button too, via its live rect).
      if (Math.hypot(spot.left - curLeft, spot.top - curTop) > 160) break
    }
    return spot
  }

  function teleport() {
    setSpin(Math.random() * 30 - 15)
    setHidden(true) // shrink + fade out (works in-slot and once it's loose)
    window.setTimeout(() => {
      setPos(randomSpot())
      setEscaped(true) // hand off to the free-floating, fixed-position button...
      // ...then reveal on the next frames so it springs in at the new spot.
      requestAnimationFrame(() => requestAnimationFrame(() => setHidden(false)))
    }, 170)
  }

  function handleBreak() {
    if (dodges < 3 && Math.random() < DODGE_ODDS[dodges]) {
      teleport()
      setDodges((d) => d + 1)
    } else {
      openInstagram()
    }
  }

  const hasSuggestions = suggestions.length > 0

  const breakBtnClass =
    'lock-in-button min-h-11 py-2.5 px-4 rounded-xl text-white text-base font-bold tracking-wide text-center whitespace-nowrap'

  // Direction C — soft-glow panel: a gradient-hairline card with the CTAs' glow, dimmed.
  // Priority drives title emphasis; due-date urgency drives the chip colour. Real data only.
  const suggestionPanel = hasSuggestions && (
    <div className="w-full max-w-[340px] mx-auto">
      <div
        className="rounded-2xl p-px"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(250,126,30,0.55), rgba(214,41,118,0.5), rgba(79,91,213,0.45))',
          boxShadow:
            '0 12px 40px -16px rgba(214,41,118,0.5), 0 4px 18px -8px rgba(150,47,191,0.4)',
        }}
      >
        <div className="rounded-[15px] px-4 py-3.5" style={{ backgroundColor: '#161618' }}>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-[7px] h-[7px] rounded-full"
              style={{ backgroundImage: IG_GRADIENT, boxShadow: '0 0 7px rgba(214,41,118,0.55)' }}
            />
            <span className="text-[13px] font-semibold text-text">Suggested tasks</span>
          </div>
          {suggestions.map((s, i) => {
            const due = formatDue(s.dueDate)
            const dueClass =
              due === 'Overdue'
                ? 'text-coral'
                : due === 'Today' || due === 'Tomorrow'
                  ? 'text-amber'
                  : 'text-text-low'
            const titleClass =
              s.priority === 'high'
                ? 'font-semibold text-text'
                : s.priority === 'medium'
                  ? 'font-medium text-text'
                  : 'font-medium text-text-muted'
            return (
              <div key={s.taskId}>
                {i > 0 && <div className="h-px bg-white/[0.06]" />}
                <div className="flex items-center justify-between gap-3 py-2">
                  <span className={`text-sm truncate ${titleClass}`}>{s.taskTitle}</span>
                  {due && <span className={`shrink-0 text-xs font-medium ${dueClass}`}>{due}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const hero = (
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

        {escaped ? (
          // Invisible placeholder holds the slot so "Lock in" never shifts while the
          // real button is off dodging around the screen.
          <div aria-hidden className={breakBtnClass} style={{ visibility: 'hidden' }}>
            Having a break
          </div>
        ) : (
          <button
            ref={breakBtnRef}
            onClick={handleBreak}
            className={`${breakBtnClass} transition-transform duration-150 ${
              hidden ? '' : 'active:scale-[0.98]'
            }`}
            // While dodging out, animate via transform only so "Lock in" never shifts.
            style={
              hidden
                ? {
                    opacity: 0,
                    transform: `scale(0.4) rotate(${spin}deg)`,
                    transition: 'opacity 0.16s ease, transform 0.16s ease',
                  }
                : undefined
            }
          >
            Having a break
          </button>
        )}
      </div>
    </div>
  )

  return (
    <main
      className="flex flex-col px-4 bg-black"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-10">
        {suggestionPanel}
        {hero}
      </div>

      {escaped && (
        <button
          ref={breakBtnRef}
          onClick={handleBreak}
          className={`${breakBtnClass} fixed z-50`}
          style={{
            top: pos.top,
            left: pos.left,
            width: 150,
            opacity: hidden ? 0 : 1,
            transform: hidden ? `scale(0.4) rotate(${spin}deg)` : 'scale(1) rotate(0deg)',
            transition: 'opacity 0.17s ease, transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
            willChange: 'transform, opacity',
          }}
        >
          Having a break
        </button>
      )}
    </main>
  )
}
