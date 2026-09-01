'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { VisaType } from './content'
import type { VisitorIntel } from './intel'
import { generateSerial } from './referenceCode'
import {
  claimProviderHydration,
  EMPTY_STATE,
  mapSubmittedApplication,
  resolveRestoredThumbnail,
  type ApplicationState,
} from './applicationState'
import type { ApplicationRecord } from './api'
import {
  isCurrentDraft,
  newDraftId,
  recordDraftFieldChange,
  recordDraftIntel,
  recordDraftStarted,
} from './draftAudit'

// `ApplicationState` (and its default, `EMPTY_STATE`) live in the plain,
// non-JSX `./applicationState` module so they (and helpers derived from
// them, e.g. `isFreshApplicationState`) can be unit-tested directly with
// Node's `--experimental-strip-types` — see test/applicationState.test.mjs.
export type { ApplicationState }

const STORAGE_KEY = 'republic:application'

function hasSubmittedApplicationOnDevice(): boolean {
  try {
    const raw = window.localStorage.getItem('republic:applications-log')
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}

interface ApplicationContextValue {
  state: ApplicationState
  update: (patch: Partial<ApplicationState>) => void
  /**
   * The ONE shared operation that establishes a visa selection. Always sets
   * `visaType`, and — in the same state update — either preserves an
   * already-generated `serial` (repeated/back-navigated selection, or a
   * direct-linked /visa/[type] sub-step) or generates it exactly once
   * (first-ever selection). Every place that can set `visaType` (the /visa
   * selection cards and each visa-step sub-page's mount effect, for users who
   * deep-link straight into a sub-step) MUST go through this instead of
   * calling `update({ visaType: ... })` directly, so `visaType` and `serial`
   * can never become desynced — see lib/referenceCode.ts#generateSerial and
   * the SERIAL № lifecycle note on ApplicationState#serial below.
   */
  selectVisa: (visaType: VisaType) => void
  /** Records intel only when the caller's captured draft is still current. */
  recordIntel: (intel: VisitorIntel, expectedDraftId: string) => void
  /** Restores a completed local record without creating/auditing a draft. */
  restoreSubmittedApplication: (record: ApplicationRecord) => void
  reset: () => string | null
  hydrated: boolean
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null)

export function ApplicationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ApplicationState>(EMPTY_STATE)
  const stateRef = useRef<ApplicationState>(EMPTY_STATE)
  const hydrationStartedRef = useRef(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // Strict Mode replays passive effects but preserves refs for this provider
    // instance. Claim before any storage read or draft event so replay cannot
    // mint a second identity; a real remount gets a fresh ref and hydrates.
    if (!claimProviderHydration(hydrationStartedRef)) return
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      let parsed: ApplicationState = EMPTY_STATE
      if (raw) parsed = { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<ApplicationState>) }
      // A returning applicant is restored from localStorage by the landing
      // page. Do not mint/audit a throwaway draft before that restore happens.
      // All other fresh browsers get a new identity after mount.
      if (!parsed.draftId && !hasSubmittedApplicationOnDevice()) {
        const draftId = newDraftId()
        parsed = { ...parsed, draftId }
        if (draftId) recordDraftStarted(draftId)
      }
      stateRef.current = parsed
      setState(parsed)
    } catch {
      const hasSubmittedApplication = hasSubmittedApplicationOnDevice()
      const draftId = hasSubmittedApplication ? null : newDraftId()
      const parsed = { ...EMPTY_STATE, draftId }
      stateRef.current = parsed
      setState(parsed)
      if (draftId) recordDraftStarted(draftId)
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
    const prev = stateRef.current
    if (prev.draftId) {
      for (const [field, value] of Object.entries(patch)) {
        if (field in prev) recordDraftFieldChange(prev.draftId, field, prev[field as keyof ApplicationState], value)
      }
    }
    const next = { ...prev, ...patch }
    stateRef.current = next
    setState(next)
  }, [])

  const selectVisa = useCallback((visaType: VisaType) => {
    // Read from the synchronous ref (not a render closure) so rapid repeated
    // calls always see the just-set value, guaranteeing exact-once generation
    // regardless of render timing.
    const prev = stateRef.current
    if (prev.draftId) recordDraftFieldChange(prev.draftId, 'visaType', prev.visaType, visaType)
    const next = { ...prev, visaType, serial: prev.serial ?? generateSerial() }
    stateRef.current = next
    setState(next)
  }, [])

  const recordIntel = useCallback((intel: VisitorIntel, expectedDraftId: string) => {
    const prev = stateRef.current
    if (!isCurrentDraft(prev.draftId, expectedDraftId)) return
    recordDraftIntel(expectedDraftId, intel)
    const next = { ...prev, intel }
    stateRef.current = next
    setState(next)
  }, [])

  const restoreSubmittedApplication = useCallback((record: ApplicationRecord) => {
    const restored = mapSubmittedApplication(record)
    // A thumbnail is safe session state and may survive alongside an expired
    // full-resolution capture, but only for the exact same application this
    // tab already had open — see resolveRestoredThumbnail. Any mismatch or
    // missing reference code drops the thumbnail entirely so /visa-issued
    // falls back to its "PHOTO ON FILE" placeholder rather than ever risking
    // showing the wrong photo. The local completed log intentionally has no
    // raw/private photo to fetch or restore.
    restored.selfieThumbnailUrl = resolveRestoredThumbnail(
      stateRef.current.referenceCode,
      stateRef.current.selfieThumbnailUrl,
      record.referenceCode
    )
    stateRef.current = restored
    setState(restored)
  }, [])

  const reset = useCallback(() => {
    const draftId = newDraftId()
    const next = { ...EMPTY_STATE, draftId }
    stateRef.current = next
    setState(next)
    if (draftId) recordDraftStarted(draftId)
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    return draftId
  }, [])

  const value = useMemo(
    () => ({ state, update, selectVisa, recordIntel, restoreSubmittedApplication, reset, hydrated }),
    [state, update, selectVisa, recordIntel, restoreSubmittedApplication, reset, hydrated]
  )

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>
}

export function useApplication(): ApplicationContextValue {
  const ctx = useContext(ApplicationContext)
  if (!ctx) throw new Error('useApplication must be used within ApplicationProvider')
  return ctx
}
