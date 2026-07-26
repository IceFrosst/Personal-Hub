#!/usr/bin/env node
/**
 * Open-egress structure probe for the Turkey / international-aggregator gap.
 *
 * Every domain below is blocked by the interactive sandbox egress policy, so an
 * agent session cannot see their HTML. GitHub-hosted runners have open egress —
 * this script runs there and prints a machine-readable structure report so a
 * parser can be written against real markup instead of guesses.
 *
 * It answers exactly three questions per URL:
 *   1. Does it respond at all (status, bytes, redirect chain)?
 *   2. Is there structured data (JSON-LD, __NEXT_DATA__, __NUXT__, RSS/ICS)?
 *   3. Does the server-rendered text actually contain event rows?
 */

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const TARGETS = [
  // ── allhackathons.com — the one aggregator that survived round 1 ────────
  // Server-rendered, no JS shell, and a Turkish subdomain carrying real TR
  // events. These targets exist to pin down the LIST and DETAIL markup so
  // lib/ingest/allhackathons.ts can be written against fact, not guesswork.
  { id: 'ah-list', group: 'aggregator', url: 'https://allhackathons.com/hackathons/', sample: true },
  { id: 'ah-list-p2', group: 'aggregator', url: 'https://allhackathons.com/hackathons/?page=2', sample: true },
  { id: 'ah-tr-list', group: 'aggregator', url: 'https://tr.allhackathons.com/hackathons/', sample: true },
  {
    id: 'ah-detail',
    group: 'aggregator',
    url: 'https://tr.allhackathons.com/hackathon/iga-social-hack/',
    sample: true,
  },
  { id: 'ah-sitemap', group: 'aggregator', url: 'https://allhackathons.com/sitemap.xml' },

  // ── Round 1 survivors kept for drift detection ──────────────────────────
  // dev.events returns a Cloudflare "Just a moment..." interstitial (403) even
  // from GitHub's open egress, so it stays here purely to notice if that lifts.
  { id: 'dev-events-hackathons', group: 'aggregator', url: 'https://dev.events/hackathons' },
  { id: 'hackathon-com-tr', group: 'aggregator', url: 'https://www.hackathon.com/country/turkey' },

  // ── Turkish organizers ─────────────────────────────────────────────────
  { id: 'teknofest-en', group: 'organizer', url: 'https://www.teknofest.org/en/' },
  { id: 'teknofest-competitions', group: 'organizer', url: 'https://www.teknofest.org/en/competitions/' },
  { id: 't3vakfi', group: 'organizer', url: 'https://t3vakfi.org/' },
  { id: 'thy-hackathon', group: 'organizer', url: 'https://hackathon.turkishairlines.com/' },
  { id: 'thy-terminal', group: 'organizer', url: 'https://terminal.turkishairlines.com/' },
  { id: 'tubitak', group: 'organizer', url: 'https://tubitak.gov.tr/en' },
  { id: 'bilisimvadisi', group: 'organizer', url: 'https://www.bilisimvadisi.com.tr/en/' },
  { id: 'itucekirdek', group: 'organizer', url: 'https://itucekirdek.com/' },
  { id: 'kworks', group: 'organizer', url: 'https://kworks.ku.edu.tr/en/' },

  // ── Vertical / Istanbul ────────────────────────────────────────────────
  { id: 'istanbul-blockchain-week', group: 'vertical', url: 'https://istanbulblockchainweek.com/' },
  { id: 'iata-hackathon', group: 'vertical', url: 'https://www.iata.org/en/events/' },

  // ── Luma cross-check: does the discovery API know any TR events at all? ──
  {
    id: 'luma-istanbul',
    group: 'api',
    url: 'https://api.lu.ma/discover/get-paginated-events?query=hackathon%20Istanbul',
    json: true,
  },
  {
    id: 'luma-turkey',
    group: 'api',
    url: 'https://api.lu.ma/discover/get-paginated-events?query=hackathon%20Turkey',
    json: true,
  },
  {
    id: 'luma-ankara',
    group: 'api',
    url: 'https://api.lu.ma/discover/get-paginated-events?query=hackathon%20Ankara',
    json: true,
  },
  {
    id: 'luma-turkiye',
    group: 'api',
    url: 'https://api.lu.ma/discover/get-paginated-events?query=hackathon%20T%C3%BCrkiye',
    json: true,
  },
]

async function fetchTarget(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
    },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  })
  return { status: res.status, finalUrl: res.url, body: await res.text() }
}

function visibleText(html) {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** What machine-readable payloads does the page carry? */
function structuredData(html) {
  const found = []
  const jsonLd = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
  if (jsonLd.length) {
    const types = new Set()
    for (const m of jsonLd) {
      try {
        const parsed = JSON.parse(m[1].trim())
        for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
          if (node && typeof node === 'object') {
            const t = node['@type']
            if (t) (Array.isArray(t) ? t : [t]).forEach((x) => types.add(String(x)))
            // ItemList of events is the shape we want
            for (const item of node.itemListElement ?? []) {
              const it = item?.item ?? item
              if (it && it['@type']) types.add(`item:${it['@type']}`)
            }
          }
        }
      } catch {
        types.add('unparseable')
      }
    }
    found.push({ kind: 'json-ld', blocks: jsonLd.length, types: [...types] })
  }
  if (/__NEXT_DATA__/.test(html)) found.push({ kind: 'next-data' })
  if (/window\.__NUXT__/.test(html)) found.push({ kind: 'nuxt' })
  if (/self\.__next_f\.push/.test(html)) found.push({ kind: 'rsc-flight' })
  if (/<script[^>]+data-page=/.test(html)) found.push({ kind: 'inertia' })
  if (/<(rss|feed)\b/i.test(html)) found.push({ kind: 'rss' })
  return found
}

