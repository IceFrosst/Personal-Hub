'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApplication } from '@/lib/applicationContext'

// Shared guard for /visa and /visa/[type] — both require the applicant's
// NAME to already be in context (collected on /identity). Name only: the
// Instagram handle moved to its own /handle page AFTER visa selection and
// appointment booking, so requiring it here would make /visa permanently
// unreachable (an /identity ↔ /visa redirect loop — exactly the production
// bug this comment exists to prevent regressing). Same hydration-gated
// pattern as every other route guard in this app: never redirect (or
// render) before the context has finished reading sessionStorage, or a
// mid-funnel refresh would bounce a valid session to /identity before its
// real, persisted state has loaded.
export function RequireIdentity({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { state, hydrated } = useApplication()
  const hasIdentity = state.applicantName.trim().length > 0

  useEffect(() => {
    if (!hydrated) return
    if (!hasIdentity) router.replace('/identity')
  }, [hydrated, hasIdentity, router])

  if (!hydrated || !hasIdentity) return null
  return <>{children}</>
}
