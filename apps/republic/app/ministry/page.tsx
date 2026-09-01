'use client'

// The hidden Ministry desk — Ignas reviews and decides applications here.
// Access model: Google OAuth via the shared portfolio Supabase project;
// RLS (migration 0004) only lets the ministry email SELECT/UPDATE
// republic.applications — any other signed-in account just sees an
// access-denied error from the very first query. Visitors remain write-only.
// No public page links here — it's an unlisted route.
//
// Each pending application renders as the SAME passport document the
// applicant sees (shared VisaDocument + the same formatting helpers), photo
// included (downloaded from the private republic-selfies bucket — only the
// ministry can read it). Officer-only intel that the passport deliberately
// hides (true declared confidence, raw decision seconds, the screening
// question) sits in a small notes line under each document.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { PageShell } from '@/components/PageShell'
import { VisaDocument, type VisaDocumentAddendum, type VisaDocumentField } from '@/components/VisaDocument'
import {
  CONFIDENCE,
  DECISION_TIME_LABEL,
  DOCUMENT_PROGRESS,
  FULLY_EQUIPPED_STAMP,
  MINISTRY,
  STICKER_LABELS,
  VISA_BY_SLUG,
  adjustedConfidence,
  formatDecisionTime,
  formatPassportDate,
  formatPassportVisaName,
  iqFaceFor,
  isFullyEquipped,
  passportPhotoNote,
  type VisaType,
} from '@/lib/content'
import { playStampThunk } from '@/lib/sound'
import {
  buildQueueTabs,
  compareDraftEvents,
  computeQueueCounts,
  isPendingApplicationStatus,
  partitionDraftGroups,
  sortDraftEvents,
  submittedDraftIds,
  type MinistryQueue,
} from '@/lib/ministryDrafts'
import { fetchUniqueVisitorCount } from '@/lib/ministryVisitors'

interface ApplicationRow {
  id: number
  created_at: string
  applicant_name: string
  instagram_handle: string
  visa_type: string
  slot: string
  reference_code: string
  idea: string | null
  supplies: string[] | null
  pitch: string | null
  statement: string | null
  otherness: string | null
  interview_answers: string[] | null
  duty_free_items: string[] | null
  screening_question: string | null
  screening_answer: string | null
  declared_iq: number | null
  declared_confidence: number | null
  decision_seconds: number | null
  gender: string | null
  selfie_path: string | null
  intel: Record<string, unknown> | null
  draft_id: string | null
  status: string
  decided_at: string | null
}

interface DraftEventRow {
  id: number
  event_id: string
  draft_id: string
  created_at: string
  client_at: string
  event_type: string
  field: string | null
  previous_value: unknown
  value: unknown
  sequence: number
}

interface DraftGroup {
  draftId: string
  events: DraftEventRow[]
  latest: Map<string, DraftEventRow>
  intel: Record<string, unknown> | null
}

function visaName(slug: string): string {
  return VISA_BY_SLUG[slug as VisaType]?.name ?? slug.toUpperCase()
}

/** Mirrors app/visa-issued's field construction from a DB row instead of context. */
function rowToFields(row: ApplicationRow): VisaDocumentField[] {
  const slug = row.visa_type as VisaType
  return [
    { key: 'name', label: STICKER_LABELS.name, value: row.applicant_name.toUpperCase() },
    { key: 'passport', label: STICKER_LABELS.passport, value: row.instagram_handle },
    { key: 'visaType', label: 'VISA:', value: formatPassportVisaName(visaName(row.visa_type)) },
    {
      key: 'other',
      label: STICKER_LABELS.other,
      value: VISA_BY_SLUG[slug] ? passportPhotoNote(slug) : null,
    },
    { key: 'sex', label: STICKER_LABELS.sex, value: row.gender ?? '—' },
    ...(row.declared_iq !== null
      ? [{
          key: 'iq',
          label: 'IQ:',
          value: String(row.declared_iq),
          imageSrc: iqFaceFor(row.declared_iq).src,
          imageAlt: iqFaceFor(row.declared_iq).alt,
        }]
      : []),
    ...(row.declared_confidence !== null
      ? [{
          key: 'confidence',
          label: CONFIDENCE.passportLabel,
          value: `${adjustedConfidence(row.declared_confidence)}${CONFIDENCE.adjustedSuffix}`,
        }]
      : []),
    {
      key: 'appointment',
      label: DOCUMENT_PROGRESS.appointmentLabel,
      value: formatPassportDate(row.slot),
      span: true,
    },
  ]
}

