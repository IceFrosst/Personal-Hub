'use client'

// The hidden Ministry desk — Ignas reviews and decides applications here.
// Access model: Google OAuth via the shared portfolio Supabase project;
// RLS (migration 0004) only lets the ministry email SELECT/UPDATE
// republic.applications, so any other signed-in account just sees an
// access-denied error from the very first query. Visitors remain write-only.
// No public page links here — it's an unlisted route.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { PageShell } from '@/components/PageShell'
import { MINISTRY, VISA_BY_SLUG, type VisaType } from '@/lib/content'
import { playStampThunk } from '@/lib/sound'

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
  status: string
  decided_at: string | null
}

function visaName(slug: string): string {
  return VISA_BY_SLUG[slug as VisaType]?.name ?? slug.toUpperCase()
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <p className="text-[11px] leading-snug text-navy">
      <span className="text-navy/60">{label} </span>
      <span className="font-bold">{value}</span>
    </p>
  )
}

export default function MinistryPage() {
  // Client is created lazily on the client only (env vars are baked into the
  // bundle; hydration-safe because nothing here renders before mount state).
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return null
    return createClient(url, key, { db: { schema: 'republic' } })
  }, [])

  const [session, setSession] = useState<Session | null>(null)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [rows, setRows] = useState<ApplicationRow[] | null>(null)
  const [denied, setDenied] = useState(false)

  const loadRows = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      // RLS refuses anyone who isn't the ministry — same UX as no access.
      setDenied(true)
      return
    }
    setDenied(false)
    setRows((data as ApplicationRow[]) ?? [])
  }, [supabase])

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

  const pending = rows?.filter((r) => r.status === 'pending') ?? []
  const decided = rows?.filter((r) => r.status !== 'pending') ?? []

  return (
    <PageShell>
      <div className="paper-card p-5">
        <h1 className="text-center font-stamp text-lg uppercase tracking-wide text-navy">{MINISTRY.heading}</h1>
        <p className="mt-1 text-center text-[10px] uppercase tracking-[0.2em] text-navy/60">{MINISTRY.sub}</p>
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
        ) : rows.length === 0 ? (
          <p className="text-center text-[11px] uppercase text-navy/60">{MINISTRY.empty}</p>
        ) : (
          <div className="flex flex-col gap-5">
            <section>
              <h2 className="font-stamp text-sm uppercase tracking-widest text-navy">
                {MINISTRY.pendingHeading} ({pending.length})
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {pending.map((row) => (
                  <div key={row.id} className="border-2 border-navy bg-paper p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-stamp text-sm uppercase text-navy">
                        {row.applicant_name} · @{row.instagram_handle}
                      </p>
                      <p className="shrink-0 text-[10px] uppercase text-navy/60">{row.reference_code}</p>
                    </div>
                    <p className="text-[11px] uppercase text-navy/70">
                      {visaName(row.visa_type)} · {row.slot}
                      {row.gender ? ` · ${row.gender}` : ''}
                    </p>
                    <div className="mt-2 flex flex-col gap-0.5">
                      <Detail label="IDEA:" value={row.idea} />
                      <Detail label="SUPPLIES:" value={row.supplies?.join(' · ')} />
                      <Detail label="PITCH:" value={row.pitch} />
                      <Detail label="OTHERNESS:" value={row.otherness} />
                      <Detail label="STATEMENT:" value={row.statement} />
                      <Detail label="INTERVIEW:" value={row.interview_answers?.join(' · ')} />
                      <Detail label="SCREENING:" value={row.screening_answer} />
                      <Detail label="IQ:" value={row.declared_iq !== null ? String(row.declared_iq) : null} />
                      <Detail
                        label="CONFIDENCE:"
                        value={row.declared_confidence !== null ? `${row.declared_confidence}% declared` : null}
                      />
                      <Detail
                        label="DECISION TIME:"
                        value={row.decision_seconds !== null ? `${Math.round(row.decision_seconds)}s` : null}
                      />
                      <Detail label="DUTY-FREE:" value={row.duty_free_items?.join(' · ')} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
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
                {pending.length === 0 && (
                  <p className="text-[11px] uppercase text-navy/50">{MINISTRY.empty}</p>
                )}
              </div>
            </section>

            {decided.length > 0 && (
              <section>
                <h2 className="font-stamp text-sm uppercase tracking-widest text-navy">
                  {MINISTRY.decidedHeading} ({decided.length})
                </h2>
                <div className="mt-2 flex flex-col gap-1.5">
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
    </PageShell>
  )
}
