import Link from 'next/link'
import { FOOTER, FOOTER_NAV } from '@/lib/content'

export function Footer({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={
        compact
          ? 'relative z-10 mt-2 border-t-2 border-navy/20 px-2 py-1.5 text-center text-[9px] leading-snug text-navy/70'
          : 'relative z-10 mt-10 border-t-2 border-navy/20 px-4 py-6 text-center text-[11px] leading-relaxed text-navy/70'
      }
    >
      <p>{FOOTER}</p>
      <nav className={compact ? 'mt-0.5 flex flex-wrap justify-center gap-x-2 gap-y-0.5 uppercase tracking-wide' : 'mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 uppercase tracking-wide'}>
        <Link href="/duty-free" className="underline underline-offset-2 hover:text-navy">
          {FOOTER_NAV.dutyFree}
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="underline underline-offset-2 hover:text-navy">
          {FOOTER_NAV.terms}
        </Link>
      </nav>
    </footer>
  )
}
