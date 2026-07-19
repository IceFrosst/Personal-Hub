#!/usr/bin/env node
/** Individual Tier A/B checkers — keep URLs in sync with lib/travel-priority.ts */

const UA = 'Mozilla/5.0 (compatible; EventRadar-TravelPriority/1.0)'

const CIRCUITS = [
  // Tier A
  { id: 'hackmit', tier: 'A', url: 'https://hackmit.org/', paths: ['/faq', '/travel'] },
  { id: 'treehacks', tier: 'A', url: 'https://treehacks.com/', paths: ['/faq', '/travel'] },
  { id: 'pennapps', tier: 'A', url: 'https://pennapps.com/', paths: ['/faq', '/travel'] },
  { id: 'hackthenorth', tier: 'A', url: 'https://hackthenorth.com/', paths: ['/faq', '/travel'] },
  { id: 'hackillinois', tier: 'A', url: 'https://www.hackillinois.org/', paths: ['/faq'] },
  { id: 'calhacks', tier: 'A', url: 'https://calhacks.io/', paths: ['/faq'] },
  { id: 'lahacks', tier: 'A', url: 'https://lahacks.com/', paths: ['/faq'] },
  { id: 'mhacks', tier: 'A', url: 'https://www.mhacks.org/', paths: ['/faq'] },
  { id: 'bitcamp', tier: 'A', url: 'https://bit.camp/', paths: ['/faq'] },
  { id: 'hackgt', tier: 'A', url: 'https://hack.gt/', paths: ['/faq'] },
  { id: 'hackprinceton', tier: 'A', url: 'https://hackprinceton.com/', paths: ['/faq'] },
  { id: 'boilermake', tier: 'A', url: 'https://boilermake.org/', paths: ['/faq'] },
  { id: 'nwhacks', tier: 'A', url: 'https://www.nwhacks.io/', paths: ['/faq'] },
  { id: 'uofthacks', tier: 'A', url: 'https://uofthacks.com/', paths: ['/faq'] },
  { id: 'hackduke', tier: 'A', url: 'https://hackduke.org/', paths: ['/faq'] },
  // Tier B NA
  { id: 'hackny', tier: 'B', url: 'https://hackny.org/', paths: ['/faq'] },
  { id: 'hacktx', tier: 'B', url: 'https://hacktx.com/', paths: ['/faq'] },
  { id: 'shellhacks', tier: 'B', url: 'https://shellhacks.net/', paths: ['/faq'] },
  { id: 'knighthacks', tier: 'B', url: 'https://knighthacks.org/', paths: ['/faq'] },
  { id: 'tartanhacks', tier: 'B', url: 'https://tartanhacks.com/', paths: ['/faq'] },
  { id: 'vandyhacks', tier: 'B', url: 'https://www.vandyhacks.org/', paths: ['/faq'] },
  { id: 'hophacks', tier: 'B', url: 'https://hophacks.com/', paths: ['/faq'] },
  { id: 'hackru', tier: 'B', url: 'https://hackru.org/', paths: ['/faq'] },
  { id: 'dubhacks', tier: 'B', url: 'https://dubhacks.co/', paths: ['/faq'] },
  // Tier B EU
  { id: 'junction', tier: 'B', url: 'https://www.hackjunction.com/', paths: ['/faq', '/travel'] },
  { id: 'starthack', tier: 'B', url: 'https://www.starthack.eu/', paths: ['/faq'] },
  { id: 'hackupc', tier: 'B', url: 'https://hackupc.com/', paths: ['/faq'] },
  { id: 'hackzurich', tier: 'B', url: 'https://hackzurich.com/', paths: ['/faq'] },
  { id: 'vhacks', tier: 'B', url: 'https://www.vhacks.org/', paths: ['/faq'] },
  { id: 'hackcambridge', tier: 'B', url: 'https://hackcambridge.com/', paths: ['/faq'] },
  { id: 'ethglobal', tier: 'B', url: 'https://ethglobal.com/events', paths: [] },
  { id: 'encode', tier: 'B', url: 'https://www.encode.club/', paths: [] },
  { id: 'cassini', tier: 'B', url: 'https://www.cassini.eu/hackathons', paths: [] },
  { id: 'eudis', tier: 'B', url: 'https://www.eudis.eu/', paths: [] },
  { id: 'copernicus', tier: 'B', url: 'https://www.copernicus.eu/', paths: [] },
  // Asia / Oceania / web3
  { id: 'adventurex', tier: 'B', url: 'https://adventure-x.org/en', paths: [] },
  { id: 'hackust', tier: 'B', url: 'https://hack.ust.hk/', paths: [] },
  { id: 'unihack', tier: 'B', url: 'https://unihack.net/', paths: ['/faq'] },
  { id: 'unearthed', tier: 'B', url: 'https://unearthed.solutions/', paths: [] },
  { id: 'easya', tier: 'B', url: 'https://www.easya.io/', paths: [] },
  { id: 'colosseum', tier: 'B', url: 'https://www.colosseum.com/', paths: [] },
  { id: 'superteam', tier: 'B', url: 'https://superteam.fun/', paths: [] },
  { id: 'dorahacks', tier: 'B', url: 'https://dorahacks.io/', paths: [] },
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
  if (/registr|apply now|applications? open|submit application/.test(lower))
    signals.push('reg_open_language')
  if (/travel\s*(reimburs|stipend|grant|support|covered)|reimburs.*travel/.test(lower))
    signals.push('travel_language')
  if (/hackathon|hacker/.test(lower)) signals.push('hackathon')
  if (/2026|2027/.test(text)) signals.push('has_year')
  if (/closed|applications? closed|registration closed/.test(lower)) signals.push('maybe_closed')
  return signals
}

const results = []
for (const c of CIRCUITS) {
  const started = Date.now()
  try {
    const main = await fetchText(c.url)
    const pages = [{ path: '/', ...main, signals: signalsFrom(main.text) }]
    const base = c.url.replace(/\/?$/, '')
    for (const path of c.paths.slice(0, 2)) {
      try {
        const extra = await fetchText(`${base}${path}`)
        if (extra.ok && extra.text.length > 200)
          pages.push({ path, ...extra, signals: signalsFrom(extra.text) })
      } catch {
        /* ignore */
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
      `${mark} ${c.tier} ${c.id.padEnd(16)} HTTP ${pages[0]?.status ?? 0} ${allSignals.join(',') || '—'}${alert}`
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
  total: results.length,
  ok: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
  reg_alerts: alerts,
  results,
}
const fs = await import('node:fs')
fs.writeFileSync('travel-priority-probe.json', JSON.stringify(summary, null, 2))
console.log(
  `\nSummary: ${summary.total} circuits, ${summary.ok} ok, ${summary.fail} fail, reg alerts: ${alerts.join(', ') || 'none'}`
)
