'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { StampSlam } from '@/components/StampSlam'
import { Footer } from '@/components/Footer'
import { DENIAL, DENIAL_REASONS } from '@/lib/content'
import { addStamp } from '@/lib/passport'
import { playStampThunk } from '@/lib/sound'

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function randomCaseNumber() {
  return `IG-${Math.floor(100000 + Math.random() * 899999)}`
}

export default function DeniedPage() {
  const router = useRouter()
  // Screenshot-critical screen: none of these may differ between the
  // server-rendered HTML and the client's first (hydration) render, so every
  // random/locale-dependent value starts `null`/`false` here (matching what
  // the server produced) and is only ever filled in from inside the effect
  // below, which runs exclusively on the client after hydration completes.
  const [shake, setShake] = useState(false)
  const [showAppeal, setShowAppeal] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [caseNumber, setCaseNumber] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)

  useEffect(() => {
    setReason(DENIAL_REASONS[Math.floor(Math.random() * DENIAL_REASONS.length)])
    setCaseNumber(randomCaseNumber())
    setDate(new Date().toLocaleDateString('en-GB'))

    playStampThunk()
    addStamp('ENTRY DENIED')

    if (!prefersReducedMotion()) setShake(true)
    const shakeTimer = setTimeout(() => setShake(false), 500)
    const appealTimer = setTimeout(() => setShowAppeal(true), 2000)
    return () => {
      clearTimeout(shakeTimer)
      clearTimeout(appealTimer)
    }
  }, [])

  return (
    <PageShell>
      <div className={`paper-card p-6 text-center ${shake ? 'animate-screen-shake' : ''}`}>
        <StampSlam text={DENIAL.stamp} color="stamp" />

        <div className="mt-6 space-y-1 text-left text-[12px] uppercase tracking-wide text-navy">
          <p>
            {DENIAL.reasonPrefix} {reason ?? DENIAL.pendingPlaceholder}
          </p>
          <p>{DENIAL.status}</p>
          <p className="mt-3 text-[11px] text-navy/60">
            {DENIAL.caseLabel} {caseNumber ?? DENIAL.pendingPlaceholder}
          </p>
          <p className="text-[11px] text-navy/60">
            {DENIAL.dateLabel} {date ?? DENIAL.pendingPlaceholder}
          </p>
        </div>

        <div className="fingerprint-smudge mx-auto mt-6 h-16 w-16 rounded-full" aria-hidden />

        <div className={`mt-8 transition-opacity duration-500 ${showAppeal ? 'opacity-100' : 'opacity-0'}`}>
          <button
            type="button"
            disabled={!showAppeal}
            onClick={() => router.push('/identity')}
            className="min-h-11 text-[12px] font-bold uppercase tracking-wide text-navy underline underline-offset-4 disabled:pointer-events-none"
          >
            {DENIAL.appeal}
          </button>
        </div>
      </div>
      <Footer />
    </PageShell>
  )
}
