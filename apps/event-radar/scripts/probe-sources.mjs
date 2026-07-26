#!/usr/bin/env node
/**
 * Probe every Event Radar source API from an environment with open egress
 * (GitHub Actions ubuntu-latest). Writes probe-results.json for artifacts.
 *
 * Usage: node apps/event-radar/scripts/probe-sources.mjs
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar-Probe/1.0)'

const probes = [
  {
    id: 'devpost',
    url: 'https://devpost.com/api/hackathons?page=1&status[]=upcoming&status[]=open',
  },
  {
    id: 'luma',
    url: 'https://api.lu.ma/discover/get-paginated-events?query=hackathon',
  },
  {
    id: 'luma-singapore',
    url: 'https://api.lu.ma/discover/get-paginated-events?query=hackathon%20Singapore',
  },
  {
    id: 'devfolio',
    method: 'POST',
    url: 'https://api.devfolio.co/api/search/hackathons',
    body: { type: 'application_open', from: 0, size: 5 },
  },
  {
    id: 'taikai',
    method: 'POST',
    url: 'https://api.taikai.network/api/graphql',
    body: {
      query: `query($now: DateTime!) {
        challenges(
          where: { isPublic: { equals: true }, endParticipantRegistrationDate: { gt: $now } }
          perPage: 5
        ) { slug name }
      }`,
      variables: { now: new Date().toISOString() },
    },
  },
  {
    id: 'dorahacks',
    url: 'https://dorahacks.io/api/hackathon/?page=1&page_size=5',
    headers: { Referer: 'https://dorahacks.io/hackathon' },
  },
  {
    id: 'unstop',
    url: 'https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&oppstatus=open&per_page=5&page=1',
  },
  {
    id: 'topcoder',
    url: 'https://api.topcoder.com/v5/challenges?status=Active&perPage=5&page=1',
  },
  {
    id: 'hackquest',
    method: 'POST',
    url: 'https://api.hackquest.io/graphql',
    body: {
      // Minimal probe — full query lives in hackquest.ts; any non-403 proves egress
      query: '{ __typename }',
    },
  },
  {
    id: 'ethglobal-site',
    url: 'https://ethglobal.com/events',
  },
  {
    id: 'mlh',
    url: 'https://www.mlh.com/seasons/2026/events',
  },
  {
    id: 'hackjunction',
    url: 'https://www.hackjunction.com/',
  },
  {
    id: 'spaceapps',
    url: 'https://www.spaceappschallenge.org/',
  },
  {
    id: 'sih',
    url: 'https://www.sih.gov.in/',
  },
  {
    id: 'adventurex',
    url: 'https://adventure-x.org/en',
  },
]

async function probeOne(p) {
  const started = Date.now()
  try {
    const res = await fetch(p.url, {
      method: p.method ?? 'GET',
      headers: {
        Accept: 'application/json, text/html, */*',
        'User-Agent': UA,
        ...(p.body ? { 'Content-Type': 'application/json' } : {}),
        ...(p.headers ?? {}),
      },
      body: p.body ? JSON.stringify(p.body) : undefined,
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    const ct = res.headers.get('content-type') ?? ''
    const text = await res.text()
    let hint = ''
    if (ct.includes('json')) {
      try {
        const j = JSON.parse(text)
        if (Array.isArray(j)) hint = `array len=${j.length}`
        else if (j.hackathons) hint = `hackathons=${j.hackathons.length}`
        else if (j.entries) hint = `entries=${j.entries.length}`
        else if (j.results) hint = `results=${j.results.length}`
        else if (j.data?.challenges) hint = `challenges=${j.data.challenges.length}`
        else if (j.hits?.hits) hint = `hits=${j.hits.hits.length}`
        else if (j.data?.data) hint = `data=${j.data.data.length}`
        else hint = `json keys=${Object.keys(j).slice(0, 8).join(',')}`
      } catch {
        hint = 'invalid-json'
      }
    } else {
      hint = `html/text bytes=${text.length}`
    }
    return {
      id: p.id,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      hint,
    }
  } catch (e) {
    return {
      id: p.id,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      hint: e instanceof Error ? e.message : String(e),
    }
  }
}

const results = []
for (const p of probes) {
  const r = await probeOne(p)
  results.push(r)
  const mark = r.ok ? 'OK ' : 'FAIL'
  console.log(`${mark} ${r.id.padEnd(16)} HTTP ${String(r.status).padStart(3)} ${r.ms}ms  ${r.hint}`)
}

const summary = {
  probed_at: new Date().toISOString(),
  ok: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
  results,
}

const fs = await import('node:fs')
fs.writeFileSync('probe-results.json', JSON.stringify(summary, null, 2))
console.log(`\nSummary: ${summary.ok} ok, ${summary.fail} fail → probe-results.json`)

// Non-zero exit if critical sources fail
const critical = ['devpost', 'luma', 'devfolio']
const criticalFail = results.filter((r) => critical.includes(r.id) && !r.ok)
if (criticalFail.length > 0) {
  console.error('Critical source failure:', criticalFail.map((r) => r.id).join(', '))
  process.exit(1)
}
