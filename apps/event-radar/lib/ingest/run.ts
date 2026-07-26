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
import { fetchStartupLithuania } from './startuplithuania'
import { fetchAllHackathons } from './allhackathons'
import { fetchKnownEvents } from './known-events'
import { watchesToRows } from './watches'
import { buildSeedPatch, type ExistingRow } from './seed-upgrade'
import { buildTravelPolicyPatch } from './travel-policy-backfill'
import { enrich, fetchPageText } from './enrich'
import {
  circuitTravelCovered,
  circuitTravelPolicy,
  circuitFaqPaths,
  genericTravelFaqUrls,
} from './travel-circuits'
import { isUpcomingAndOpen, scoreHackathon } from '@/lib/scoring'
import { buildDigestPayload, shouldSendDigest, summarizeDigest } from '@/lib/digest'
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
/** Newest un-announced rows considered for the daily digest. */
const DIGEST_CANDIDATES = 60
/** Upcoming rows scanned per run for a registry travel-policy backfill. */
const POLICY_BACKFILL_SCAN = 400

export class IngestNotConfiguredError extends Error {
  constructor() {
    super('service_role_not_configured')
    this.name = 'IngestNotConfiguredError'
  }
}

export type IngestSummary = {
  sources: Record<string, string | number>
  inserted: number
  /** Existing rows whose missing/stale dates a known/watch seed repaired. */
  seed_patched?: number
  /** Already-enriched rows given a verified circuit travel policy. */
  policy_backfilled?: number
  enriched: number
  notified: number
  /** Why the daily digest did or didn't go out — for cron log debugging. */
  digest?: 'sent' | 'gated' | 'nothing_new' | 'nothing_qualified'
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
    ['startuplithuania', () => fetchStartupLithuania()],
    ['allhackathons', () => fetchAllHackathons()],
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
    // Keep the full row, not just the URL: a colliding known/watch seed may need
    // to upgrade it (see seed-upgrade.ts).
    const existingByUrl = new Map<string, ExistingRow>()

    for (const urlChunk of chunk(urls, URL_CHUNK)) {
      const { data: existing, error: existingError } = await db
        .from('hackathons')
        .select('id, url, registration_deadline, format, location_raw')
        .in('url', urlChunk)
      if (existingError) {
        summary.gather_error = existingError.message
        break
      }
      for (const row of existing ?? []) {
        known.add(row.url)
        existingByUrl.set(row.url, row as ExistingRow)
      }
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

      // Seed upgrade: a known/watch seed whose URL is already owned by an
      // aggregator row fills that row's missing/stale deadline instead of being
      // silently dropped. Without this, hand-curated Tier A events stay invisible
      // forever behind a deadline-less MLH/Devpost row.
      const patchNow = new Date()
      for (const seed of gathered) {
        const existing = existingByUrl.get(seed.url)
        if (!existing) continue
        const patch = buildSeedPatch(existing, seed, patchNow)
        if (!patch) continue
        const { error: patchError } = await db
          .from('hackathons')
          .update(patch)
          .eq('id', existing.id)
        if (!patchError) summary.seed_patched = (summary.seed_patched ?? 0) + 1
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
    // Verified policy for this circuit, if anyone has read one. Most flagship
    // sites are JS shells (1–3 words of server-rendered text), so the page
    // extraction below usually comes back with a null scope and the registry is
    // the only place the geography can come from.
    const circuitPolicy = circuitTravelPolicy({
      source: row.source,
      title: row.title,
      url: row.url,
      format: effectiveFormat,
    })

    const travel =
      extracted.travel_covered !== null && extracted.travel_covered !== undefined
        ? extracted.travel_covered
        : circuitPolicy
          ? circuitPolicy.scope !== 'none'
          : circuitTravel

    // Precedence throughout: what the page said > what the registry verified >
    // nothing. The page is per-edition truth; the registry is a standing fact.
    const travelScope = extracted.travel_scope ?? circuitPolicy?.scope ?? null
    const travelRegions =
      extracted.travel_regions.length > 0
        ? extracted.travel_regions
        : (circuitPolicy?.regions ?? [])
    const travelCap = extracted.travel_cap ?? circuitPolicy?.cap ?? null
    const travelNotes =
      extracted.travel_notes ?? (circuitPolicy ? circuitPolicy.quote.slice(0, 160) : null)

    // Always encode policy into themes so scoring works without migration 0003.
    const baseThemes =
      extracted.themes.length > 0
        ? extracted.themes
        : row.themes ?? []
    const themesWithPolicy = encodeTravelPolicyThemes(baseThemes, {
      travel_scope: travelScope,
      travel_regions: travelRegions,
      travel_cap: travelCap,
      travel_notes: travelNotes,
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
      travel_scope: travelScope,
      travel_regions: travelRegions,
      travel_cap: travelCap,
      travel_notes: travelNotes,
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

  // ── Travel policy backfill ────────────────────────────────────────────────
  // Rows already enriched are never revisited (a Tier A row has
  // travel_covered = true, so it matches no re-enrich condition). Without this
  // pass, a policy verified today would only reach events inserted tomorrow —
  // every event already in the catalog would keep a null scope, which is what
  // left the Travel filter matching 0 of 555 rows. No LLM, no fetch: registry
  // → row, so it is cheap enough to run every ingest and self-heals whenever
  // the registry gains evidence.
  if (!outOfTime()) {
    const { data: upcoming } = await db
      .from('hackathons')
      .select('id, title, url, source, format, themes, travel_covered')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(POLICY_BACKFILL_SCAN)

    for (const raw of upcoming ?? []) {
      if (outOfTime()) break
      const row = coerceHackathon(raw as Record<string, unknown>)
      const policy = circuitTravelPolicy({
        source: row.source,
        title: row.title,
        url: row.url,
        format: row.format,
      })
      if (!policy) continue
      const patch = buildTravelPolicyPatch(
        { id: row.id, themes: row.themes ?? [], travel_covered: row.travel_covered },
        policy
      )
      if (!patch) continue
      const { error } = await db.from('hackathons').update(patch).eq('id', row.id)
      if (!error) summary.policy_backfilled = (summary.policy_backfilled ?? 0) + 1
    }
  }

  if (sendNotifications) {
    // ── Daily digest ────────────────────────────────────────────────────────
    // One push per user per day summarising what appeared, instead of one push
    // per event. Suppressed entirely unless something new is IRL / multi-day /
    // travel-covered. `notified_at` marks a row as "already accounted for in a
    // digest"; rows stay null (and accumulate) until a digest actually goes out.
    const goneSubscriptionIds: string[] = []
    const now = new Date()

    const { data: fresh } = await db
      .from('hackathons')
      .select('*')
      .is('notified_at', null)
      .not('enriched_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(DIGEST_CANDIDATES)

    // Newest-first ordering matters: if the backlog ever exceeds the limit, the
    // rows we might announce are always the ones inside the window.
    const candidates = (fresh ?? []).map((r) => coerceHackathon(r as Record<string, unknown>))
    const freshRows = candidates.filter((h) => isUpcomingAndOpen(h))

    if (candidates.length > 0) {
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

      // One digest per user, delivered to each of that user's devices.
      const subscriptionsByUser = new Map<string, typeof subscriptions>()
      for (const subscription of subscriptions ?? []) {
        const list = subscriptionsByUser.get(subscription.user_id) ?? []
        list.push(subscription)
        subscriptionsByUser.set(subscription.user_id, list)
      }

      let digestSent = false

      for (const [userId, userSubscriptions] of subscriptionsByUser) {
        if (outOfTime()) break
        const settings = preferencesByUser.get(userId) ?? DEFAULT_NOTIFICATION_SETTINGS
        if (!settings.enabled) continue
        if (!shouldSendDigest(settings.last_digest_at, now)) {
          if (summary.digest !== 'sent') summary.digest = 'gated'
          continue
        }

        // The user's own score threshold still applies; the tag gate is on top.
        const scorePrefs = {
          priority_countries: settings.priority_countries,
          home_base: settings.home_base,
        }
        const forUser = freshRows.filter(
          (h) => scoreHackathon(h, now, scorePrefs).score >= settings.min_score
        )
        const counts = summarizeDigest(forUser, settings.home_base)
        const payload = buildDigestPayload(counts)
        if (!payload) {
          if (summary.digest !== 'sent') summary.digest = 'nothing_qualified'
          continue
        }

        let delivered = false
        for (const subscription of userSubscriptions ?? []) {
          const result = await sendPush(subscription.subscription, { ...payload, url: '/' })
          if (result === 'sent') {
            summary.notified++
            delivered = true
          }
          if (result === 'gone') goneSubscriptionIds.push(subscription.id)
        }

        // Only burn the digest if a push actually landed. Missing VAPID keys
        // ('unconfigured') or a transient failure must not stamp the clock and
        // mark the events read — they roll into the next run instead.
        if (!delivered) continue

        digestSent = true
        summary.digest = 'sent'

        // Stamp the digest clock inside the settings jsonb (no migration).
        await db.from('user_preferences').upsert(
          {
            user_id: userId,
            notification_settings: { ...settings, last_digest_at: now.toISOString() },
          },
          { onConflict: 'user_id' }
        )
      }

      // Mark every considered row — including ones that did not qualify — so the
      // candidate window keeps moving instead of silting up with permanent
      // non-qualifiers. Only once a digest actually went out; otherwise events
      // accumulate for the next one.
      if (digestSent) {
        for (const idChunk of chunk(candidates.map((h) => h.id), URL_CHUNK)) {
          await db
            .from('hackathons')
            .update({ notified_at: now.toISOString() })
            .in('id', idChunk)
        }
      }
    } else {
      summary.digest = 'nothing_new'
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
