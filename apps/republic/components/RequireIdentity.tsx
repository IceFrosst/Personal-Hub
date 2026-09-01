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
  // Gender is asked on the landing questionnaire (after the follow-up
  // question) and printed as the passport's SEX field — a session that
  // somehow reaches visa selection without it (e.g. an old session, or a
  // deep link) is sent back to the landing to answer, not to /identity
  // (which never asks it). The landing preserves the name across its reset,
  // so nothing gets re-typed — only re-answered.
  const hasGender = Boolean(state.gender)

  useEffect(() => {
    if (!hydrated) return
    if (!hasGender) {
      router.replace('/')
      return
    }
    if (!hasIdentity) router.replace('/identity')
  }, [hydrated, hasIdentity, hasGender, router])

  if (!hydrated || !hasIdentity || !hasGender) return null
  return <>{children}</>
}
