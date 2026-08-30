import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { TERMS_HEADING, TERMS_SUBHEADING, TERMS_PARAGRAPHS, RETURN_TO_BORDER_CONTROL } from '@/lib/content'

export default function TermsPage() {
  return (
    <PageShell>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{TERMS_HEADING}</h1>
        <p className="mt-1 text-center text-[10px] uppercase text-navy/50">{TERMS_SUBHEADING}</p>

        <ol className="mt-4 flex flex-col gap-3 text-[12px] leading-relaxed text-navy">
          {TERMS_PARAGRAPHS.map((paragraph, i) => (
            <li key={paragraph} className={i === 6 ? 'border-2 border-stamp p-2 text-stamp' : ''}>
              {paragraph}
            </li>
          ))}
        </ol>

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