/** Mirrors app/visa-issued's addenda construction from a DB row. */
function rowToAddenda(row: ApplicationRow): VisaDocumentAddendum[] {
  const addenda: VisaDocumentAddendum[] = []
  if (row.otherness) addenda.push({ key: 'otherness', label: DOCUMENT_PROGRESS.othernessLabel, value: row.otherness })
  if (row.idea) addenda.push({ key: 'idea', label: DOCUMENT_PROGRESS.ideaLabel, value: row.idea })
  if (row.pitch) addenda.push({ key: 'pitch', label: DOCUMENT_PROGRESS.pitchLabel, value: row.pitch })
  if (row.statement)
    addenda.push({ key: 'statement', label: DOCUMENT_PROGRESS.statementLabel, value: row.statement })
  if (row.interview_answers?.length)
    addenda.push({
      key: 'interview',
      label: DOCUMENT_PROGRESS.interviewAnswersLabel,
      value: row.interview_answers.join(' · '),
    })
  if (row.screening_answer)
    addenda.push({ key: 'screening', label: DOCUMENT_PROGRESS.screeningLabel, value: row.screening_answer })
  if (row.visa_type === 'fiance' && row.decision_seconds !== null)
    addenda.push({ key: 'decision', label: DECISION_TIME_LABEL, value: formatDecisionTime(row.decision_seconds) })
  if (row.duty_free_items?.length)
    addenda.push({ key: 'dutyFree', label: DOCUMENT_PROGRESS.dutyFreeLabel, value: row.duty_free_items.join(' · ') })
  return addenda
}

/** Officer-eyes-only intel the passport hides. */
function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(' · ')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function draftOfficerNotes(intel: Record<string, unknown> | null): string[] {
  if (!intel) return []
  const notes: string[] = []
  const value = (key: string) => (typeof intel[key] === 'string' ? String(intel[key]) : '')
  if (value('ip')) notes.push(`IP: ${value('ip')}`)
  const geo = [value('city'), value('region'), value('country')].filter(Boolean).join(', ')
  if (geo) notes.push(`FROM: ${geo}`)
  if (value('ipTimezone') || value('deviceTimezone')) notes.push(`TZ: ${value('ipTimezone') || value('deviceTimezone')}`)
  if (value('fromInstagram')) notes.push(`VIA INSTAGRAM: ${value('fromInstagram').toUpperCase()}`)
  if (value('referrer')) notes.push(`REFERRER: ${value('referrer')}`)
  if (value('battery')) notes.push(`BATTERY: ${value('battery')}`)
  if (value('connection')) notes.push(`CONNECTION: ${value('connection')}`)
  return notes
}

