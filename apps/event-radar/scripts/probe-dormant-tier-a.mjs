#!/usr/bin/env node
/**
 * Weekly dormant-circuit probe.
 * - Fetches official pages for TreeHacks, PennApps, HackUPC, Jaunaragiai, Garage48
 * - Regex signals for reg-open / reg-closed / next year
 * - Parses registration deadlines when present
 * - Confidence score → high = auto-promote candidate
 * Writes: dormant-tier-a-probe.json, dormant-weekly-report.md, dormant-promote-candidates.json
 */
import { writeFileSync } from 'node:fs'

const UA = 'Mozilla/5.0 (compatible; EventRadar-DormantTierA/1.1)'

const DORMANT = [
  {
    id: 'treehacks',
    label: 'TreeHacks',
    url: 'https://treehacks.com/',
    paths: ['/', 'https://trunk.treehacks.com/'],
    staleYear: '2026',
    nextYear: '2027',
    siteUrl: 'https://treehacks.com/',
  },
  {
    id: 'pennapps',
    label: 'PennApps',
    url: 'https://pennapps.com/',
    paths: ['/', 'https://apply.pennapps.com/'],
    staleYear: '2025',
    nextYear: '2026',
    siteUrl: 'https://pennapps.com/',
  },
  {
    id: 'hackupc',
    label: 'HackUPC',
    url: 'https://hackupc.com/',
    paths: ['/', 'https://my.hackupc.com/'],
    staleYear: '2026',
    nextYear: '2027',
    siteUrl: 'https://hackupc.com/',
  },
  {
    id: 'jaunaragiai-make-it-real',
    label: 'MAKE IT REAL! (Jaunaragiai)',
    url: 'https://www.jaunaragiai.lt/en/make-it-real',
    paths: ['/', 'https://www.jaunaragiai.lt/en'],
    staleYear: '2026',
    nextYear: '2027',
    siteUrl: 'https://www.jaunaragiai.lt/en/make-it-real',
  },
  {
    id: 'garage48',
    label: 'Garage48',
    url: 'https://garage48.org/',
    paths: ['/'],
    staleYear: '2025',
    nextYear: '2026',
    siteUrl: 'https://garage48.org/',
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

/** Extract ISO-ish deadline candidates from page text */
function parseDeadlines(text) {
  const found = []
  const patterns = [
    /(?:apply|application|registration|apps?)\s*(?:deadline|closes?|by|until)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
    /(?:deadline|closes?)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
    /(?:apply|registration)\s+by\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi,
    /(\d{4}-\d{2}-\d{2})/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(text)) !== null) {
      const raw = m[1]
      const ts = Date.parse(raw)
      if (Number.isFinite(ts) && ts > Date.now()) {
        found.push({ raw, iso: new Date(ts).toISOString() })
      }
    }
  }
  // de-dupe by iso
  const seen = new Set()
  return found.filter((f) => {
    if (seen.has(f.iso)) return false
    seen.add(f.iso)
    return true
  })
}

function analyze(text, staleYear, nextYear) {
  const lower = text.toLowerCase()
  const signals = []
  if (/applications?\s+are\s+now\s+open|apply\s+now|registration\s+open|apps?\s+open|applications?\s+open/i.test(text))
    signals.push('reg_open_language')
  if (/applications?\s+(have\s+)?already\s+closed|applications?\s+closed|registration\s+closed|apps?\s+are\s+closed/i.test(text))
    signals.push('reg_closed_language')
  if (new RegExp(nextYear).test(text)) signals.push(`mentions_${nextYear}`)
  if (new RegExp(staleYear).test(text) && !new RegExp(nextYear).test(text))
    signals.push(`stale_year_${staleYear}_only`)
  if (/travel|reimburs|half of (your )?travel|€\s*\d+/i.test(lower))
    signals.push('travel_language')
  const deadlines = parseDeadlines(text)
  if (deadlines.length) signals.push('deadline_parsed')
  return { signals, deadlines }
}

function confidence(signals, deadlines, nextYear) {
  let c = 0
  if (signals.includes('reg_open_language')) c += 0.4
  if (signals.includes(`mentions_${nextYear}`)) c += 0.25
  if (signals.includes('deadline_parsed') && deadlines.length) c += 0.25
  if (signals.includes('reg_closed_language')) c -= 0.5
  if (signals.some((s) => s.startsWith('stale_year_'))) c -= 0.2
  return Math.max(0, Math.min(1, c))
}

