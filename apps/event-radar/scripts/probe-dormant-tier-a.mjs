#!/usr/bin/env node
/**
 * Watch dormant Tier A circuits for NEXT cycle registration only.
 * Never invent events — only alert when apply/reg language is live for the next year.
 */
const UA = 'Mozilla/5.0 (compatible; EventRadar-DormantTierA/1.0)'

const DORMANT = [
  {
    id: 'treehacks',
    url: 'https://treehacks.com/',
    paths: ['/', 'https://trunk.treehacks.com/'],
    staleYear: '2026',
    nextYear: '2027',
  },
  {
    id: 'pennapps',
    url: 'https://pennapps.com/',
    paths: ['/', 'https://apply.pennapps.com/'],
    staleYear: '2025',
    nextYear: '2026',
  },
  {
    id: 'hackupc',
    url: 'https://hackupc.com/',
    paths: ['/', 'https://my.hackupc.com/'],
    staleYear: '2026',
    nextYear: '2027',
  },
]

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  })
  return { ok: res.ok, status: res.status, text: await res.text(), url }
}

function analyze(text, staleYear, nextYear) {
  const lower = text.toLowerCase()
  const signals = []
  if (/applications?\s+are\s+now\s+open|apply\s+now|registration\s+open|apps?\s+open/i.test(text))
    signals.push('reg_open_language')
  if (/applications?\s+(have\s+)?already\s+closed|applications?\s+closed|registration\s+closed/i.test(text))
    signals.push('reg_closed_language')
  if (new RegExp(nextYear).test(text)) signals.push(`mentions_${nextYear}`)
  if (new RegExp(staleYear).test(text) && !new RegExp(nextYear).test(text))
    signals.push(`stale_year_${staleYear}_only`)
  if (/travel|reimburs|half of (your )?travel|€\s*\d+/i.test(lower))
    signals.push('travel_language')
  return signals
}

const results = []
for (const d of DORMANT) {
  const pages = []
  for (const p of d.paths) {
    const url = p.startsWith('http') ? p : new URL(p, d.url).href
    try {
      const r = await fetchText(url)
      pages.push({ ...r, signals: analyze(r.text, d.staleYear, d.nextYear) })
    } catch (e) {
      pages.push({ ok: false, url, error: String(e), signals: [] })
    }
  }
  const all = [...new Set(pages.flatMap((p) => p.signals))]
  // Alert only when next-year cycle looks open, not stale leftover Apply buttons
  const alert =
    all.includes('reg_open_language') &&
    !all.includes('reg_closed_language') &&
    all.includes(`mentions_${d.nextYear}`) &&
    !all.includes(`stale_year_${d.staleYear}_only`)

  results.push({
    id: d.id,
    alert,
    signals: all,
    pages: pages.map((p) => ({
      url: p.url,
      status: p.status,
      ok: p.ok,
      signals: p.signals,
    })),
  })
  console.log(
    `${alert ? 'ALERT REG OPEN?' : 'dormant'} ${d.id.padEnd(12)} ${all.join(',') || '—'}`
  )
}

const fs = await import('node:fs')
fs.writeFileSync(
  'dormant-tier-a-probe.json',
  JSON.stringify({ probed_at: new Date().toISOString(), results }, null, 2)
)
const alerts = results.filter((r) => r.alert).map((r) => r.id)
console.log(`\nReg-open alerts: ${alerts.join(', ') || 'none'}`)
