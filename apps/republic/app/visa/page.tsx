'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { VISAS, VISA_SELECTION, FIANCE_HIGH_RISK } from '@/lib/content'
import { useApplication } from '@/lib/applicationContext'
import { addStamp } from '@/lib/passport'
import { playBeep } from '@/lib/sound'

export default function VisaSelectionPage() {
  const router = useRouter()
  const { update } = useApplication()

  useEffect(() => {
    addStamp('VISA SELECTION VIEWED')
  }, [])

  function select(slug: (typeof VISAS)[number]['slug']) {
    playBeep()
    update({ visaType: slug })
    router.push(`/visa/${slug}`)
  }

  return (
    <PageShell>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-xl uppercase tracking-wide text-navy">{VISA_SELECTION.heading}</h1>
        <p className="mt-1 text-center text-[11px] uppercase text-navy/60">{VISA_SELECTION.sub}</p>

        <div className="mt-5 flex flex-col gap-4">
          {VISAS.map((visa) => (
            <button
              key={visa.slug}
              type="button"
              onClick={() => select(visa.slug)}
              className="relative min-h-11 border-2 border-navy bg-paper p-4 text-left shadow-[3px_3px_0_rgba(26,42,74,0.15)] transition-transform hover:-translate-y-0.5 hover:shadow-[5px_5px_0_rgba(26,42,74,0.2)]"
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
              <p className="mt-1 text-[11px] italic text-navy/70">&ldquo;{visa.tagline}&rdquo;</p>
              <ul className="mt-2 space-y-0.5 text-[10px] uppercase text-navy/50">
                {visa.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="barcode mt-2 h-3" aria-hidden />
            </button>
          ))}
        </div>
      </div>
      <Footer />
    </PageShell>
  )
}
