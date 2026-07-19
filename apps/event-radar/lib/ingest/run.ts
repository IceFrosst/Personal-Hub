import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { fetchDevpost, type IngestRow } from './devpost'
import { fetchMlh } from './mlh'
import { fetchEthGlobal } from './ethglobal'
import { fetchHackerEarth } from './hackerearth'
import { fetchHackClub } from './hackclub'
import { fetchLuma } from './luma'
import { fetchHackQuest } from './hackquest'
import { fetchDevfolio } from './devfolio'
import { fetchTaikai } from './taikai'
import { fetchDoraHacks } from './dorahacks'
import { fetchUnstop } from './unstop'
import { fetchKnownEvents } from './known-events'
import { enrich, fetchPageText } from './enrich'
import { circuitTravelCovered, circuitFaqPaths } from './travel-circuits'
import { isUpcomingAndOpen, scoreHackathon } from '@/lib/scoring'
import { sendPush } from '@/lib/push'
import { DEFAULT_NOTIFICATION_SETTINGS, type Hackathon } from '@/lib/types'

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

/** Try main URL, then circuit FAQ-style paths, concatenate useful text. */
async function fetchBestPageText(row: {
  url: string
  source: string
  title: string
}): Promise<string | null> {
  const main = await fetchPageText(row.url)
  const faqPaths = circuitFaqPaths(row)
  if (faqPaths.length === 0) return main

  // Only chase FAQ paths when main page is missing or very thin (typical SPA shell).
  if (main && main.length > 1500) return main

  const base = row.url.replace(/\/?$/, '')
  const extras: string[] = []
  for (const path of faqPaths.slice(0, 2)) {
    try {
      const extra = await fetchPageText(`${base}${path}`)
      if (extra && extra.length > 200) extras.push(extra)
    } catch {
      // ignore individual failures
    }
  }
  if (!main && extras.length === 0) return null
  return [main, ...extras].filter(Boolean).join('\n\n')
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
    ['luma', () => fetchLuma()],
    ['hackquest', () => fetchHackQuest()],
    ['devfolio', () => fetchDevfolio()],
    ['taikai', () => fetchTaikai()],
    ['dorahacks', () => fetchDoraHacks()],
    ['unstop', () => fetchUnstop()],
    ['known', async () => fetchKnownEvents()],
  ]

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

  const newlyInsertedIds: string[] = []

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
        else {
          summary.inserted = insertedRows?.length ?? 0
          for (const row of insertedRows ?? []) newlyInsertedIds.push(row.id)
        }
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
  // Always try page extraction first (including FAQ paths for known circuits).
  // Circuit prior only fills when extraction still leaves travel unknown.

  const enrichRow = async (row: Hackathon): Promise<boolean> => {
    const text = await fetchBestPageText({
      url: row.url,
      source: row.source,
      title: row.title,
    })
    const source = text ?? ([row.title, row.location_raw].filter(Boolean).join(' — ') || null)
    if (!source) return false

    const extracted = await enrich(source)
    const effectiveFormat = extracted.format ?? row.format
    const circuitTravel = circuitTravelCovered({
      source: row.source,
      title: row.title,
      format: effectiveFormat,
    })

    // Page finding always wins. Circuit prior only when page said nothing.
    const travel =
      extracted.travel_covered !== null && extracted.travel_covered !== undefined
        ? extracted.travel_covered
        : circuitTravel

    const patch: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      travel_covered: travel,
      accommodation_covered: extracted.accommodation_covered,
      open_to_business_students: extracted.open_to_business_students,
    }
    if (text) patch.raw_description = text.slice(0, 4000)
    if (extracted.format) patch.format = extracted.format
    if (extracted.city) patch.city = extracted.city
    if (extracted.country) patch.country = extracted.country
    if (extracted.registration_deadline && !row.registration_deadline)
      patch.registration_deadline = extracted.registration_deadline
    if (extracted.themes.length > 0 && (!row.themes || row.themes.length === 0))
      patch.themes = extracted.themes

    // Seeded known events already have strong metadata — still allow enrichment
    // to refine, but ensure travel stays true if circuit says so and page was silent.
    if (row.source === 'known' && travel === null && circuitTravel === true) {
      patch.travel_covered = true
    }

    const { data: updated, error: updateError } = await db
      .from('hackathons')
      .update(patch)
      .eq('id', row.id)
      .select('id')
    return !updateError && (updated?.length ?? 0) > 0
  }

  const toEnrich: Hackathon[] = []

  if (newlyInsertedIds.length > 0) {
    const { data: freshRows } = await db
      .from('hackathons')
      .select('*')
      .in('id', newlyInsertedIds)
    if (freshRows) toEnrich.push(...(freshRows as Hackathon[]))
  }

  const { data: pending } = await db
    .from('hackathons')
    .select('*')
    .or('enriched_at.is.null,and(travel_covered.is.null,format.is.null)')
    .order('created_at', { ascending: false })
    .limit(ENRICH_BATCH)

  const seenIds = new Set(toEnrich.map((r) => r.id))
  for (const row of (pending ?? []) as Hackathon[]) {
    if (seenIds.has(row.id)) continue
    toEnrich.push(row)
    if (toEnrich.length >= ENRICH_BATCH) break
  }

  for (let i = 0; i < toEnrich.length; i += ENRICH_CONCURRENCY) {
    if (outOfTime()) break
    const results = await Promise.all(
      toEnrich.slice(i, i + ENRICH_CONCURRENCY).map((row) => enrichRow(row))
    )
    summary.enriched += results.filter(Boolean).length
  }

  // ---- Phase 3: notify ----
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
