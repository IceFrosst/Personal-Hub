#!/usr/bin/env node
/**
 * Weekly Baltics + Poland discovery pass (open egress).
 * 1) Fetches organiser homepages for reg-open / hackathon language
 * 2) Emits social query checklist + machine-readable JSON
 * 3) Prints a markdown report suitable for a GitHub issue body
 */
import { writeFileSync } from 'node:fs'

const UA = 'Mozilla/5.0 (compatible; EventRadar-BalticWeekly/1.0)'

const ORGANISERS = [
  { id: 'jaunaragiai', label: 'Jaunaragiai / MAKE IT REAL', url: 'https://www.jaunaragiai.lt/en/make-it-real' },
  { id: 'jaunaragiai-home', label: 'Jaunaragiai home', url: 'https://www.jaunaragiai.lt/en' },
  { id: 'startup-lithuania', label: 'Startup Lithuania events', url: 'https://www.startuplithuania.com/events/' },
  { id: 'garage48', label: 'Garage48', url: 'https://garage48.org/' },
  { id: 'startup-day', label: 'sTARTUp Day', url: 'https://www.startupday.ee/' },
  { id: 'hackyeah', label: 'HackYeah', url: 'https://hackyeah.pl/' },
  { id: 'crossweb', label: 'Crossweb PL events', url: 'https://crossweb.pl/en/events/' },
  { id: 'edth-luma', label: 'EDTH Luma calendar', url: 'https://lu.ma/eurodefensetech' },
  { id: 'eudis', label: 'EUDIS Defence Hackathon', url: 'https://eudis-hackathon.eu/' },
  { id: 'techpark-kaunas', label: 'Tech-Park Kaunas / Tech-Champ', url: 'https://www.techpark-accelerator.lt/tech-champ-hakatonas-en' },
  { id: 'riga-techgirls', label: 'Riga TechGirls', url: 'https://rigatechgirls.com/' },
]

const SOCIAL_QUERIES = [
  'hackathon (Vilnius OR Kaunas OR Klaipėda OR Lietuva OR Lithuania) (2026 OR 2027)',
  'hakatonas (Vilnius OR Kaunas OR Lietuva)',
  'hackathon (Riga OR Latvia OR Latvija) (2026 OR 2027)',
  'hackathon (Tallinn OR Tartu OR Estonia) (2026 OR 2027)',
  'hackathon (Warsaw OR Kraków OR Wrocław OR Gdańsk OR Poland) (2026 OR 2027)',
  '("HackYeah" OR Garage48 OR Jaunaragiai OR "MAKE IT REAL" OR "Tech-Champ") (hackathon OR hakatonas)',
  'from:HackTrackEU (Vilnius OR Lithuania OR Kaunas OR Riga OR Tallinn OR Warsaw OR Kraków)',
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
  if (/applications?\s+closed|registration\s+closed|already\s+closed|no more spaces|sold\s+out|already closed|the 2026 hackathon is already closed/i.test(text))
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
    url: org.url,
    ok: page.ok,
    status: page.status,
    error: page.error ?? null,
    signals,
    alert,
  })
  console.log(
    `${alert ? 'ALERT' : 'ok   '} ${org.id.padEnd(22)} ${signals.join(',') || (page.ok ? '—' : 'FETCH_FAIL')}`
  )
}

const alerts = results.filter((r) => r.alert)
const report = {
  probed_at: new Date().toISOString(),
  region: 'baltics_poland',
  alerts: alerts.map((a) => ({ id: a.id, label: a.label, url: a.url, signals: a.signals })),
  results,
  social_queries: SOCIAL_QUERIES,
}

writeFileSync('baltic-weekly-probe.json', JSON.stringify(report, null, 2))

// Markdown for GitHub issue
const lines = []
lines.push(`# Baltic + Poland weekly discovery`)
lines.push(``)
lines.push(`Probed: **${report.probed_at}**`)
lines.push(``)
lines.push(`## Reg-open alerts (${alerts.length})`)
if (alerts.length === 0) {
  lines.push(`_None this week — organisers quiet or only closed editions online._`)
} else {
  for (const a of alerts) {
    lines.push(`- **${a.label}** — ${a.url}`)
    lines.push(`  - signals: \`${a.signals.join(', ')}\``)
  }
}
lines.push(``)
lines.push(`## All organiser probes`)
for (const r of results) {
  const flag = r.alert ? '🚨' : r.ok ? '✅' : '❌'
  lines.push(`- ${flag} **${r.label}** (${r.status}) \`${r.signals.join(', ') || '—'}\``)
}
lines.push(``)
lines.push(`## X / LinkedIn queries to run in agent session`)
for (const q of SOCIAL_QUERIES) lines.push(`- \`${q}\``)
lines.push(``)
lines.push(`## Next actions`)
lines.push(`1. Open any 🚨 alert URL and extract exact dates + registration deadline`)
lines.push(`2. Seed into \`known-events.ts\` if reg is open`)
lines.push(`3. Run social queries on X; paste promising links into a follow-up issue comment`)
lines.push(``)

writeFileSync('baltic-weekly-report.md', lines.join('\n'))
console.log(`\nAlerts: ${alerts.length}`)
console.log('Wrote baltic-weekly-probe.json + baltic-weekly-report.md')
