import Link from 'next/link'
import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import { DUTY_FREE_HEADING, DUTY_FREE_SUBHEADING, DUTY_FREE_ITEMS, RETURN_TO_BORDER_CONTROL } from '@/lib/content'

export default function DutyFreePage() {
  return (
    <PageShell>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{DUTY_FREE_HEADING}</h1>
        <p className="mt-1 text-center text-[10px] uppercase text-navy/50">{DUTY_FREE_SUBHEADING}</p>

        <ul className="mt-4 flex flex-col gap-2">
          {DUTY_FREE_ITEMS.map((item) => (
            <li
              key={item.name}
              className="flex items-center justify-between border-2 border-navy/30 bg-paper px-3 py-2 text-[11px] uppercase text-navy"
            >
              <span>{item.name}</span>
              <span className="ml-3 shrink-0 font-bold text-stamp">{item.status}</span>
            </li>
          ))}
        </ul>

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
