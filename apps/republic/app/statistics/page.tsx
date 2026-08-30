'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import {
  STATISTICS_HEADING,
  STATISTICS_SUBHEADING,
  STATISTICS_BRIBE_LABEL,
  STATISTICS_ROWS,
  STATISTICS_NOTE,
  STATISTICS_BRIBE_BASE,
  RETURN_TO_BORDER_CONTROL,
} from '@/lib/content'
import { getBribeCount } from '@/lib/api'

export default function StatisticsPage() {
  const [bribes, setBribes] = useState(STATISTICS_BRIBE_BASE)

  useEffect(() => {
    setBribes(STATISTICS_BRIBE_BASE + getBribeCount())
  }, [])

  const rows = [...STATISTICS_ROWS, { label: STATISTICS_BRIBE_LABEL, value: String(bribes) }]

  return (
    <PageShell>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{STATISTICS_HEADING}</h1>
        <p className="mt-1 text-center text-[10px] uppercase text-navy/50">{STATISTICS_SUBHEADING}</p>

        <table className="mt-4 w-full border-collapse text-[12px]">
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? 'bg-navy/5' : ''}>
                <td className="border border-navy/30 px-2 py-2 uppercase text-navy">{row.label}</td>
                <td className="border border-navy/30 px-2 py-2 text-right font-bold text-navy">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 text-[10px] uppercase leading-relaxed text-navy/50">{STATISTICS_NOTE}</p>

        <Link
          href="/"
          className="mt-6 block min-h-11 w-full border-2 border-navy bg-paper py-3 text-center font-stamp text-sm uppercase tracking-widest text-navy transition-colors hover:bg-navy hover:text-paper"
        >
          {RETURN_TO_BORDER_CONTROL}
        </Link>
      </div>
      <Footer />
    </PageShell>
  )
}
