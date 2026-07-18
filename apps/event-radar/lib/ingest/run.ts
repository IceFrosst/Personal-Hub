import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchDevpost, type IngestRow } from './devpost'
import { fetchMlh } from './mlh'
import { fetchEthGlobal } from './ethglobal'
import { fetchHackerEarth } from './hackerearth'
import { fetchHackClub } from './hackclub'
import { fetchUnstop } from './unstop'
import { fetchDevfolio } from './devfolio'
import { fetchDoraHacks } from './dorahacks'
import { enrich, fetchPageText } from './enrich'
import { isUpcomingAndOpen, scoreHackathon } from '@/lib/scoring'
import { sendPush } from '@/lib/push'
import { DEFAULT_NOTIFICATION_SETTINGS, type Hackathon } from '@/lib/types'

// Enrichment throughput is bounded by two ceilings, not by choice:
//   1. Vercel Hobby caps each function at 60s (maxDuration).
//   2. The free LLM tiers rate-limit (~30 req/min Groq, ~15 Gemini).
// So we parallelize up to CONCURRENCY (staying near the combined RPM ceiling)
// and cap the batch at what fits the time budget — far more than the old
// one-at-a-time 10, without tripping 429s. Run 4x/day (GitHub Actions cron) to
// scale total daily throughput past a single daily Vercel run.
const ENRICH_BATCH = 30
const ENRICH_CONCURRENCY = 4
const TIME_BUDGET_MS = 50_000

export class IngestNotConfiguredError extends Error {
  constructor() {
    super('service_role_not_configured')
    this.name = 'IngestNotConfiguredError'
  }
}

export type IngestSummary = {
  sources: Record<string, string | number>
  inserted: number
  enriched: number
  notified: number
  notifications_skipped?: boolean
  elapsed_ms: number
  gather_error?: string
  insert_error?: string
}

