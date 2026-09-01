'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { RequireIdentity } from '@/components/RequireIdentity'
import { VISAS, VISA_SELECTION, FIANCE_HIGH_RISK } from '@/lib/content'
import { useApplication } from '@/lib/applicationContext'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

export default function VisaSelectionPage() {
  const router = useRouter()
  const { state, selectVisa, update } = useApplication()
  // The DATE VISA is not on offer for male applicants (owner decree) — the
  // card stays on the shelf, greyed out and unclickable.
  const dateUnavailable = state.gender === 'M'
  // Hesitation timer — started on mount (client-only, hydration-safe), read
  // at selection. Printed on the passport ONLY when they choose DATE.
  const mountedAtRef = useRef<number | null>(null)

  useEffect(() => {
    mountedAtRef.current = Date.now()
    addStamp('VISA SELECTION VIEWED')
  }, [])

  function select(slug: (typeof VISAS)[number]['slug']) {
    playBeep()
    // SERIAL № is generated exactly once (visa selection) rather than at
    // issuance, so it can appear on the progress card immediately — but a
    // repeated/back-navigated selection must NOT regenerate it. `selectVisa`
    // (see lib/applicationContext.tsx) is the one shared operation that
    // enforces this — see ApplicationState#serial and the sticker's
    // single-source note in lib/content.ts.
    selectVisa(slug)
    // DATE applicants get their hesitation immortalized; every other choice
    // clears any stale measurement from an earlier detour through this page.
    update({
      dateDecisionSeconds:
        slug === 'fiance' && mountedAtRef.current !== null
          ? (Date.now() - mountedAtRef.current) / 1000
          : null,
    })
    router.push(`/visa/${slug}`)
  }

  return (
    <RequireIdentity>
      <PageShell showProgress>
        <div className="paper-card p-5">
          <h1 className="text-center font-stamp text-xl uppercase tracking-wide text-navy">{VISA_SELECTION.heading}</h1>

          <div className="mt-5 flex flex-col gap-4">
            {VISAS.map((visa) => {
              const disabled = visa.slug === 'fiance' && dateUnavailable
              return (
              <button
                key={visa.slug}
                type="button"
                disabled={disabled}
                onClick={() => select(visa.slug)}
                className={`relative min-h-11 border-2 border-navy bg-paper p-4 text-left shadow-[3px_3px_0_rgba(26,42,74,0.15)] ${
                  disabled
                    ? 'pointer-events-none opacity-40 grayscale'
                    : 'transition-transform hover:-translate-y-0.5 hover:shadow-[5px_5px_0_rgba(26,42,74,0.2)] active:scale-[0.97]'
                }`}
              >
                {visa.slug === 'fiance' && (
                  <span className="absolute -right-2 -top-2 rotate-[10deg] border-2 border-stamp bg-paper px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-stamp">
                    {FIANCE_HIGH_RISK}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xl" aria-hidden>
                    {visa.icon}
                  </span>
                  <span className="font-stamp text-sm uppercase tracking-wide text-navy">{visa.name}</span>
                </div>
                {visa.tagline && (
                  <p className="mt-1 text-[11px] italic text-navy/70">&ldquo;{visa.tagline}&rdquo;</p>
                )}
                {visa.lines.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[10px] uppercase text-navy/50">
                    {visa.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </button>
              )
            })}
          </div>
        </div>
        <Footer />
      </PageShell>
    </RequireIdentity>
  )
}