const results = []
for (const d of DORMANT) {
  const pages = []
  for (const p of d.paths) {
    const url = p.startsWith('http') ? p : new URL(p, d.url).href
    try {
      const r = await fetchText(url)
      const { signals, deadlines } = analyze(r.text, d.staleYear, d.nextYear)
      pages.push({ ...r, signals, deadlines })
    } catch (e) {
      pages.push({ ok: false, url, error: String(e), signals: [], deadlines: [] })
    }
  }
  const allSignals = [...new Set(pages.flatMap((p) => p.signals))]
  const allDeadlines = pages.flatMap((p) => p.deadlines ?? [])
  const conf = confidence(allSignals, allDeadlines, d.nextYear)
  const alert =
    allSignals.includes('reg_open_language') &&
    !allSignals.includes('reg_closed_language') &&
    (allSignals.includes(`mentions_${d.nextYear}`) || allDeadlines.length > 0)

  results.push({
    id: d.id,
    label: d.label,
    siteUrl: d.siteUrl,
    alert,
    confidence: conf,
    signals: allSignals,
    deadlines: allDeadlines,
    auto_promote: conf >= 0.85 && allDeadlines.length > 0 && alert,
    pages: pages.map((p) => ({
      url: p.url,
      status: p.status,
      ok: p.ok,
      signals: p.signals,
      deadlines: p.deadlines,
    })),
  })
  console.log(
    `${alert ? (conf >= 0.85 ? 'AUTO' : 'ALERT') : 'dormant'} ${d.id.padEnd(28)} conf=${conf.toFixed(2)} ${allSignals.join(',') || '—'}`
  )
}

const promoteCandidates = results
  .filter((r) => r.alert)
  .map((r) => ({
    id: r.id,
    label: r.label,
    siteUrl: r.siteUrl,
    confidence: r.confidence,
    auto_promote: r.auto_promote,
    registration_deadline: r.deadlines[0]?.iso ?? null,
    deadline_raw: r.deadlines[0]?.raw ?? null,
    signals: r.signals,
    // starts_at left null — agent/human fills before promoting to known-events
    starts_at: null,
    ends_at: null,
    format: 'in_person',
    location_raw: null,
  }))

const autoPromote = promoteCandidates.filter((c) => c.auto_promote)

writeFileSync(
  'dormant-tier-a-probe.json',
  JSON.stringify({ probed_at: new Date().toISOString(), results }, null, 2)
)
writeFileSync(
  'dormant-promote-candidates.json',
  JSON.stringify(
    {
      probed_at: new Date().toISOString(),
      candidates: promoteCandidates,
      auto_promote: autoPromote,
    },
    null,
    2
  )
)

const lines = [
  `# Event Radar · Dormant circuit weekly`,
  ``,
  `Probed: **${new Date().toISOString()}**`,
  ``,
  `## How to promote`,
  `1. Review candidates below.`,
  `2. If registration is truly open, add a seed to \`apps/event-radar/lib/ingest/known-events.ts\` with real \`starts_at\` + \`registration_deadline\`.`,
  `3. Or ask the agent: *promote <id> with deadline … starts …*`,
  `4. **Auto-promote** only fires when confidence ≥ 0.85 and a future deadline was parsed.`,
  ``,
  `## Candidates (${promoteCandidates.length})`,
]
if (promoteCandidates.length === 0) {
  lines.push(`_None this week — all circuits still dormant._`)
} else {
  for (const c of promoteCandidates) {
    const badge = c.auto_promote ? '🟢 AUTO' : c.confidence >= 0.5 ? '🟡 REVIEW' : '⚪ WEAK'
    lines.push(`### ${badge} ${c.label} (\`${c.id}\`)`)
    lines.push(`- site: ${c.siteUrl}`)
    lines.push(`- confidence: **${(c.confidence * 100).toFixed(0)}%**`)
    lines.push(`- deadline: ${c.registration_deadline ?? '_not parsed_'} ${c.deadline_raw ? `(${c.deadline_raw})` : ''}`)
    lines.push(`- signals: \`${c.signals.join(', ')}\``)
    lines.push(`- [ ] Promote to active known-event`)
    lines.push(``)
  }
}

lines.push(`## All probes`)
for (const r of results) {
  const flag = r.auto_promote ? '🟢' : r.alert ? '🟡' : '💤'
  lines.push(
    `- ${flag} **${r.label}** conf=${r.confidence.toFixed(2)} \`${r.signals.join(', ') || '—'}\``
  )
}

writeFileSync('dormant-weekly-report.md', lines.join('\n'))
console.log(`\nAlerts: ${promoteCandidates.length}, auto-promote: ${autoPromote.length}`)
console.log('Wrote dormant-tier-a-probe.json, dormant-promote-candidates.json, dormant-weekly-report.md')
