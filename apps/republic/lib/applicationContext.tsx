'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { VisaType } from './content'

export interface ApplicationState {
  applicantName: string
  instagramHandle: string
  visaType: VisaType | null
  consultationMatter: string
  fianceAnswers: string[]
  businessPitch: string
  specialStatement: string
  slot: string | null
  /** Full-resolution capture — deliberately never persisted, see below. */
  selfieDataUrl: string | null
  /** Persisted flag: survives a refresh even after selfieDataUrl is stripped. */
  selfieCaptured: boolean
  /** Persisted small (~200px JPEG) fallback so the visa sticker can still be
   *  reconstructed after a refresh loses the full-resolution capture. */
  selfieThumbnailUrl: string | null
  referenceCode: string | null
}

const EMPTY_STATE: ApplicationState = {
  applicantName: '',
  instagramHandle: '',
  visaType: null,
  consultationMatter: '',
  fianceAnswers: [],
  businessPitch: '',
  specialStatement: '',
  slot: null,
  selfieDataUrl: null,
  selfieCaptured: false,
  selfieThumbnailUrl: null,
  referenceCode: null,
}

const STORAGE_KEY = 'republic:application'

interface ApplicationContextValue {
  state: ApplicationState
  update: (patch: Partial<ApplicationState>) => void
  reset: () => void
  hydrated: boolean
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null)

export function ApplicationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ApplicationState>(EMPTY_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      if (raw) setState({ ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<ApplicationState>) })
    } catch {
      // ignore corrupt storage
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // Don't persist the full-resolution selfie across reloads — keep
    // sessionStorage light and avoid a large stale photo lingering; the
    // composite step handles it live. `selfieCaptured` (a boolean) and
    // `selfieThumbnailUrl` (a small ~200px JPEG, a few KB) DO persist, so
    // biometrics/approval state and the visa sticker's photo both survive a
    // refresh even once the full-res capture is gone — see
    // app/visa-issued/page.tsx and components/DocumentProgress.tsx.
    const rest: Partial<ApplicationState> = { ...state }
    delete rest.selfieDataUrl
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    } catch {
      // Quota exceeded (or any other write failure) — the thumbnail is by far
      // the largest field left, so it's the most likely culprit. Retry once
      // without it so essential state (selfieCaptured, referenceCode,
      // identity, visa progress, etc.) always survives a refresh rather than
      // giving up on the whole write — /visa-issued already falls back to the
      // "PHOTO ON FILE" placeholder frame when the thumbnail is absent, so
      // losing just this field costs nothing functionally, only visually.
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...rest, selfieThumbnailUrl: null }))
      } catch {
        // Retry also failed (storage disabled entirely, or truly out of
        // room even for the essentials) — give up silently, same as before.
      }
    }
  }, [state, hydrated])

  const update = useCallback((patch: Partial<ApplicationState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setState(EMPTY_STATE)
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo(() => ({ state, update, reset, hydrated }), [state, update, reset, hydrated])

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>
}

export function useApplication(): ApplicationContextValue {
  const ctx = useContext(ApplicationContext)
  if (!ctx) throw new Error('useApplication must be used within ApplicationProvider')
  return ctx
}
