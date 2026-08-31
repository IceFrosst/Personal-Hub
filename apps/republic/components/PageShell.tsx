import { DocumentProgress } from './DocumentProgress'

export function PageShell({
  children,
  fullHeight = false,
  showProgress = false,
}: {
  children: React.ReactNode
  /** Landing only: fits entirely within one viewport, no scroll — see app/page.tsx. */
  fullHeight?: boolean
  /** Every funnel page from /identity onward: the persistent mini visa/progress card. */
  showProgress?: boolean
}) {
  if (fullHeight) {
    return (
      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center gap-3 px-4 py-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="w-full animate-paper-slide-in">{children}</div>
      </main>
    )
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),1.5rem)]">
      {showProgress && <DocumentProgress />}
      <div className="w-full animate-paper-slide-in">{children}</div>
    </main>
  )
}
