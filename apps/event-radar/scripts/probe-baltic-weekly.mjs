#!/usr/bin/env node
/**
 * Weekly priority-region discovery (open egress).
 * Batch 1 countries: Poland, Finland, Germany, Netherlands + Baltics organisers.
 */
import { writeFileSync } from 'node:fs'

const UA = 'Mozilla/5.0 (compatible; EventRadar-PriorityWeekly/1.0)'

const ORGANISERS = [
  // Baltics
  { id: 'jaunaragiai', label: 'Jaunaragiai / MAKE IT REAL', url: 'https://www.jaunaragiai.lt/en/make-it-real', country: 'LT' },
  { id: 'startup-lithuania', label: 'Startup Lithuania events', url: 'https://www.startuplithuania.com/events/', country: 'LT' },
  { id: 'garage48', label: 'Garage48', url: 'https://garage48.org/', country: 'EE' },
  { id: 'startup-day', label: 'sTARTUp Day', url: 'https://www.startupday.ee/', country: 'EE' },
  // Poland
  { id: 'hackyeah', label: 'HackYeah', url: 'https://hackyeah.pl/', country: 'PL' },
  { id: 'crossweb', label: 'Crossweb PL events', url: 'https://crossweb.pl/en/events/', country: 'PL' },
  // Finland
  { id: 'junction', label: 'Junction', url: 'https://www.hackjunction.com/', country: 'FI' },
  { id: 'junction-app', label: 'Junction platform', url: 'https://hackjunction.app/hackathons', country: 'FI' },
  // Germany
  { id: 'german-tech-jobs', label: 'GermanTechJobs events', url: 'https://germantechjobs.de/en/events', country: 'DE' },
  // Netherlands + EU circuit
  { id: 'edth-luma', label: 'EDTH Luma calendar', url: 'https://lu.ma/eurodefensetech', country: 'EU' },
  { id: 'eudis', label: 'EUDIS Defence Hackathon', url: 'https://eudis-hackathon.eu/', country: 'EU' },
  { id: 'mlh-2026', label: 'MLH 2026 season', url: 'https://mlh.io/seasons/2026/events', country: 'EU' },
  { id: 'mlh-2027', label: 'MLH 2027 season', url: 'https://mlh.io/seasons/2027/events', country: 'EU' },
]

const SOCIAL_QUERIES = [
  'hackathon (Vilnius OR Kaunas OR Lietuva OR Lithuania) (2026 OR 2027)',
  'hackathon (Warsaw OR Warszawa OR Kraków OR Krakow OR Wrocław OR Poland) (2026 OR 2027)',
  'hackathon (Helsinki OR Espoo OR Finland OR Junction) (2026 OR 2027)',
  'hackathon (Berlin OR Munich OR München OR Hamburg OR Germany) (2026 OR 2027)',
  'hackathon (Amsterdam OR Delft OR Eindhoven OR Netherlands) (2026 OR 2027)',
  '("HackYeah" OR Garage48 OR Jaunaragiai OR "MAKE IT REAL") (hackathon OR hakatonas)',
  'from:HackTrackEU (Vilnius OR Warsaw OR Berlin OR Amsterdam OR Helsinki)',
]

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text, url }
  } catch (e) {
    return { ok: false, status: 0, text: '', url, error: String(e) }
  }
}

function analyze(text) {
  const signals = []
  if (/applications?\s+are\s+now\s+open|apply\s+now|registration\s+open|register\s+now|apps?\s+open|registracija\s+vyksta|registruotis/i.test(text))
    signals.push('reg_open_language')
  if (/applications?\s+closed|registration\s+closed|already\s+closed|no more spaces|sold\s+out|the 2026 hackathon is already closed/i.test(text))
    signals.push('reg_closed_language')
  if (/hackathon|hakatonas|häkaton|hakaton/i.test(text)) signals.push('mentions_hackathon')
  if (/2027/.test(text)) signals.push('mentions_2027')
  if (/travel|reimburs|accommodation covered|travel costs covered|kelion/i.test(text))
    signals.push('travel_language')
  if (/october|november|december|2026-1[0-2]|2027/i.test(text) && /hackathon|hakaton/i.test(text))
    signals.push('future_dated_hack_language')
  return signals
}

const results = []
for (const org of ORGANISERS) {
  const page = await fetchText(org.url)
  const signals = page.ok ? analyze(page.text) : []
  const alert =
    signals.includes('reg_open_language') &&
    !signals.includes('reg_closed_language') &&
    signals.includes('mentions_hackathon')
  results.push({
    id: org.id,
    label: org.label,
    country: org.country,
    url: org.url,
    ok: page.ok,
    status: page.status,
    error: page.error ?? null,
    signals,
    alert,
  })
  console.log(
    `${alert ? 'ALERT' : 'ok   '} [${org.country}] ${org.id.padEnd(22)} ${signals.join(',') || (page.ok ? '—' : 'FETCH_FAIL')}`
  )
}

const alerts = results.filter((r) => r.alert)
const report = {
  probed_at: new Date().toISOString(),
  region: 'priority_batch1_plus_baltics',
  batch: ['PL', 'FI', 'DE', 'NL', 'LT', 'EE', 'EU'],
  alerts: alerts.map((a) => ({ id: a.id, label: a.label, country: a.country, url: a.url, signals: a.signals })),
  results,
  social_queries: SOCIAL_QUERIES,
}

writeFileSync('baltic-weekly-probe.json', JSON.stringify(report, null, 2))

const lines = []
lines.push(`# Priority region weekly discovery (PL · FI · DE · NL + Baltics)`)
lines.push(``)
lines.push(`Probed: **${report.probed_at}**`)
lines.push(``)
lines.push(`## Reg-open alerts (${alerts.length})`)
if (alerts.length === 0) {
  lines.push(`_None this week._`)
} else {
  for (const a of alerts) {
    lines.push(`- **[${a.country}] ${a.label}** — ${a.url}`)
    lines.push(`  - signals: \`${a.signals.join(', ')}\``)
  }
}
lines.push(``)
lines.push(`## All organiser probes`)
for (const r of results) {
  const flag = r.alert ? '🚨' : r.ok ? '✅' : '❌'
  lines.push(`- ${flag} **[${r.country}] ${r.label}** (${r.status}) \`${r.signals.join(', ') || '—'}\``)
}
lines.push(``)
lines.push(`## X queries`)
for (const q of SOCIAL_QUERIES) lines.push(`- \`${q}\``)
lines.push(``)
lines.push(`## Next`)
lines.push(`1. Open 🚨 URLs → extract dates + deadline`)
lines.push(`2. Seed \`known-events.ts\` if reg open`)
lines.push(`3. Next batch countries: SE, DK, NO, IT, CZ, UK, BE, HU, AT, GE`)

writeFileSync('baltic-weekly-report.md', lines.join('\n'))
console.log(`\nAlerts: ${alerts.length}`)
console.log('Wrote baltic-weekly-probe.json + baltic-weekly-report.md')
