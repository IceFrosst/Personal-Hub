#!/usr/bin/env node
/**
 * Individual Tier A/B checkers — one probe per travel-priority circuit.
 * Hits official homepage + common FAQ/travel paths. Looks for registration
 * language and year so we notice when apps open (not only when MLH lists them).
 *
 * Run via GitHub Actions (open egress). Output: travel-priority-probe.json
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar-TravelPriority/1.0)'

/** Keep in sync with lib/travel-priority.ts TRAVEL_PRIORITY */
const CIRCUITS = [
  { id: 'hackmit', tier: 'A', url: 'https://hackmit.org/', paths: ['/faq', '/travel', '/logistics'] },
  { id: 'treehacks', tier: 'A', url: 'https://treehacks.com/', paths: ['/faq', '/travel'] },
  { id: 'pennapps', tier: 'A', url: 'https://pennapps.com/', paths: ['/faq', '/travel'] },
  { id: 'hackthenorth', tier: 'A', url: 'https://hackthenorth.com/', paths: ['/faq', '/travel'] },
  { id: 'hackillinois', tier: 'A', url: 'https://www.hackillinois.org/', paths: ['/faq', '/travel'] },
  { id: 'calhacks', tier: 'A', url: 'https://calhacks.io/', paths: ['/faq', '/travel'] },
  { id: 'lahacks', tier: 'A', url: 'https://lahacks.com/', paths: ['/faq', '/travel'] },
  { id: 'mhacks', tier: 'A', url: 'https://www.mhacks.org/', paths: ['/faq', '/travel'] },
  { id: 'bitcamp', tier: 'A', url: 'https://bit.camp/', paths: ['/faq', '/travel'] },
  { id: 'hackgt', tier: 'A', url: 'https://hack.gt/', paths: ['/faq', '/travel'] },
  { id: 'junction', tier: 'B', url: 'https://www.hackjunction.com/', paths: ['/faq', '/travel', '/info'] },
  { id: 'starthack', tier: 'B', url: 'https://www.starthack.eu/', paths: ['/faq', '/travel'] },
  { id: 'hackupc', tier: 'B', url: 'https://hackupc.com/', paths: ['/faq', '/travel'] },
  { id: 'ethglobal', tier: 'B', url: 'https://ethglobal.com/events', paths: [] },
  { id: 'encode', tier: 'B', url: 'https://www.encode.club/', paths: ['/faq'] },
  { id: 'cassini', tier: 'B', url: 'https://www.cassini.eu/hackathons', paths: [] },
  { id: 'eudis', tier: 'B', url: 'https://www.eudis.eu/', paths: [] },
  { id: 'copernicus', tier: 'B', url: 'https://www.copernicus.eu/', paths: [] },
]

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, text }
}

function signalsFrom(text) {
  const lower = text.toLowerCase()
  const signals = []
  if (/registr|apply now|applications? open|submit application|applications? are open/.test(lower))
    signals.push('reg_open_language')
  if (/travel\s*(reimburs|stipend|grant|support|covered)|reimburs.*travel|we (cover|reimburse) travel/.test(lower))
    signals.push('travel_language')
  if (/hackathon|hacker/.test(lower)) signals.push('hackathon')
  if (/2026|2027/.test(text)) signals.push('has_year')
  if (/closed|applications? closed|registration closed/.test(lower)) signals.push('maybe_closed')
  return signals
}

const results = []

for (const c of CIRCUITS) {
  const started = Date.now()
  const pages = []
  try {
    const main = await fetchText(c.url)
    pages.push({ path: '/', ...main, signals: signalsFrom(main.text) })

    const base = c.url.replace(/\/?$/, '')
    for (const path of c.paths.slice(0, 2)) {
      try {
        const extra = await fetchText(`${base}${path}`)
        if (extra.ok && extra.text.length > 200) {
          pages.push({ path, ...extra, signals: signalsFrom(extra.text) })
        }
      } catch {
        /* ignore secondary path */
      }
    }

    const allSignals = [...new Set(pages.flatMap((p) => p.signals))]
    const ok = pages.some((p) => p.ok)
    results.push({
      id: c.id,
      tier: c.tier,
      url: c.url,
      ok,
      ms: Date.now() - started,
      pages: pages.map((p) => ({
        path: p.path,
        status: p.status,
        bytes: p.text.length,
        signals: p.signals,
      })),
      signals: allSignals,
      alert: allSignals.includes('reg_open_language') && !allSignals.includes('maybe_closed'),
    })

    const mark = ok ? 'OK  ' : 'FAIL'
    const alert = allSignals.includes('reg_open_language') ? ' [REG?]' : ''
    console.log(
      `${mark} ${c.tier} ${c.id.padEnd(14)} HTTP ${pages[0]?.status ?? 0} signals=${allSignals.join(',') || '—'}${alert}`
    )
  } catch (e) {
    results.push({
      id: c.id,
      tier: c.tier,
      url: c.url,
      ok: false,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
      signals: [],
      alert: false,
    })
    console.log(`FAIL ${c.tier} ${c.id}: ${e instanceof Error ? e.message : e}`)
  }
}

const alerts = results.filter((r) => r.alert).map((r) => r.id)
const summary = {
  probed_at: new Date().toISOString(),
  ok: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
  reg_alerts: alerts,
  results,
}

const fs = await import('node:fs')
fs.writeFileSync('travel-priority-probe.json', JSON.stringify(summary, null, 2))
console.log(`\nSummary: ${summary.ok} ok, ${summary.fail} fail, reg alerts: ${alerts.join(', ') || 'none'}`)
console.log('Wrote travel-priority-probe.json')
