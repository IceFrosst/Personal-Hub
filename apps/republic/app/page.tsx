'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crest } from '@/components/Crest'
import { Footer } from '@/components/Footer'
import { OfficerMoodBadge } from '@/components/OfficerMoodBadge'
import { PageShell } from '@/components/PageShell'
import { Typewriter } from '@/components/Typewriter'
import { addStamp } from '@/lib/passport'
import { getApplicantNumber, getLastApplication, type ApplicationRecord } from '@/lib/api'
import { collectIntel } from '@/lib/intel'
import { isFreshApplicationState } from '@/lib/applicationState'
import { clearAnimatedFields } from '@/lib/formProgress'
import {
  APPLICATION_STATUS_COPY,
  GENDER_OPTIONS,
  LANDING,
  PENDING_LANDING,
  SCREENING_QUESTIONS,
  VISA_BY_SLUG,
  formatApplicantNumber,
  type ScreeningQuestion,
  type VisaType,
} from '@/lib/content'
import { playStampThunk } from '@/lib/sound'
import { useApplication } from '@/lib/applicationContext'
import { useApplicationStatus } from '@/lib/useApplicationStatus'

export default function EntryDeclarationPage() {
  const router = useRouter()
  const { state, update, recordIntel, restoreSubmittedApplication, reset, hydrated } = useApplication()
  // The applicant number is fetched from a Supabase RPC (or read from a
  // localStorage cache if this browser already has one) — never read/set
  // synchronously during render, since this page is statically prerendered
  // and the server always sees an empty/default environment. It starts
  // `null` and is only ever populated inside the effect below, after mount.
  const [showQuestion, setShowQuestion] = useState(false)
  const [applicantNumber, setApplicantNumber] = useState<number | null>(null)
  // The absurd follow-up drawn after a YES declaration — null until then.
  // Guaranteed for every applicant (owner request: 100% occurrence), one of
  // SCREENING_QUESTIONS at random; the answer prints on the passport via
  // lib/visaAddendum.ts#getScreeningAddenda.
  const [followUp, setFollowUp] = useState<ScreeningQuestion | null>(null)
  // 'pending' (returning applicant card) or 'declare' → 'followUp' →
  // 'gender' → /identity. Gender lands on the passport's SEX field.
  const [stage, setStage] = useState<'declare' | 'followUp' | 'gender' | 'pending'>('declare')
  // The most recent application THIS DEVICE submitted (localStorage log) —
  // read only inside the mount effect (hydration safety).
  const [pendingApp, setPendingApp] = useState<ApplicationRecord | null>(null)
  // Bumped on every application start (mount + SUBMIT ANOTHER). Async intel
  // collection captures the value at kickoff and only commits if it's still
  // current — so a slow collection from a previous application can never
  // populate a newer one started via SUBMIT ANOTHER.
  const applicationGenRef = useRef(0)
  // Top-right corner toggle — pure theater, changes nothing downstream.
  const [priority, setPriority] = useState(true)

  // Kicks off the officer-eyes-only intel probe for `draftId` and shows the
  // declare screen. Shared by `beginNewApplication` (which first calls
  // `reset()` to mint a brand-new draft) and the mount effect's "reuse the
  // draft the provider's hydration effect just created" branch below, which
  // deliberately does NOT call `reset()` again — see that branch's comment.
  function activateDraft(draftId: string | null) {
    clearAnimatedFields()
    addStamp('ENTRY DECLARATION VIEWED')
    // Officer-eyes-only visitor intel (IP/geo/battery/connection/referrer) —
    // gathered here because document.referrer is only meaningful on the
    // entry page. Best-effort and async; the funnel never waits for it, and
    // a generation guard ensures a slow collection from a superseded
    // application never lands on the next one.
    const generation = (applicationGenRef.current += 1)
    void collectIntel().then(
      (intel) => {
        if (applicationGenRef.current === generation && draftId) recordIntel(intel, draftId)
      },
      () => {
        // Intel is best-effort; a failed probe must never surface as an
        // unhandled rejection or interrupt the application funnel.
      }
    )
    setStage('declare')
  }

  // Restarts the funnel: identity and duty-free purchases survive, the
  // application itself resets (a brand-new draftId is minted). Called by the
  // SUBMIT ANOTHER APPLICATION button, and by the mount effect below for any
  // mount that isn't a genuinely fresh, still-empty draft (see the
  // `isFreshApplicationState` branch there for that narrower case).
  function beginNewApplication() {
    // Leaving the returning-applicant card also cancels its status lookup;
    // the new funnel must not keep polling the previous reference.
    setPendingApp(null)
    const preservedName = state.applicantName
    const preservedHandle = state.instagramHandle
    const preservedDutyFreeItems = state.dutyFreeItems
    const draftId = reset()
    if (preservedName) update({ applicantName: preservedName })
    if (preservedHandle) update({ instagramHandle: preservedHandle })
    if (preservedDutyFreeItems.length) update({ dutyFreeItems: preservedDutyFreeItems })
    activateDraft(draftId)
  }

  const remoteStatus = useApplicationStatus(pendingApp?.referenceCode, pendingApp?.instagramHandle)
  const decisionStatus = remoteStatus?.status ?? 'pending'
  const statusCopy = APPLICATION_STATUS_COPY[decisionStatus]
  const statusTone =
    decisionStatus === 'approved'
      ? 'border-approve/60 text-approve'
      : decisionStatus === 'denied'
        ? 'border-stamp/60 text-stamp'
        : 'border-[#d97706]/60 text-[#d97706]'

  useEffect(() => {
    // `ApplicationProvider`'s own hydration effect (reading sessionStorage,
    // minting a draftId if none existed yet) runs in a *child-before-parent*
    // order relative to this one, so on the very first paint of the whole
    // app it hadn't necessarily finished the first time this effect used to
    // fire unconditionally on mount — racing it and sometimes clobbering
    // whatever `beginNewApplication` had just set (including the draftId
    // `recordIntel` was about to use), or minting two `draft_started` events
    // for one visit. Waiting for `hydrated` (re-running this effect exactly
    // once, when it flips false → true) removes the race entirely: the
    // provider's persisted-or-fresh state is always settled before landing
    // ever reads or resets it.
    if (!hydrated) return
    // Returning applicant? (This device already submitted at least one
    // application — localStorage log.) Show the pending-review card instead
    // of restarting the funnel; a new application is one tap away.
    const last = getLastApplication()
    if (last) {
      setPendingApp(last)
      setStage('pending')
    } else if (isFreshApplicationState(state)) {
      // The provider's hydration effect already minted a brand-new draftId
      // for this genuinely first-ever visit (no prior sessionStorage) and
      // recorded its own draft_started event — reuse that draft instead of
      // calling `beginNewApplication` (which would call `reset()` again,
      // discard it, and fire a second, redundant draft_started for the same
      // funnel). A mid-session revisit to `/` with real accumulated state
      // still goes through the `beginNewApplication` `else` branch below,
      // which genuinely does need a fresh draft.
      activateDraft(state.draftId)
    } else {
      beginNewApplication()
    }
    // Async: resolves from the localStorage cache instantly if this browser
    // already has a number, otherwise awaits the Supabase RPC. On failure it
    // resolves to null and the placeholder just stays put — no fake number
    // is ever generated locally (see lib/api.ts#getApplicantNumber).
    getApplicantNumber().then(setApplicantNumber)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  function handleAnswer(answer: 'yes' | 'no') {
    playStampThunk()
    if (answer === 'no') {
      // Nothing to declare — no reason line on /denied, just the
      // wasting-officer's-time STATUS (see app/denied/page.tsx).
      router.push('/denied?via=nothing')
      return
    }
    // Declaring something triggers immediate follow-up questioning — the
    // officer needs details. Navigation waits for the answers below.
    setFollowUp(SCREENING_QUESTIONS[Math.floor(Math.random() * SCREENING_QUESTIONS.length)])
    setStage('followUp')
  }

  function answerFollowUp(option: string) {
    if (!followUp) return
    playStampThunk()
    update({ screeningQuestion: followUp.question, screeningAnswer: option })
    addStamp('FOLLOW-UP QUESTIONING CLEARED')
    setStage('gender')
  }

  function answerGender(value: string) {
    playStampThunk()
    // CLASSIFIED is a trap, same mechanic as the bribe: immediate denial
    // with its own printed reason. Nothing is stored — the landing reset
    // wipes gender anyway when they come crawling back through the appeal.
    if (value === 'X') {
      router.push('/denied?via=classified')
      return
    }
    update({ gender: value })
    router.push('/identity')
  }

  return (
    <PageShell fullHeight>
      <div className="paper-card relative p-4">
        {/* Applicant № — top-LEFT corner of the card (owner request; it used
            to be a centered line under the divider — that spot is kept as
            empty space, see the spacer below). */}
        <p className="absolute left-2 top-2 text-[9px] uppercase tracking-wide text-navy/60">
          {LANDING.applicantNumberPrefix}{' '}
          {applicantNumber !== null ? formatApplicantNumber(applicantNumber) : LANDING.applicantNumberPlaceholder}
        </p>
        {/* PRIORITY ↔ NON-PRIORITY toggle stamp — top-right corner. A real
            button (was a static decoration), but the choice is pure theater
            and changes nothing downstream. */}
        <button
          type="button"
          onClick={() => setPriority((p) => !p)}
          aria-pressed={priority}
          className={`absolute right-2 top-2 rotate-[8deg] border-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors ${
            priority ? 'border-stamp text-stamp' : 'border-navy/50 text-navy/50'
          }`}
        >
          {priority ? LANDING.priorityStamp : LANDING.nonPriorityStamp}
        </button>

        <div className="flex flex-col items-center gap-1">
          <Crest className="h-10 w-10" />
          <h1 className="font-stamp text-lg uppercase tracking-wide text-navy">{LANDING.title}</h1>
          <p className="text-[10px] uppercase tracking-[0.25em] text-navy/70">{LANDING.subtitle}</p>
        </div>

        <div className="my-2 h-px bg-navy/30" />

        {/* The applicant-№ line moved to the card's top-left corner; its old
            spot deliberately stays as equivalent empty space (owner request). */}
        <div className="mt-0.5 h-[15px]" aria-hidden />

        {stage === 'pending' && pendingApp ? (
          <div className="animate-fade-in mt-3">
            <p className={`text-center font-stamp text-base uppercase tracking-wide ${statusTone}`}>
              {statusCopy.landingHeading}
            </p>
            <div className={`mx-auto mt-3 w-fit border-2 bg-paper-dark px-4 py-2 text-left text-[11px] uppercase tracking-wide text-navy ${statusTone}`}>
              <p>
                {PENDING_LANDING.referenceLabel} <span className="font-bold">{pendingApp.referenceCode}</span>
              </p>
              <p>
                {PENDING_LANDING.visaLabel}{' '}
                <span className="font-bold">
                  {VISA_BY_SLUG[pendingApp.visaType as VisaType]?.name ?? pendingApp.visaType.toUpperCase()}
                </span>
              </p>
              <p className={`mt-1 font-bold ${statusTone}`}>{statusCopy.landingStatus}</p>
            </div>
            <p className="mt-2 text-center text-[10px] uppercase text-navy/60">{statusCopy.landingNote}</p>
            <button
              type="button"
              onClick={() => {
                playStampThunk()
                restoreSubmittedApplication(pendingApp)
                router.push('/visa-issued')
              }}
              className="mt-3 min-h-11 w-full border-2 border-approve bg-approve py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97]"
            >
              {PENDING_LANDING.viewFinalApplication}
            </button>
            <button
              type="button"
              onClick={() => {
                playStampThunk()
                beginNewApplication()
              }}
              className="mt-2 min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-all hover:opacity-90 active:scale-[0.97]"
            >
              {PENDING_LANDING.submitAnother}
            </button>
          </div>
        ) : stage === 'declare' ? (
          <>
            <div className="mt-3 min-h-[3rem] text-center">
              <Typewriter
                text={LANDING.question}
                className="font-stamp text-base uppercase tracking-wide text-navy"
                onDone={() => setShowQuestion(true)}
              />
            </div>

            <div
              className={`mt-3 grid grid-cols-2 gap-4 transition-opacity duration-300 ${showQuestion ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            >
              <button
                type="button"
                onClick={() => handleAnswer('yes')}
                className="min-h-11 border-2 border-approve bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-approve transition-all hover:bg-approve hover:text-paper active:scale-[0.97]"
              >
                {LANDING.yes}
              </button>
              <button
                type="button"
                onClick={() => handleAnswer('no')}
                className="min-h-11 border-2 border-stamp bg-paper py-3 font-stamp text-lg uppercase tracking-widest text-stamp transition-all hover:bg-stamp hover:text-paper active:scale-[0.97]"
              >
                {LANDING.no}
              </button>
            </div>
          </>
        ) : stage === 'followUp' && followUp ? (
          <div className="animate-fade-in mt-3">
            {/* ~10% larger than the old text-sm (14px → 15px), owner request. */}
            <p className="text-center font-stamp text-[15px] uppercase leading-relaxed tracking-wide text-navy">
              {followUp.question}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {followUp.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => answerFollowUp(option)}
                  className="min-h-11 border-2 border-navy/40 px-3 py-2 text-left text-[12px] uppercase tracking-wide text-navy transition-all hover:border-approve hover:bg-approve hover:text-paper active:scale-[0.97]"
                >
                  <span className="font-stamp">{option}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-fade-in mt-3">
            <p className="text-center font-stamp text-sm uppercase leading-relaxed tracking-wide text-navy">
              {LANDING.genderQuestion}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => answerGender(option.value)}
                  className="min-h-11 border-2 border-navy/40 px-3 py-2 text-left text-[12px] uppercase tracking-wide text-navy transition-all hover:border-approve hover:bg-approve hover:text-paper active:scale-[0.97]"
                >
                  <span className="font-stamp">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col items-center">
        <OfficerMoodBadge />
      </div>

      <Footer compact />
    </PageShell>
  )
}