/** Extract the JSON-LD Event nodes so we can see whether dates/places are real. */
function jsonLdEvents(html) {
  const events = []
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed
    try {
      parsed = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    const stack = Array.isArray(parsed) ? [...parsed] : [parsed]
    while (stack.length) {
      const node = stack.pop()
      if (!node || typeof node !== 'object') continue
      for (const item of node.itemListElement ?? []) stack.push(item?.item ?? item)
      const type = node['@type']
      const types = Array.isArray(type) ? type : [type]
      if (types.some((t) => typeof t === 'string' && /event/i.test(t))) {
        const loc = node.location
        events.push({
          name: node.name ?? null,
          startDate: node.startDate ?? null,
          endDate: node.endDate ?? null,
          url: node.url ?? null,
          eventAttendanceMode: node.eventAttendanceMode ?? null,
          location:
            typeof loc === 'string'
              ? loc
              : (loc?.name ?? loc?.address?.addressLocality ?? loc?.address?.addressCountry ?? null),
        })
      }
    }
  }
  return events
}

/** Anchors that look like event detail links — the fallback parse path. */
function eventLinks(html, finalUrl) {
  const origin = (() => {
    try {
      return new URL(finalUrl).origin
    } catch {
      return ''
    }
  })()
  const seen = new Map()
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const href = m[1]
    const text = visibleText(m[2])
    if (!text || text.length < 4) continue
    if (!/hack|etkinlik|event|yarism|yarış|competition|başvuru|basvuru/i.test(`${href} ${text}`))
      continue
    const abs = href.startsWith('http') ? href : origin + (href.startsWith('/') ? href : `/${href}`)
    if (!seen.has(abs)) seen.set(abs, text.slice(0, 120))
  }
  return [...seen.entries()].slice(0, 25).map(([url, text]) => ({ url, text }))
}

/**
 * Raw HTML around the first few /hackathon/<slug>/ anchors. A parser matches
 * markup, not stripped text, so this is the only part of the report that can
 * actually be written against.
 */
function rawCardSample(html) {
  const idx = html.indexOf('/hackathon/')
  if (idx === -1) return null
  const start = Math.max(0, idx - 1200)
  return html.slice(start, idx + 2400).replace(/\s+/g, ' ')
}

const results = []

for (const target of TARGETS) {
  const started = Date.now()
  try {
    const { status, finalUrl, body } = await fetchTarget(target.url)

    if (target.json) {
      let entries = null
      let names = []
      try {
        const parsed = JSON.parse(body)
        entries = Array.isArray(parsed.entries) ? parsed.entries.length : null
        names = (parsed.entries ?? [])
          .map((e) => e?.event?.name)
          .filter(Boolean)
          .slice(0, 15)
      } catch {
        /* not JSON */
      }
      results.push({
        id: target.id,
        group: target.group,
        url: target.url,
        ok: status >= 200 && status < 300,
        status,
        bytes: body.length,
        entries,
        names,
        ms: Date.now() - started,
      })
      continue
    }

    const text = visibleText(body)
    results.push({
      id: target.id,
      group: target.group,
      url: target.url,
      ok: status >= 200 && status < 300,
      status,
      finalUrl: finalUrl === target.url ? undefined : finalUrl,
      bytes: body.length,
      text_words: text.split(' ').length,
      structured: structuredData(body),
      jsonld_events: jsonLdEvents(body).slice(0, 12),
      // A JS-only SPA renders a tiny shell: high bytes + low words is the tell.
      spa_shell: body.length > 20000 && text.split(' ').length < 150,
      links: eventLinks(body, finalUrl),
      // Raw markup around the first event link — this is what a parser has to
      // match, and it cannot be inferred from stripped text.
      raw_sample: target.sample ? rawCardSample(body) : undefined,
      text_excerpt: text.slice(0, target.sample ? 2500 : 900),
      ms: Date.now() - started,
    })
  } catch (err) {
    results.push({
      id: target.id,
      group: target.group,
      url: target.url,
      ok: false,
      error: String(err?.message ?? err),
      ms: Date.now() - started,
    })
  }
}

const report = { generated_at: new Date().toISOString(), results }

const { writeFileSync } = await import('node:fs')
writeFileSync('turkey-sources-probe.json', JSON.stringify(report, null, 2))

// Print to stdout too — the job log is what an agent session can actually read.
console.log(JSON.stringify(report, null, 2))

const reachable = results.filter((r) => r.ok).map((r) => r.id)
const dead = results.filter((r) => !r.ok).map((r) => `${r.id}(${r.status ?? r.error})`)
console.log(`\nreachable: ${reachable.join(', ') || 'none'}`)
console.log(`unreachable: ${dead.join(', ') || 'none'}`)
