#!/usr/bin/env node
/**
 * Weekly watch-agent: HEAD/GET official URLs for annual mega events.
 * Reports which watch pages are reachable (registration season check).
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar-WatchAgent/1.0)'

const watches = [
  { id: 'smart-india-hackathon', url: 'https://www.sih.gov.in/' },
  { id: 'adventurex', url: 'https://adventure-x.org/en' },
  { id: 'nasa-space-apps', url: 'https://www.spaceappschallenge.org/' },
  {
    id: 'google-solution-challenge',
    url: 'https://developers.google.com/community/gdsc-solution-challenge',
  },
  {
    id: 'singapore-india-hackathon',
    url: 'https://iie.smu.edu.sg/singapore-india-hackathon-2026',
  },
  { id: 'hackust', url: 'https://hack.ust.hk/' },
  { id: 'nus-hacknroll', url: 'https://hacknroll.nushackers.org/' },
  { id: 'junction', url: 'https://www.hackjunction.com/' },
  { id: 'codefest-sg', url: 'https://www.scs.org.sg/' },
]

const results = []
for (const w of watches) {
  const started = Date.now()
  try {
    const res = await fetch(w.url, {
      method: 'GET',
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    const text = await res.text()
    const lower = text.toLowerCase()
    const signals = []
    if (/registr|apply now|applications open|submit/.test(lower)) signals.push('reg_language')
    if (/hackathon/.test(lower)) signals.push('mentions_hackathon')
    if (/2026|2027/.test(text)) signals.push('has_year')
    results.push({
      id: w.id,
      url: w.url,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      bytes: text.length,
      signals,
    })
    console.log(
      `${res.ok ? 'OK' : 'FAIL'} ${w.id.padEnd(28)} HTTP ${res.status} signals=${signals.join(',') || '—'}`
    )
  } catch (e) {
    results.push({
      id: w.id,
      url: w.url,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    })
    console.log(`FAIL ${w.id}: ${e instanceof Error ? e.message : e}`)
  }
}

const fs = await import('node:fs')
const out = { probed_at: new Date().toISOString(), results }
fs.writeFileSync('watch-probe-results.json', JSON.stringify(out, null, 2))
console.log('\nWrote watch-probe-results.json')
