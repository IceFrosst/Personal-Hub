'use client'

import { IconBrandGoogle } from '@tabler/icons-react'
import CookieJarLogo from './CookieJarLogo'

export default function SignInLanding({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main
      className="flex flex-col items-center justify-center px-6 text-center min-h-[100dvh]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <CookieJarLogo size={72} />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-text">Cookie Jar</h1>
      <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-text-muted">
        Bank the hard things you&apos;ve already conquered. When you&apos;re hurting,
        reach in and pull one out.
      </p>

      <button
        type="button"
        onClick={onSignIn}
        className="mt-8 flex min-h-12 items-center gap-2.5 rounded-md bg-surface-elevated px-6 font-medium text-text transition-colors active:bg-border"
      >
        <IconBrandGoogle size={18} stroke={2} />
        Sign in with Google
      </button>
    </main>
  )
}
