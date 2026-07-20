#!/usr/bin/env node
/** Weekly priority-region discovery — batches 1–3 + Baltics. */
import { writeFileSync } from 'node:fs'

const UA = 'Mozilla/5.0 (compatible; EventRadar-PriorityWeekly/1.0)'

const ORGANISERS = [
  { id: 'jaunaragiai', label: 'Jaunaragiai / MAKE IT REAL', url: 'https://www.jaunaragiai.lt/en/make-it-real', country: 'LT' },
  { id: 'startup-lithuania', label: 'Startup Lithuania events', url: 'https://www.startuplithuania.com/events/', country: 'LT' },
  { id: 'garage48', label: 'Garage48', url: 'https://garage48.org/', country: 'EE' },
  { id: 'startup-day', label: 'sTARTUp Day', url: 'https://www.startupday.ee/', country: 'EE' },
  { id: 'hackyeah', label: 'HackYeah', url: 'https://hackyeah.pl/', country: 'PL' },
  { id: 'crossweb', label: 'Crossweb PL events', url: 'https://crossweb.pl/en/events/', country: 'PL' },
  { id: 'junction', label: 'Junction', url: 'https://www.hackjunction.com/', country: 'FI' },
  { id: 'junction-app', label: 'Junction platform', url: 'https://hackjunction.app/hackathons', country: 'FI' },
  { id: 'german-tech-jobs', label: 'GermanTechJobs events', url: 'https://germantechjobs.de/en/events', country: 'DE' },
  { id: 'royalhacks', label: 'RoyalHacks', url: 'https://royalhacks.io/', country: 'DK' },
  { id: 'nordic-dk', label: 'Nordic Startup Hub DK', url: 'https://nordicstartuphub.com/denmarkevents', country: 'DK' },
  { id: 'nordic-se', label: 'Nordic Startup Hub SE', url: 'https://nordicstartuphub.com/swedenevents', country: 'SE' },
  { id: 'tekna', label: 'Tekna events', url: 'https://www.tekna.no/en/events/', country: 'NO' },
  { id: 'czech-startups', label: 'Czech Startups events', url: 'https://czechstartups.gov.cz/en/startup-ecosystem/network/startup-events-and-hackathons/', country: 'CZ' },
  { id: 'openglam-at', label: 'OpenGLAM Cultural Hackathon AT', url: 'https://openglam.at/en/', country: 'AT' },
  { id: 'edth-luma', label: 'EDTH Luma calendar', url: 'https://lu.ma/eurodefensetech', country: 'EU' },
  { id: 'eudis', label: 'EUDIS Defence Hackathon', url: 'https://eudis-hackathon.eu/', country: 'EU' },
  { id: 'mlh-2026', label: 'MLH 2026 season', url: 'https://mlh.io/seasons/2026/events', country: 'EU' },
  { id: 'mlh-2027', label: 'MLH 2027 season', url: 'https://mlh.io/seasons/2027/events', country: 'EU' },
]

const SOCIAL_QUERIES = [
  'hackathon (Vilnius OR Lithuania) (2026 OR 2027)',
  'hackathon (Warsaw OR Kraków OR Poland) (2026 OR 2027)',
  'hackathon (Helsinki OR Junction) (2026 OR 2027)',
  'hackathon (Berlin OR Munich OR Germany) (2026 OR 2027)',
  'hackathon (Amsterdam OR Delft OR Netherlands) (2026 OR 2027)',
  'hackathon (Stockholm OR Sweden) (2026 OR 2027)',
  'hackathon (Copenhagen OR RoyalHacks OR Denmark) (2026 OR 2027)',
  'hackathon (Oslo OR Norway) (2026 OR 2027)',
  'hackathon (Milan OR Italy) (2026 OR 2027)',
  'hackathon (Prague OR Brno OR Czechia OR "Czech Republic") (2026 OR 2027)',
  'hackathon (London OR Manchester OR Edinburgh OR UK) (2026 OR 2027)',
  'hackathon (Brussels OR Ghent OR Leuven OR Belgium) (2026 OR 2027)',
  'hackathon (Vienna OR Graz OR Austria) (2026 OR 2027)',
  'from:HackTrackEU (Prague OR London OR Brussels OR Vienna)',
]

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })
    return { ok: res.ok, status: res.status, text: await res.text(), url }
  } catch (e) {
    return { ok: false, status: 0, text: '', url, error: String(e) }
  }
}

function analyze(text) {
  const signals = []
  if (/applications?\s+are\s+now\s+open|apply\s+now|registration\s+open|register\s+now|apps?\s+open/i.test(text))
    signals.push('reg_open_language')
  if (/applications?\s+closed|registration\s+closed|already\s+closed|sold\s+out/i.test(text))
    signals.push('reg_closed_language')
  if (/hackathon|hakaton/i.test(text)) signals.push('mentions_hackathon')
  if (/2027/.test(text)) signals.push('mentions_2027')
  if (/travel|reimburs|accommodation covered/i.test(text)) signals.push('travel_language')
  if (/october|november|december|2026-1[0-2]|2027/i.test(text) && /hackathon/i.test(text))
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
  console.log(`${alert ? 'ALERT' : 'ok   '} [${org.country}] ${org.id.padEnd(22)} ${signals.join(',') || (page.ok ? '—' : 'FETCH_FAIL')}`)
}

const alerts = results.filter((r) => r.alert)
const report = {
  probed_at: new Date().toISOString(),
  region: 'priority_batches_1_2_3_plus_baltics',
  batch: ['PL','FI','DE','NL','SE','DK','NO','IT','CZ','UK','BE','AT','LT','EE','EU'],
  alerts: alerts.map((a) => ({ id: a.id, label: a.label, country: a.country, url: a.url, signals: a.signals })),
  results,
  social_queries: SOCIAL_QUERIES,
}

writeFileSync('baltic-weekly-probe.json', JSON.stringify(report, null, 2))

const lines = [
  `# Priority region weekly (batches 1–3 + Baltics)`,
  ``,
  `Probed: **${report.probed_at}**`,
  ``,
  `## Reg-open alerts (${alerts.length})`,
]
if (alerts.length === 0) lines.push(`_None this week._`)
else for (const a of alerts) {
  lines.push(`- **[${a.country}] ${a.label}** — ${a.url}`)
  lines.push(`  - signals: \`${a.signals.join(', ')}\``)
}
lines.push(``, `## All organiser probes`)
for (const r of results) {
  const flag = r.alert ? '🚨' : r.ok ? '✅' : '❌'
  lines.push(`- ${flag} **[${r.country}] ${r.label}** (${r.status}) \`${r.signals.join(', ') || '—'}\``)
}
lines.push(``, `## X queries`)
for (const q of SOCIAL_QUERIES) lines.push(`- \`${q}\``)
lines.push(``, `## Next batch: HU · GE`)

writeFileSync('baltic-weekly-report.md', lines.join('\n'))
console.log(`\nAlerts: ${alerts.length}`)
console.log('Wrote baltic-weekly-probe.json + baltic-weekly-report.md')