export async function runIngest({ sendNotifications = true } = {}): Promise<IngestSummary> {
  const admin = createAdminClient()
  if (!admin) throw new IngestNotConfiguredError()

  const startedAt = Date.now()
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS
  const db = admin.schema('hackathon')
  const summary: IngestSummary = {
    sources: {},
    inserted: 0,
    enriched: 0,
    notified: 0,
    elapsed_ms: 0,
  }

  // ---- Phase 1: gather ----
  const gathered: IngestRow[] = []
  const sources: Array<[string, () => Promise<IngestRow[]>]> = [
    ['devpost', () => fetchDevpost()],
    ['mlh', () => fetchMlh()],
    ['ethglobal', () => fetchEthGlobal()],
    ['hackerearth', () => fetchHackerEarth()],
    ['hackclub', () => fetchHackClub()],
    ['unstop', () => fetchUnstop()],
    ['devfolio', () => fetchDevfolio()],
    ['dorahacks', () => fetchDoraHacks()],
  ]
  // Sequential per-source timeouts would stack up and consume the entire
  // function budget; run them together so gather takes as long as the slowest.
  const settled = await Promise.allSettled(sources.map(([, fetchSource]) => fetchSource()))
  settled.forEach((result, index) => {
    const name = sources[index][0]
    if (result.status === 'fulfilled') {
      gathered.push(...result.value)
      summary.sources[name] = result.value.length
    } else {
      summary.sources[name] =
        `error: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
    }
  })

  if (gathered.length > 0) {
    const urls = gathered.map((row) => row.url)
    const { data: existing, error: existingError } = await db
      .from('hackathons')
      .select('url')
      .in('url', urls)
    if (existingError) {
      summary.gather_error = existingError.message
    } else {
      const known = new Set((existing ?? []).map((row) => row.url))
      const fresh = gathered.filter((row) => !known.has(row.url))
      const seen = new Set<string>()
      const toInsert = fresh.filter((row) =>
        seen.has(row.url) ? false : (seen.add(row.url), true)
      )

      if (toInsert.length > 0) {
        const { data: insertedRows, error: insertError } = await db
          .from('hackathons')
          .upsert(
            toInsert.map((row) => ({
              source: row.source,
              source_id: row.source_id,
              title: row.title,
              url: row.url,
              starts_at: row.starts_at,
              ends_at: row.ends_at,
              location_raw: row.location_raw,
              format: row.format,
              prize_pool: row.prize_pool,
              registration_deadline: row.registration_deadline ?? null,
              themes: row.themes,
            })),
            { onConflict: 'source,url', ignoreDuplicates: true }
          )
          .select('id')
        if (insertError) summary.insert_error = insertError.message
        else summary.inserted = insertedRows?.length ?? 0
      }
      if (known.size > 0) {
        await db
          .from('hackathons')
          .update({ last_seen_at: new Date().toISOString() })
          .in('url', [...known])
      }
    }
  }

  // ---- Phase 2: enrich ----
  const { data: pending } = await db
    .from('hackathons')
    .select('*')
    .is('enriched_at', null)
    .order('created_at', { ascending: false })
    .limit(ENRICH_BATCH)

  // Enrich one row. Reads the event's own page for the model; if that page
  // can't be fetched (JS-only SPAs like EthGlobal, WAF blocks), fall back to
  // the metadata the source scraper already gave us so the row still gets a
  // format/location and stops clogging every future batch. Returns whether the
  // row was counted as newly enriched.
  const enrichRow = async (row: Hackathon): Promise<boolean> => {
    const text = await fetchPageText(row.url)
    // No page AND no metadata to reason over → leave it pending for a retry
    // (a transient fetch blip shouldn't burn the row's one shot at the page).
    const source = text ?? ([row.title, row.location_raw].filter(Boolean).join(' — ') || null)
    if (!source) return false

    const extracted = await enrich(source)
    const patch: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      travel_covered: extracted.travel_covered,
      accommodation_covered: extracted.accommodation_covered,
      open_to_business_students: extracted.open_to_business_students,
    }
    if (text) patch.raw_description = text.slice(0, 4000)
    if (extracted.format) patch.format = extracted.format
    if (extracted.city) patch.city = extracted.city
    if (extracted.country) patch.country = extracted.country
    // Preserve an exact source-provided deadline (for example ETHGlobal's)
    // instead of replacing it with the enrichment model's date-only value.
    if (extracted.registration_deadline && !row.registration_deadline)
      patch.registration_deadline = extracted.registration_deadline
    if (extracted.themes.length > 0 && (!row.themes || row.themes.length === 0))
      patch.themes = extracted.themes
    // Only the first overlapping run may complete the row. The external fetch
    // can be duplicated, but enriched_at is never set before the attempt ends.
    const { data: updated, error: updateError } = await db
      .from('hackathons')
      .update(patch)
      .eq('id', row.id)
      .is('enriched_at', null)
      .select('id')
    return !updateError && (updated?.length ?? 0) > 0
  }

  // Process the batch in bounded-concurrency chunks. Concurrency stays near the
  // free LLM RPM ceiling (Groq → Gemini fallback absorbs the odd 429); the time
  // guard between chunks keeps us under the 60s function limit.
  const batch = (pending ?? []) as Hackathon[]
  for (let i = 0; i < batch.length; i += ENRICH_CONCURRENCY) {
    if (outOfTime()) break
    const results = await Promise.all(
      batch.slice(i, i + ENRICH_CONCURRENCY).map((row) => enrichRow(row))
    )
    summary.enriched += results.filter(Boolean).length
  }

  // ---- Phase 3: notify (scheduled runs only) ----
  if (sendNotifications) {
    const goneSubscriptionIds: string[] = []
    const processedHackathonIds: string[] = []
    const { data: fresh } = await db
      .from('hackathons')
      .select('*')
      .is('notified_at', null)
      .not('enriched_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30)

    const freshRows = ((fresh ?? []) as Hackathon[]).filter((hackathon) =>
      isUpcomingAndOpen(hackathon)
    )
    if (freshRows.length > 0) {
      const [{ data: subscriptions }, { data: preferences }] = await Promise.all([
        db.from('push_subscriptions').select('id, user_id, subscription'),
        db.from('user_preferences').select('user_id, notification_settings'),
      ])
      const preferencesByUser = new Map(
        (preferences ?? []).map((preference) => [
          preference.user_id,
          { ...DEFAULT_NOTIFICATION_SETTINGS, ...preference.notification_settings },
        ])
      )

      for (const hackathon of freshRows) {
        if (outOfTime()) break
        const { score, reasons } = scoreHackathon(hackathon)
        for (const subscription of subscriptions ?? []) {
          const settings =
            preferencesByUser.get(subscription.user_id) ?? DEFAULT_NOTIFICATION_SETTINGS
          if (!settings.enabled || score < settings.min_score) continue
          const topReasons = reasons
            .filter((reason) => reason.pts > 0)
            .slice(0, 2)
            .map((reason) => reason.label)
            .join(' · ')
          const result = await sendPush(subscription.subscription, {
            title: hackathon.title,
            body: topReasons ? `Match ${score} — ${topReasons}` : `Match score ${score}`,
            url: '/',
          })
          if (result === 'sent') summary.notified++
          if (result === 'gone') goneSubscriptionIds.push(subscription.id)
        }
        processedHackathonIds.push(hackathon.id)
      }

      if (processedHackathonIds.length > 0) {
        await db
          .from('hackathons')
          .update({ notified_at: new Date().toISOString() })
          .in('id', processedHackathonIds)
      }
    }
    if (goneSubscriptionIds.length > 0) {
      await db.from('push_subscriptions').delete().in('id', goneSubscriptionIds)
    }
  } else {
    summary.notifications_skipped = true
  }

  summary.elapsed_ms = Date.now() - startedAt
  return summary
}
