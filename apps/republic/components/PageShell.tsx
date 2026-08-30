export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <div className="w-full animate-paper-slide-in">{children}</div>
    </main>
  )
}
