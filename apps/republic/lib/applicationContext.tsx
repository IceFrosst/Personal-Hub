'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { VisaType } from './content'
import { generateSerial } from './referenceCode'

export interface ApplicationState {
  applicantName: string
  instagramHandle: string
  visaType: VisaType | null
  /** The sidequest (tourist) visa's "WHAT'S THE IDEA?" answer. */
  sidequestIdea: string
  /** Declared expedition supplies (sidequest) — all four earns the FULLY EQUIPPED stamp. */
  sidequestSupplies: string[]
  /** True once the supply declaration screen was submitted (even with zero
   *  boxes checked) — distinguishes "declared nothing" from "not asked yet"
   *  so the forward-lock can't re-ask. */
  sidequestSuppliesDeclared: boolean
  /** The special visa's "HOW OTHER IS YOUR PURPOSE?" selection. */
  specialOtherness: string
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
  /** Secondary-screening absurd question drawn for this session — persisted
   *  so a refresh mid-screening doesn't re-roll the rotation (see
   *  app/screening/page.tsx and lib/content.ts#SCREENING_QUESTIONS). */
  screeningQuestion: string | null
  /** The chosen answer to the screening question above. */
  screeningAnswer: string | null
  /** Self-declared IQ from the bell-curve slider — never verified, obviously. */
  declaredIq: number | null
  /** DATE path only: self-declared confidence (raw; the passport prints it 15% lower). */
  declaredConfidence: number | null
  /** Seconds spent staring at /visa before picking — printed only for the DATE path. */
  dateDecisionSeconds: number | null
  /** Available duty-free items the applicant clicked; printed as one passport addendum. */
  dutyFreeItems: string[]
  /** Passport SEX field value ('M' / 'F' / 'X') from the landing gender question. */
  gender: string | null
  referenceCode: string | null
  /** Visa sticker SERIAL № — generated exactly once, on the FIRST visa
   *  selection (see lib/referenceCode.ts#generateSerial), and preserved
   *  across any later re-selection (returning to /visa and picking again, or
   *  a direct link into a visa-step sub-page) so the progress card and the
   *  final /visa-issued sticker always render the identical value. Only ever
   *  set together with `visaType`, through the shared `selectVisa` operation
   *  below — never set directly via `update`. */
  serial: string | null
  /** Visa sticker ISSUED date — filled once the appointment slot is
   *  confirmed (see lib/content.ts#formatIssuedDate) so it survives a refresh
   *  and matches whatever /visa-issued renders later in the same session. */
  issuedDate: string | null
}

const EMPTY_STATE: ApplicationState = {
  applicantName: '',
  instagramHandle: '',
  visaType: null,
  sidequestIdea: '',
  sidequestSupplies: [],
  sidequestSuppliesDeclared: false,
  specialOtherness: '',
  fianceAnswers: [],
  businessPitch: '',
  specialStatement: '',
  slot: null,
  selfieDataUrl: null,
  selfieCaptured: false,
  selfieThumbnailUrl: null,
  screeningQuestion: null,
  screeningAnswer: null,
  declaredIq: null,
  declaredConfidence: null,
  dateDecisionSeconds: null,
  dutyFreeItems: [],
  gender: null,
  referenceCode: null,
  serial: null,
  issuedDate: null,
}

const STORAGE_KEY = 'republic:application'

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

  const selectVisa = useCallback((visaType: VisaType) => {
    // Reads `prev.serial` inside the updater (not the `state` closure) so a
    // rapid repeated call always sees the just-set value, guaranteeing
    // exact-once generation regardless of render timing.
    setState((prev) => ({ ...prev, visaType, serial: prev.serial ?? generateSerial() }))
  }, [])

  const reset = useCallback(() => {
    setState(EMPTY_STATE)
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo(
    () => ({ state, update, selectVisa, reset, hydrated }),
    [state, update, selectVisa, reset, hydrated]
  )

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>
}

export function useApplication(): ApplicationContextValue {
  const ctx = useContext(ApplicationContext)
  if (!ctx) throw new Error('useApplication must be used within ApplicationProvider')
  return ctx
}
