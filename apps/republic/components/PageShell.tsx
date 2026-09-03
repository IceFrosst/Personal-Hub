import { DocumentProgress } from './DocumentProgress'
import { HiddenBribe } from './HiddenBribe'

export function PageShell({
  children,
  fullHeight = false,
  showProgress = false,
}: {
  children: React.ReactNode
  /** Landing only: vertically centers content within the viewport instead of
   *  starting at the top — see app/page.tsx. Content that's genuinely taller
   *  than the viewport (e.g. the returning-applicant state's full final
   *  passport, once rendered) still scrolls normally; this never clips or
   *  hides overflow. */
  fullHeight?: boolean
  /** Every funnel page from /identity onward: the persistent mini visa/progress card. */
  showProgress?: boolean
}) {
  if (fullHeight) {
    return (
      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-3 px-4 py-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="w-full animate-paper-slide-in">{children}</div>
        <HiddenBribe />
      </main>
    )
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),1.5rem)]">
      {showProgress && <DocumentProgress />}
      <div className="w-full animate-paper-slide-in">{children}</div>
      {/* The spottable cash pile — on every page, so the applicant can screw
          up at any point in the funnel (see components/HiddenBribe.tsx). */}
      <HiddenBribe />
    </main>
  )
}
