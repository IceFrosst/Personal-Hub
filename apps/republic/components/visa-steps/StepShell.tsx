import { PageShell } from '@/components/PageShell'
import { Footer } from '@/components/Footer'
import type { VisaDefinition } from '@/lib/content'

export function StepShell({ visa, children }: { visa: VisaDefinition; children: React.ReactNode }) {
  return (
    <PageShell showProgress>
      <div className="paper-card p-5">
        <div className="flex items-center justify-center gap-2 text-center">
          <span className="text-xl" aria-hidden>
            {visa.icon}
          </span>
          <h1 className="font-stamp text-lg uppercase tracking-wide text-navy">{visa.name}</h1>
        </div>
        {visa.badge && (
          <span
            className={`mx-auto mt-2 block w-fit whitespace-nowrap rotate-[6deg] border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
              visa.badgeTone === 'approve' ? 'border-approve text-approve' : 'border-stamp text-stamp'
            }`}
          >
            {visa.badge}
          </span>
        )}
        <div className="my-3 h-px bg-navy/20" />
        {children}
      </div>
      <Footer />
    </PageShell>
  )
}
