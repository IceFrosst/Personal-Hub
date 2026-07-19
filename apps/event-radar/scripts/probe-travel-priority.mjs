#!/usr/bin/env node
/** Individual site checkers — sync with lib/travel-priority.ts */
const UA = 'Mozilla/5.0 (compatible; EventRadar-TravelPriority/1.0)'

const CIRCUITS = [
  { id: 'hackmit', tier: 'A', url: 'https://hackmit.org/', paths: ['/faq', '/travel'] },
  { id: 'treehacks', tier: 'A', url: 'https://treehacks.com/', paths: ['/faq'] },
  { id: 'pennapps', tier: 'A', url: 'https://pennapps.com/', paths: ['/faq'] },
  { id: 'hackthenorth', tier: 'A', url: 'https://hackthenorth.com/', paths: ['/travel-guidelines'] },
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
  // research batch Tier A
  { id: 'yhack', tier: 'A', url: 'https://yhack.org/', paths: ['/faq'] },
  { id: 'conuhacks', tier: 'A', url: 'https://www.conuhacks.io/', paths: ['/faq'] },
  { id: 'technica', tier: 'A', url: 'https://gotechnica.org/', paths: ['/faq', '/travel'] },
  { id: 'bigredhacks', tier: 'A', url: 'https://www.bigredhacks.com/', paths: ['/faq'] },
  { id: 'hacksc', tier: 'A', url: 'https://hacksc.com/', paths: ['/faq'] },
  // Tier B sample high-signal
  { id: 'junction', tier: 'B', url: 'https://www.hackjunction.com/', paths: ['/faq'] },
  { id: 'hackupc', tier: 'B', url: 'https://hackupc.com/', paths: ['/faq'] },
  { id: 'ethglobal', tier: 'B', url: 'https://ethglobal.com/events', paths: [] },
  { id: 'isro-bah', tier: 'B', url: 'https://hack2skill.com/event/bah2026/', paths: [] },
  { id: 'mchacks', tier: 'B', url: 'https://mchacks.ca/', paths: ['/faq'] },
  { id: 'pearlhacks', tier: 'B', url: 'https://pearlhacks.com/', paths: ['/faq'] },
  { id: 'hackzurich', tier: 'B', url: 'https://hackzurich.com/', paths: ['/faq'] },
  { id: 'adventurex', tier: 'B', url: 'https://adventure-x.org/en', paths: [] },
]

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

function signalsFrom(text) {
  const lower = text.toLowerCase()
  const signals = []
  if (/registr|apply now|applications? open/.test(lower)) signals.push('reg_open_language')
  if (/travel\s*(reimburs|stipend|grant|support|covered)|reimburs.*travel|food and travel/.test(lower))
    signals.push('travel_language')
  if (/2026|2027/.test(text)) signals.push('has_year')
  if (/not able to provide travel|no travel reimburs/.test(lower)) signals.push('explicit_no_travel')
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
      } catch {}
    }
    const allSignals = [...new Set(pages.flatMap((p) => p.signals))]
    results.push({
      id: c.id,
      tier: c.tier,
      ok: pages.some((p) => p.ok),
      signals: allSignals,
      alert: allSignals.includes('reg_open_language'),
      travel_hit: allSignals.includes('travel_language'),
      ms: Date.now() - started,
    })
    console.log(
      `${pages.some((p) => p.ok) ? 'OK' : 'FAIL'} ${c.tier} ${c.id.padEnd(14)} ${allSignals.join(',') || '—'}`
    )
  } catch (e) {
    results.push({ id: c.id, tier: c.tier, ok: false, error: String(e) })
    console.log(`FAIL ${c.tier} ${c.id}`)
  }
}

const fs = await import('node:fs')
fs.writeFileSync(
  'travel-priority-probe.json',
  JSON.stringify({ probed_at: new Date().toISOString(), results }, null, 2)
)
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} ok`)
