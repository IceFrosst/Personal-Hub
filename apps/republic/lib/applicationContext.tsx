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
  selfieDataUrl: string | null
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
    try {
      // Don't persist the selfie across reloads — keep sessionStorage light and
      // avoid stale photos lingering; the composite step handles it live.
      const rest: Partial<ApplicationState> = { ...state }
      delete rest.selfieDataUrl
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    } catch {
      // ignore quota errors
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
