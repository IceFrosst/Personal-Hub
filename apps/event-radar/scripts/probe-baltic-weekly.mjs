#!/usr/bin/env node
/**
 * Weekly priority-region discovery (open egress).
 * Batches 1–2: PL FI DE NL + SE DK NO IT + Baltics.
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
  // Denmark
  { id: 'royalhacks', label: 'RoyalHacks', url: 'https://royalhacks.io/', country: 'DK' },
  { id: 'nordic-dk', label: 'Nordic Startup Hub DK', url: 'https://nordicstartuphub.com/denmarkevents', country: 'DK' },
  // Sweden
  { id: 'nordic-se', label: 'Nordic Startup Hub SE', url: 'https://nordicstartuphub.com/swedenevents', country: 'SE' },
  // Norway
  { id: 'tekna', label: 'Tekna events', url: 'https://www.tekna.no/en/events/', country: 'NO' },
  { id: 'uio-growth', label: 'UiO Growth House', url: 'https://www.uio.no/english/research/interfaculty-research-areas/growth-house/student-innovation/ihub/events/', country: 'NO' },
  // EU
  { id: 'edth-luma', label: 'EDTH Luma calendar', url: 'https://lu.ma/eurodefensetech', country: 'EU' },
  { id: 'eudis', label: 'EUDIS Defence Hackathon', url: 'https://eudis-hackathon.eu/', country: 'EU' },
  { id: 'mlh-2026', label: 'MLH 2026 season', url: 'https://mlh.io/seasons/2026/events', country: 'EU' },
  { id: 'mlh-2027', label: 'MLH 2027 season', url: 'https://mlh.io/seasons/2027/events', country: 'EU' },
]

const SOCIAL_QUERIES = [
  'hackathon (Vilnius OR Kaunas OR Lithuania) (2026 OR 2027)',
  'hackathon (Warsaw OR Kraków OR Poland) (2026 OR 2027)',
  'hackathon (Helsinki OR Espoo OR Finland OR Junction) (2026 OR 2027)',
  'hackathon (Berlin OR Munich OR Germany) (2026 OR 2027)',
  'hackathon (Amsterdam OR Delft OR Netherlands) (2026 OR 2027)',
  'hackathon (Stockholm OR Gothenburg OR Sweden) (2026 OR 2027)',
  'hackathon (Copenhagen OR Aarhus OR Denmark OR RoyalHacks) (2026 OR 2027)',
  'hackathon (Oslo OR Bergen OR Trondheim OR Norway) (2026 OR 2027)',
  'hackathon (Milan OR Milano OR Rome OR Turin OR Italy) (2026 OR 2027)',
  'from:HackTrackEU (Stockholm OR Copenhagen OR Oslo OR Milan OR Warsaw)',
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
  if (/applications?\s+are\s+now\s+open|apply\s+now|registration\s+open|register\s+now|apps?\s+open|registracija\s+vyksta/i.test(text))
    signals.push('reg_open_language')
  if (/applications?\s+closed|registration\s+closed|already\s+closed|no more spaces|sold\s+out/i.test(text))
    signals.push('reg_closed_language')
  if (/hackathon|hakatonas|häkaton|hakaton/i.test(text)) signals.push('mentions_hackathon')
  if (/2027/.test(text)) signals.push('mentions_2027')
  if (/travel|reimburs|accommodation covered|travel costs covered/i.test(text))
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
  region: 'priority_batch1_batch2_plus_baltics',
  batch: ['PL', 'FI', 'DE', 'NL', 'SE', 'DK', 'NO', 'IT', 'LT', 'EE', 'EU'],
  alerts: alerts.map((a) => ({
    id: a.id,
    label: a.label,
    country: a.country,
    url: a.url,
    signals: a.signals,
  })),
  results,
  social_queries: SOCIAL_QUERIES,
}

writeFileSync('baltic-weekly-probe.json', JSON.stringify(report, null, 2))

const lines = []
lines.push(`# Priority region weekly (batches 1–2 + Baltics)`)
lines.push(``)
lines.push(`Probed: **${report.probed_at}**`)
lines.push(``)
lines.push(`## Reg-open alerts (${alerts.length})`)
if (alerts.length === 0) lines.push(`_None this week._`)
else {
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
lines.push(`## Next batch: CZ · UK · BE · AT`)

writeFileSync('baltic-weekly-report.md', lines.join('\n'))
console.log(`\nAlerts: ${alerts.length}`)
console.log('Wrote baltic-weekly-probe.json + baltic-weekly-report.md')
