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
import { fetchTopcoder } from './topcoder'
import { fetchStartupLithuania } from './startuplithuania'
import { fetchKnownEvents } from './known-events'
import { watchesToRows } from './watches'
import { enrich, fetchPageText } from './enrich'
import { circuitTravelCovered, circuitFaqPaths, genericTravelFaqUrls } from './travel-circuits'
import { isUpcomingAndOpen, scoreHackathon } from '@/lib/scoring'
import { sendPush } from '@/lib/push'
import { encodeTravelPolicyThemes } from '@/lib/travel-policy-store'
import {
  coerceHackathon,
  coerceNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type Hackathon,
} from '@/lib/types'

const ENRICH_BATCH = 30
const ENRICH_CONCURRENCY = 4
const TIME_BUDGET_MS = 50_000
const URL_CHUNK = 80

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

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchBestPageText(row: {
  url: string
  source: string
  title: string
  format: Hackathon['format']
}): Promise<string | null> {
  const main = await fetchPageText(row.url)

  // Second-hop travel/FAQ crawl. Two sources of candidate URLs:
  //   1. Known circuits — their registered FAQ paths, appended to the event URL.
  //   2. General population — organizer-hosted, non-online events get generic
  //      /faq · /travel · /apply probes on their own origin (this is where MLH
  //      member events and self-hosted hackathons actually state travel policy).
  const base = row.url.replace(/\/?$/, '')
  const circuitUrls = circuitFaqPaths(row).map((path) => `${base}${path}`)
  const genericUrls = genericTravelFaqUrls({ url: row.url, format: row.format })
  // Dedupe and bound total extra fetches so a single row can't blow the budget.
  const extraUrls = [...new Set([...circuitUrls, ...genericUrls])].slice(0, 4)

  if (extraUrls.length === 0) return main

  const extras: string[] = []
  for (const target of extraUrls) {
    try {
      // Short timeout — these are best-effort guesses, many 404 instantly.
      const extra = await fetchPageText(target, 5000)
      if (extra && extra.length > 200) extras.push(extra)
    } catch {
      /* ignore */
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
    ['topcoder', () => fetchTopcoder()],
    ['startuplithuania', () => fetchStartupLithuania()],
    ['known', async () => fetchKnownEvents()],
    ['watch', async () => watchesToRows()],
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
    const known = new Set<string>()

    for (const urlChunk of chunk(urls, URL_CHUNK)) {
      const { data: existing, error: existingError } = await db
        .from('hackathons')
        .select('url')
        .in('url', urlChunk)
      if (existingError) {
        summary.gather_error = existingError.message
        break
      }
      for (const row of existing ?? []) known.add(row.url)
    }

    if (!summary.gather_error) {
      const fresh = gathered.filter((row) => !known.has(row.url))
      const seen = new Set<string>()
      const toInsert = fresh.filter((row) =>
        seen.has(row.url) ? false : (seen.add(row.url), true)
      )

      for (const insertChunk of chunk(toInsert, URL_CHUNK)) {
        if (insertChunk.length === 0) continue
        const { data: insertedRows, error: insertError } = await db
          .from('hackathons')
          .upsert(
            insertChunk.map((row) => ({
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
        if (insertError) {
          summary.insert_error = insertError.message
          break
        }
        summary.inserted += insertedRows?.length ?? 0
        for (const row of insertedRows ?? []) newlyInsertedIds.push(row.id)
      }

      if (known.size > 0 && !summary.insert_error) {
        for (const urlChunk of chunk([...known], URL_CHUNK)) {
          await db
            .from('hackathons')
            .update({ last_seen_at: new Date().toISOString() })
            .in('url', urlChunk)
        }
      }
    }
  }

  const enrichRow = async (row: Hackathon): Promise<boolean> => {
    const text = await fetchBestPageText({
      url: row.url,
      source: row.source,
      title: row.title,
      format: row.format,
    })
    const source = text ?? ([row.title, row.location_raw].filter(Boolean).join(' — ') || null)
    if (!source) return false

    const extracted = await enrich(source)
    const effectiveFormat = extracted.format ?? row.format
    const circuitTravel = circuitTravelCovered({
      source: row.source,
      title: row.title,
      url: row.url,
      format: effectiveFormat,
    })
    const travel =
      extracted.travel_covered !== null && extracted.travel_covered !== undefined
        ? extracted.travel_covered
        : circuitTravel

    // Always encode policy into themes so scoring works without migration 0003.
    const baseThemes =
      extracted.themes.length > 0
        ? extracted.themes
        : row.themes ?? []
    const themesWithPolicy = encodeTravelPolicyThemes(baseThemes, {
      travel_scope: extracted.travel_scope,
      travel_regions: extracted.travel_regions,
      travel_cap: extracted.travel_cap,
      travel_notes: extracted.travel_notes,
    })

    const basePatch: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      travel_covered: travel,
      accommodation_covered: extracted.accommodation_covered,
      open_to_business_students: extracted.open_to_business_students,
      themes: themesWithPolicy,
    }
    if (text) basePatch.raw_description = text.slice(0, 4000)
    if (extracted.format) basePatch.format = extracted.format
    if (extracted.city) basePatch.city = extracted.city
    if (extracted.country) basePatch.country = extracted.country
    if (extracted.registration_deadline && !row.registration_deadline)
      basePatch.registration_deadline = extracted.registration_deadline

    if (
      (row.source === 'known' || row.source === 'watch') &&
      travel === null &&
      circuitTravel === true
    ) {
      basePatch.travel_covered = true
    }

    // Prefer dedicated columns when migration 0003 is applied; themes remain the fallback.
    const policyPatch: Record<string, unknown> = {
      ...basePatch,
      travel_scope: extracted.travel_scope,
      travel_regions: extracted.travel_regions,
      travel_cap: extracted.travel_cap,
      travel_notes: extracted.travel_notes,
    }

    let { data: updated, error: updateError } = await db
      .from('hackathons')
      .update(policyPatch)
      .eq('id', row.id)
      .select('id')

    if (updateError) {
      const msg = updateError.message.toLowerCase()
      if (msg.includes('travel_scope') || msg.includes('travel_regions') || msg.includes('column')) {
        ;({ data: updated, error: updateError } = await db
          .from('hackathons')
          .update(basePatch)
          .eq('id', row.id)
          .select('id'))
      }
    }

    return !updateError && (updated?.length ?? 0) > 0
  }

  const toEnrich: Hackathon[] = []

  if (newlyInsertedIds.length > 0) {
    const { data: freshRows } = await db.from('hackathons').select('*').in('id', newlyInsertedIds)
    if (freshRows) {
      toEnrich.push(...freshRows.map((r) => coerceHackathon(r as Record<string, unknown>)))
    }
  }

  const { data: pending } = await db
    .from('hackathons')
    .select('*')
    .or('enriched_at.is.null,and(travel_covered.is.null,format.is.null)')
    .order('created_at', { ascending: false })
    .limit(ENRICH_BATCH)

  const seenIds = new Set(toEnrich.map((r) => r.id))
  for (const row of pending ?? []) {
    const h = coerceHackathon(row as Record<string, unknown>)
    if (seenIds.has(h.id)) continue
    toEnrich.push(h)
    if (toEnrich.length >= ENRICH_BATCH) break
  }

  for (let i = 0; i < toEnrich.length; i += ENRICH_CONCURRENCY) {
    if (outOfTime()) break
    const results = await Promise.all(
      toEnrich.slice(i, i + ENRICH_CONCURRENCY).map((row) => enrichRow(row))
    )
    summary.enriched += results.filter(Boolean).length
  }

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

    const freshRows = (fresh ?? [])
      .map((r) => coerceHackathon(r as Record<string, unknown>))
      .filter((h) => isUpcomingAndOpen(h))
    if (freshRows.length > 0) {
      const [{ data: subscriptions }, { data: preferences }] = await Promise.all([
        db.from('push_subscriptions').select('id, user_id, subscription'),
        db.from('user_preferences').select('user_id, notification_settings'),
      ])
      const preferencesByUser = new Map(
        (preferences ?? []).map((p) => [
          p.user_id,
          coerceNotificationSettings(p.notification_settings),
        ])
      )

      for (const hackathon of freshRows) {
        if (outOfTime()) break
        for (const subscription of subscriptions ?? []) {
          const settings =
            preferencesByUser.get(subscription.user_id) ?? DEFAULT_NOTIFICATION_SETTINGS
          const { score, reasons } = scoreHackathon(hackathon, new Date(), {
            priority_countries: settings.priority_countries,
            home_base: settings.home_base,
          })
          if (!settings.enabled || score < settings.min_score) continue
          const topReasons = reasons
            .filter((r) => r.pts > 0)
            .slice(0, 2)
            .map((r) => r.label)
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
