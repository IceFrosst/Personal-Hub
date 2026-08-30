import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { NOT_FOUND } from '@/lib/content'

export default function NotFound() {
  return (
    <PageShell>
      <div className="paper-card p-6 text-center">
        <h1 className="font-stamp text-xl uppercase tracking-wide text-stamp">{NOT_FOUND.title}</h1>
        <p className="mt-2 text-[11px] uppercase tracking-wide text-navy/70">{NOT_FOUND.sub}</p>
        <Link
          href="/"
          className="mt-6 block min-h-11 w-full border-2 border-navy bg-navy py-3 text-center font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
        >
          {NOT_FOUND.home}
        </Link>
      </div>
      <Footer />
    </PageShell>
  )
}
