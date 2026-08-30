'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApplication } from '@/lib/applicationContext'

// Shared guard for /visa and /visa/[type] — both now require identity (name +
// Instagram handle) to already be in context, since landing no longer
// collects it. Same hydration-gated pattern as every other route guard in
// this app: never redirect (or render) before the context has finished
// reading sessionStorage, or a mid-funnel refresh would bounce a valid
// session to /identity before its real, persisted state has loaded.
export function RequireIdentity({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { state, hydrated } = useApplication()
  const hasIdentity = state.applicantName.trim().length > 0 && state.instagramHandle.trim().length > 0

  useEffect(() => {
    if (!hydrated) return
    if (!hasIdentity) router.replace('/identity')
  }, [hydrated, hasIdentity, router])

  if (!hydrated || !hasIdentity) return null
  return <>{children}</>
}
