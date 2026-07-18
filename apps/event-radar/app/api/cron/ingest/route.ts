import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchDevpost, type IngestRow } from '@/lib/ingest/devpost'
import { fetchMlh } from '@/lib/ingest/mlh'
import { fetchEthGlobal } from '@/lib/ingest/ethglobal'
import { fetchHackerEarth } from '@/lib/ingest/hackerearth'
import { fetchHackClub } from '@/lib/ingest/hackclub'
import { enrich, fetchPageText } from '@/lib/ingest/enrich'
import { scoreHackathon, isLive } from '@/lib/scoring'
import { sendPush } from '@/lib/push'
import { DEFAULT_NOTIFICATION_SETTINGS, type Hackathon } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ENRICH_BATCH = 10
const TIME_BUDGET_MS = 45_000

/**
 * Daily radar sweep (Vercel Cron). Three phases, each independently fallible:
 *   1. gather  — Devpost API + MLH HTML → insert new rows, touch last_seen_at
 *   2. enrich  — bounded batch of un-enriched rows through Groq/Gemini
 *   3. notify  — web-push users whose score threshold a new hackathon clears
 * Requires SUPABASE_SERVICE_ROLE_KEY (503 until provisioned). Protected by
 * CRON_SECRET, which Vercel Cron sends automatically as a Bearer token.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'service_role_not_configured' }, { status: 503 })
  }

  const startedAt = Date.now()
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS
  const db = admin.schema('hackathon')
  const summary: Record<string, unknown> = {}

  // ---- Phase 1: gather ----
  const gathered: IngestRow[] = []
  const sourceResults: Record<string, string | number> = {}
  const sources: Array<[string, () => Promise<IngestRow[]>]> = [
    ['devpost', () => fetchDevpost()],
    ['mlh', () => fetchMlh()],
    ['ethglobal', () => fetchEthGlobal()],
    ['hackerearth', () => fetchHackerEarth()],
    ['hackclub', () => fetchHackClub()],
  ]
  for (const [name, fn] of sources) {
    try {
      const rows = await fn()
      gathered.push(...rows)
      sourceResults[name] = rows.length
    } catch (err) {
      sourceResults[name] = `error: ${err instanceof Error ? err.message : String(err)}`
    }
  }
  summary.sources = sourceResults

  let inserted = 0
  if (gathered.length > 0) {
    const urls = gathered.map((r) => r.url)
    const { data: existing, error: existingErr } = await db
      .from('hackathons')
      .select('url')
      .in('url', urls)
    if (existingErr) {
      summary.gather_error = existingErr.message
    } else {
      const known = new Set((existing ?? []).map((r) => r.url))
      const fresh = gathered.filter((r) => !known.has(r.url))
      // Dedupe within the batch (a hackathon can appear on two list pages).
      const seen = new Set<string>()
      const toInsert = fresh.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)))

      if (toInsert.length > 0) {
        const { error: insertErr } = await db.from('hackathons').insert(
          toInsert.map((r) => ({
            source: r.source,
            source_id: r.source_id,
            title: r.title,
            url: r.url,
            starts_at: r.starts_at,
            ends_at: r.ends_at,
            location_raw: r.location_raw,
            format: r.format,
            prize_pool: r.prize_pool,
            registration_deadline: r.registration_deadline ?? null,
            themes: r.themes,
          }))
        )
        if (insertErr) summary.insert_error = insertErr.message
        else inserted = toInsert.length
      }
      if (known.size > 0) {
        await db
          .from('hackathons')
          .update({ last_seen_at: new Date().toISOString() })
          .in('url', [...known])
      }
    }
  }
  summary.inserted = inserted

  // ---- Phase 2: enrich ----
  let enriched = 0
  const { data: pending } = await db
    .from('hackathons')
    .select('*')
    .is('enriched_at', null)
    .order('created_at', { ascending: false })
    .limit(ENRICH_BATCH)

  for (const row of (pending ?? []) as Hackathon[]) {
    if (outOfTime()) break
    const text = await fetchPageText(row.url)
    const patch: Record<string, unknown> = { enriched_at: new Date().toISOString() }
    if (text) {
      const e = await enrich(text)
      patch.travel_covered = e.travel_covered
      patch.accommodation_covered = e.accommodation_covered
      patch.open_to_business_students = e.open_to_business_students
      patch.raw_description = text.slice(0, 4000)
      if (e.format) patch.format = e.format
      if (e.city) patch.city = e.city
      if (e.country) patch.country = e.country
      // A source-provided deadline (e.g. ETHGlobal's signupDeadline) is exact —
      // don't let an LLM-parsed date overwrite it.
      if (e.registration_deadline && !row.registration_deadline)
        patch.registration_deadline = e.registration_deadline
      if (e.themes.length > 0 && (!row.themes || row.themes.length === 0)) patch.themes = e.themes
    }
    const { error: updateErr } = await db.from('hackathons').update(patch).eq('id', row.id)
    if (!updateErr && text) enriched++
  }
  summary.enriched = enriched

  // ---- Phase 3: notify ----
  let notified = 0
  const goneSubIds: string[] = []
  const { data: fresh } = await db
    .from('hackathons')
    .select('*')
    .is('notified_at', null)
    .not('enriched_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  const freshRows = ((fresh ?? []) as Hackathon[]).filter((h) => isLive(h))

  if (freshRows.length > 0) {
    const [{ data: subs }, { data: prefs }] = await Promise.all([
      db.from('push_subscriptions').select('id, user_id, subscription'),
      db.from('user_preferences').select('user_id, notification_settings'),
    ])
    const prefsByUser = new Map(
      (prefs ?? []).map((p) => [p.user_id, { ...DEFAULT_NOTIFICATION_SETTINGS, ...p.notification_settings }])
    )

    for (const h of freshRows) {
      if (outOfTime()) break
      const { score, reasons } = scoreHackathon(h)
      for (const sub of subs ?? []) {
        const settings = prefsByUser.get(sub.user_id) ?? DEFAULT_NOTIFICATION_SETTINGS
        if (!settings.enabled || score < settings.min_score) continue
        const top = reasons.filter((r) => r.pts > 0).slice(0, 2).map((r) => r.label).join(' · ')
        const result = await sendPush(sub.subscription, {
          title: `${h.title}`,
          body: top ? `Match ${score} — ${top}` : `Match score ${score}`,
          url: '/',
        })
        if (result === 'sent') notified++
        if (result === 'gone') goneSubIds.push(sub.id)
      }
    }

    await db
      .from('hackathons')
      .update({ notified_at: new Date().toISOString() })
      .in('id', freshRows.map((h) => h.id))
  }
  if (goneSubIds.length > 0) {
    await db.from('push_subscriptions').delete().in('id', goneSubIds)
  }
  summary.notified = notified
  summary.elapsed_ms = Date.now() - startedAt

  return NextResponse.json(summary)
}