function officerNotes(row: ApplicationRow): string[] {
  const notes: string[] = []
  if (row.declared_confidence !== null) notes.push(`DECLARED CONFIDENCE: ${row.declared_confidence}%`)
  if (row.decision_seconds !== null) notes.push(`RAW DECISION TIME: ${row.decision_seconds.toFixed(1)}s`)
  if (row.screening_question) notes.push(`ASKED: ${row.screening_question}`)
  const intel = row.intel ?? {}
  const str = (key: string) => {
    const value = intel[key]
    return typeof value === 'string' && value ? value : null
  }
  const ip = str('ip')
  if (ip) notes.push(`IP: ${ip}`)
  const geo = [str('city'), str('region'), str('country')].filter(Boolean).join(', ')
  if (geo) notes.push(`FROM: ${geo}`)
  const tz = str('ipTimezone') ?? str('deviceTimezone')
  if (tz) notes.push(`TZ: ${tz}`)
  const instagram = str('fromInstagram')
  if (instagram) notes.push(`VIA INSTAGRAM: ${instagram.toUpperCase()}`)
  const referrer = str('referrer')
  if (referrer) notes.push(`REFERRER: ${referrer}`)
  const battery = str('battery')
  if (battery) notes.push(`BATTERY: ${battery}`)
  const connection = str('connection')
  if (connection) notes.push(`CONNECTION: ${connection}`)
  const retakes = intel.selfieRetakes
  if (typeof retakes === 'number' && retakes > 0) notes.push(`SELFIE RETAKES: ${retakes}`)
  return notes
}

