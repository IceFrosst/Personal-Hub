'use client'

import { useEffect, useRef, useState } from 'react'
import { getApplicationStatus, type ApplicationStatus } from './api'

const POLL_INTERVAL_MS = 7_000

/**
 * Best-effort live decision polling for an anonymous application. The initial
 * state deliberately matches the server render; browser events and timers are
 * installed only after hydration. A terminal decision stops polling, while a
 * focus/visibility return performs an immediate check for an applicant who
 * has left the page open.
 */
export function useApplicationStatus(
  referenceCode: string | null | undefined,
  instagramHandle: string | null | undefined
): ApplicationStatus | null {
  const [status, setStatus] = useState<ApplicationStatus | null>(null)
  const statusRef = useRef<ApplicationStatus | null>(null)

  useEffect(() => {
    setStatus(null)
    statusRef.current = null
    if (!referenceCode || !instagramHandle) return

    let active = true
    let requestId = 0
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const isTerminal = () => {
      const value = statusRef.current?.status
      return value === 'approved' || value === 'denied'
    }

    const schedule = () => {
      if (!active || isTerminal()) return
      timer = setTimeout(() => {
        timer = null
        void check()
      }, POLL_INTERVAL_MS)
    }

    const check = async () => {
      if (!active || isTerminal()) return
      controller?.abort()
      controller = new AbortController()
      const currentRequest = ++requestId
      const result = await getApplicationStatus(referenceCode, instagramHandle, controller.signal)
      if (!active || currentRequest !== requestId || !result) {
        if (active && currentRequest === requestId) schedule()
        return
      }
      statusRef.current = result
      setStatus(result)
      if (!isTerminal()) schedule()
    }

    const checkNow = () => {
      if (document.visibilityState === 'hidden' || isTerminal()) return
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      void check()
    }

    document.addEventListener('visibilitychange', checkNow)
    window.addEventListener('focus', checkNow)
    void check()

    return () => {
      active = false
      requestId += 1
      controller?.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', checkNow)
      window.removeEventListener('focus', checkNow)
    }
  }, [referenceCode, instagramHandle])

  return status
}