export default function MinistryPage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    return createClient(url, key, { db: { schema: 'republic' } })
  }, [])

  const [session, setSession] = useState<Session | null>(null)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [rows, setRows] = useState<ApplicationRow[] | null>(null)
  const [events, setEvents] = useState<DraftEventRow[] | null>(null)
  const [denied, setDenied] = useState(false)
  const [photos, setPhotos] = useState<Record<number, string>>({})
  const [queue, setQueue] = useState<MinistryQueue>('pending')
  // undefined = not yet fetched, null = fetched but unavailable/failed.
  const [uniqueVisitors, setUniqueVisitors] = useState<number | null | undefined>(undefined)
  // SSR-safe default (0, never a client-only `Date.now()` read at render time,
  // matching this app's usual hydration-guard pattern); a client effect sets
  // the real clock immediately on mount and refreshes it periodically so a
  // draft's ABANDONED/IN PROGRESS classification advances at the 30-minute
  // mark on its own, without requiring an unrelated re-render to notice.
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    setNowMs(Date.now())
    const id = setInterval(() => setNowMs(Date.now()), 45_000)
    return () => clearInterval(id)
  }, [])

  const loadRows = useCallback(async () => {
    if (!supabase) return
    // PostgREST's default/max limits must not silently classify old drafts as
    // abandoned. Walk every page in created_at order; the high cap is only a
    // runaway-query guard, not a business limit.
    const PAGE_SIZE = 1000
    const MAX_PAGES = 1000
    const applications: ApplicationRow[] = []
    const draftEvents: DraftEventRow[] = []
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
      if (error) {
        // Only the `applications` query is access-controlled by ministry RLS
        // (migration 0004) — an error here genuinely means "not the ministry
        // account" (or the table is unreachable), so the whole desk
        // correctly reports ACCESS DENIED.
        setDenied(true)
        return
      }
      const batch = (data as ApplicationRow[]) ?? []
      applications.push(...batch)
      if (batch.length < PAGE_SIZE) break
    }
    // `draft_events` is a separate, additive feature (migration 0007) with
    // its own RLS policy. A failure here — the migration not applied yet,
    // a transient error, anything — must never be conflated with the
    // applications-access check above: degrade to an empty drafts section
    // and keep the applications desk fully usable instead of denying access
    // to everything.
    let draftEventsFailed = false
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE
      const { data, error } = await supabase
        .from('draft_events')
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) {
        draftEventsFailed = true
        break
      }
      const batch = (data as DraftEventRow[]) ?? []
      draftEvents.push(...batch)
      if (batch.length < PAGE_SIZE) break
    }
    setDenied(false)
    setRows(applications)
    setEvents(draftEventsFailed ? [] : draftEvents)
    // Fetched once per authenticated row load, after the desk itself is
    // confirmed accessible. Decisions (approve/deny) don't change unique
    // visitor IPs, so there's no need to refetch after every decide().
    void fetchUniqueVisitorCount(supabase).then(setUniqueVisitors)
  }, [supabase])

  // Pull each pending application's selfie from the private bucket (only the
  // ministry session can — storage RLS). Object URLs cached per row id.
  useEffect(() => {
    if (!supabase || !rows) return
    let cancelled = false
    const client = supabase
    rows
      .filter((r) => r.status === 'pending' && r.selfie_path && !(r.id in photos))
      .forEach((row) => {
        void client.storage
          .from('republic-selfies')
          .download(row.selfie_path as string)
          .then(({ data }) => {
            if (cancelled || !data) return
            setPhotos((prev) => (row.id in prev ? prev : { ...prev, [row.id]: URL.createObjectURL(data) }))
          })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, rows])

  useEffect(() => {
    if (!supabase) {
      setCheckedAuth(true)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckedAuth(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (session) void loadRows()
  }, [session, loadRows])

  async function signIn() {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/ministry` },
    })
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setRows(null)
  }

  async function decide(id: number, status: 'approved' | 'denied') {
    if (!supabase) return
    playStampThunk()
    const decided_at = new Date().toISOString()
    const { error } = await supabase.from('applications').update({ status, decided_at }).eq('id', id)
    if (!error) {
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status, decided_at } : r)) ?? prev)
    }
  }

  const pending = rows?.filter((r) => isPendingApplicationStatus(r.status)) ?? []
  const decided = rows?.filter((r) => !isPendingApplicationStatus(r.status)) ?? []
  const draftGroups = useMemo<DraftGroup[]>(() => {
    const allEvents = events ?? []
    // A submitted event is authoritative even when the application insert is
    // delayed, failed, or absent. Never show such a draft as abandoned.
    const submittedDrafts = submittedDraftIds(allEvents, (rows ?? []).map((row) => row.draft_id))
    const groups = new Map<string, DraftEventRow[]>()
    for (const event of allEvents) {
      if (!submittedDrafts.has(event.draft_id)) groups.set(event.draft_id, [...(groups.get(event.draft_id) ?? []), event])
    }
    return [...groups.entries()]
      .map(([draftId, unsortedEvents]) => {
        // Server created_at is authoritative across reloads/tabs. Sequence is
        // only a same-timestamp tiebreak; event_id/id make ties deterministic.
        const draftEvents = sortDraftEvents(unsortedEvents)
        const latest = new Map<string, DraftEventRow>()
        let intel: Record<string, unknown> | null = null
        for (const event of draftEvents) {
          if (event.event_type === 'field_changed' && event.field) latest.set(event.field, event)
          if (event.event_type === 'intel_collected' && event.value && typeof event.value === 'object') {
            intel = event.value as Record<string, unknown>
          }
        }
        return { draftId, events: draftEvents, latest, intel }
      })
      .sort((a, b) => compareDraftEvents(b.events[b.events.length - 1], a.events[a.events.length - 1]))
  }, [events, rows])

  const { abandoned: abandonedDrafts, inProgress: inProgressDrafts } = useMemo(
    () => partitionDraftGroups(draftGroups, nowMs),
    [draftGroups, nowMs]
  )
  const queueCounts = useMemo(
    () => computeQueueCounts(abandonedDrafts.length, inProgressDrafts.length, (rows ?? []).map((row) => row.status)),
    [abandonedDrafts.length, inProgressDrafts.length, rows]
  )
  const queueLabels: Record<MinistryQueue, string> = {
    abandoned: MINISTRY.abandoned,
    inProgress: MINISTRY.inProgress,
    pending: MINISTRY.pendingHeading,
    decided: MINISTRY.decidedHeading,
  }
  const queueTabs: { key: MinistryQueue; label: string; count: number }[] = useMemo(
    () => buildQueueTabs(queueCounts).map((tab) => ({ ...tab, label: queueLabels[tab.key] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queueCounts]
  )

  function renderDraftCard(draft: DraftGroup, queueLabel: string) {
    const last = draft.events[draft.events.length - 1]
    return (
      <article key={draft.draftId} className="border-2 border-navy/30 bg-paper-dark p-3">
        <div className="flex items-start justify-between gap-2 text-[10px] uppercase text-navy/60">
          <span className="font-bold text-navy">{queueLabel}</span>
          <span>{new Date(last.created_at).toLocaleString('en-GB')}</span>
        </div>
        <p className="mt-1 break-all text-[9px] uppercase text-navy/50">
          {MINISTRY.draftIdLabel} {draft.draftId}
        </p>
        <div className="mt-2 flex flex-col gap-1 text-[10px] uppercase text-navy">
          {[...draft.latest.values()].map((event) => (
            <p key={event.event_id} className="flex gap-2">
              <span className="shrink-0 font-bold">{event.field}:</span>
              <span className="min-w-0 break-words">{displayValue(event.value)}</span>
            </p>
          ))}
          {draft.latest.size === 0 && <p>{MINISTRY.noPartialData}</p>}
        </div>
        {draftOfficerNotes(draft.intel).length > 0 && (
          <p className="mt-2 text-[9px] uppercase leading-snug text-navy/60">
            {MINISTRY.officerNotesLabel} {draftOfficerNotes(draft.intel).join(' · ')}
          </p>
        )}
        <details className="mt-2 border-t border-navy/20 pt-2 text-[10px] uppercase text-navy">
          <summary className="min-h-11 cursor-pointer py-3 font-bold">{MINISTRY.historyLabel}</summary>
          <div className="flex flex-col gap-2">
            {draft.events
              .filter((event) => event.event_type === 'field_changed')
              .map((event) => (
                <div key={event.event_id} className="border-t border-dashed border-navy/20 pt-1">
                  <p>
                    {new Date(event.client_at || event.created_at).toLocaleString('en-GB')} · {event.field}
                  </p>
                  <p className="break-words text-navy/60">
                    {displayValue(event.previous_value)} → {displayValue(event.value)}
                  </p>
                </div>
              ))}
          </div>
        </details>
      </article>
    )
  }

  return (
    <PageShell>
      <div className="paper-card p-4">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{MINISTRY.heading}</h1>
        <p className="mt-1 text-center text-[10px] uppercase tracking-[0.2em] text-navy/60">{MINISTRY.sub}</p>
        {session && !denied && rows !== null && (
          <p className="mt-2 text-center text-[10px] uppercase text-navy/60">
            {MINISTRY.uniqueVisitorsLabel}:{' '}
            <span className="font-bold text-navy">
              {uniqueVisitors === undefined
                ? MINISTRY.uniqueVisitorsLoading
                : uniqueVisitors === null
                  ? MINISTRY.uniqueVisitorsUnavailable
                  : uniqueVisitors}
            </span>
            <span className="block text-[8px] normal-case tracking-normal text-navy/40">{MINISTRY.uniqueVisitorsNote}</span>
          </p>
        )}
        <div className="my-3 h-px bg-navy/20" />

        {!checkedAuth ? null : !session ? (
          <button
            type="button"
            onClick={signIn}
            className="min-h-11 w-full border-2 border-navy bg-navy py-3 font-stamp text-sm uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            {MINISTRY.signIn}
          </button>
        ) : denied ? (
          <p className="text-center text-[12px] font-bold uppercase tracking-wide text-stamp">
            {MINISTRY.accessDenied}
          </p>
        ) : rows === null ? (
          <p className="text-center text-[11px] uppercase text-navy/60">{MINISTRY.loading}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div role="group" aria-label={MINISTRY.queueTabsAriaLabel} className="grid grid-cols-2 gap-2">
              {queueTabs.map((tab) => {
                const selected = queue === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setQueue(tab.key)}
                    className={`min-h-11 border-2 px-2 py-2 text-center font-stamp text-[11px] uppercase tracking-wide transition-colors ${
                      selected ? 'border-navy bg-navy text-paper' : 'border-navy/40 bg-paper text-navy hover:bg-navy/10'
                    }`}
                  >
                    {tab.label}
                    <span className="block text-[10px] font-normal tracking-normal">({tab.count})</span>
                  </button>
                )
              })}
            </div>

            {queue === 'abandoned' && (
              <section>
                {abandonedDrafts.length === 0 ? (
                  <p className="text-[11px] uppercase text-navy/50">{MINISTRY.queueEmpty}</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {abandonedDrafts.map((draft) => renderDraftCard(draft, MINISTRY.abandoned))}
                  </div>
                )}
              </section>
            )}

            {queue === 'inProgress' && (
              <section>
                {inProgressDrafts.length === 0 ? (
                  <p className="text-[11px] uppercase text-navy/50">{MINISTRY.queueEmpty}</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {inProgressDrafts.map((draft) => renderDraftCard(draft, MINISTRY.inProgress))}
                  </div>
                )}
              </section>
            )}

            {queue === 'pending' && (
              <section>
                {pending.length === 0 ? (
                  <p className="text-[11px] uppercase text-navy/50">{MINISTRY.queueEmpty}</p>
                ) : (
                  <div className="flex flex-col gap-5">
                    {pending.map((row) => (
                      <div key={row.id}>
                        <p className="mb-1 flex items-baseline justify-between text-[10px] uppercase text-navy/60">
                          <span>{row.reference_code}</span>
                          <span>{new Date(row.created_at).toLocaleString('en-GB')}</span>
                        </p>
                        <VisaDocument
                          size="full"
                          photoUrl={photos[row.id] ?? null}
                          fields={rowToFields(row)}
                          addenda={rowToAddenda(row)}
                          cornerStamp={
                            row.visa_type === 'tourist' && isFullyEquipped(row.supplies ?? [])
                              ? FULLY_EQUIPPED_STAMP
                              : undefined
                          }
                        />
                        {officerNotes(row).length > 0 && (
                          <p className="mt-1 text-[9px] uppercase leading-snug text-navy/50">
                            {officerNotes(row).join(' · ')}
                          </p>
                        )}
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => decide(row.id, 'approved')}
                            className="min-h-11 border-2 border-approve bg-paper py-2 font-stamp text-sm uppercase tracking-widest text-approve transition-colors hover:bg-approve hover:text-paper"
                          >
                            {MINISTRY.approve}
                          </button>
                          <button
                            type="button"
                            onClick={() => decide(row.id, 'denied')}
                            className="min-h-11 border-2 border-stamp bg-paper py-2 font-stamp text-sm uppercase tracking-widest text-stamp transition-colors hover:bg-stamp hover:text-paper"
                          >
                            {MINISTRY.deny}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {queue === 'decided' && (
              <section>
                {decided.length === 0 ? (
                  <p className="text-[11px] uppercase text-navy/50">{MINISTRY.queueEmpty}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {decided.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-baseline justify-between gap-2 border border-navy/30 bg-paper px-2 py-1.5 text-[11px] uppercase"
                      >
                        <span className="min-w-0 truncate text-navy">
                          {row.applicant_name} · {visaName(row.visa_type)} · {row.reference_code}
                        </span>
                        <span
                          className={`shrink-0 font-bold ${row.status === 'approved' ? 'text-approve' : 'text-stamp'}`}
                        >
                          {row.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {session && (
          <button
            type="button"
            onClick={signOut}
            className="mt-5 min-h-11 w-full border-2 border-navy bg-paper py-2 text-center text-[11px] font-bold uppercase tracking-widest text-navy transition-colors hover:bg-navy hover:text-paper"
          >
            {MINISTRY.signOut}
          </button>
        )}
      </div>
      <PageShellFooterSpacer />
    </PageShell>
  )
}

// Tiny spacer so the fixed cash pile never overlaps the last button.
function PageShellFooterSpacer() {
  return <div className="h-6" />
}
