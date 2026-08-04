#!/usr/bin/env node
/**
 * Is any source's page cap actually binding?
 *
 * Devpost was returning 16% of its list because `fetchDevpost` defaulted to 3
 * pages of 9 while the list ran to ~170 across ~19. Nothing failed and nothing
 * logged — the events past the cut simply never existed as far as the catalog
 * was concerned. A cap is a coverage decision in disguise, so every paginated
 * source needs the same question asked of it.
 *
 * The test is deliberately not "does the source return rows" — it is "does the
 * source still have more to give at the point we stop reading". For each one we
 * walk past the configured cap and report where the data actually ends.
 *
 * Several of these 403 from the sandbox, which is why this runs on a GitHub
 * runner with open egress.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar-CapAudit/1.0)'

/** Cap values mirrored from lib/ingest/*.ts — keep in sync. */
const CONFIGURED = {
  devpost: '30 pages × 9 (was 3 — the bug)',
  dorahacks: 'MAX_PAGES 4 × PAGE_SIZE 50',
  allhackathons: 'MAX_PAGES 5',
  startuplithuania: 'MAX_PAGES 3 × PER_PAGE 100 (breaks early when short)',
  hackquest: 'limit 200, single call',
  devfolio: 'size 100 per type, single call',
  taikai: 'perPage 100, single call',
  luma: 'PAGES_PER_QUERY 2 per query, by design',
}

async function getJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
    ...opts,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function getText(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', ...extraHeaders },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

const report = []
const note = (id, cap, findings, verdict) => {
  report.push({ id, cap, findings, verdict })
  console.log(`\n── ${id}  [${cap}]`)
  for (const f of findings) console.log(`     ${f}`)
  console.log(`     VERDICT: ${verdict}`)
}

// ── Devpost: walk to the true end of the list ──────────────────────────────
try {
  let total = 0
  let lastPage = 0
  for (let p = 1; p <= 60; p++) {
    const d = await getJson(
      `https://devpost.com/api/hackathons?page=${p}&status[]=upcoming&status[]=open`
    )
    const n = (d.hackathons ?? []).length
    if (n === 0) break
    total += n
    lastPage = p
  }
  note(
    'devpost',
    CONFIGURED.devpost,
    [`list ends at page ${lastPage}, ${total} events total`],
    lastPage <= 30 ? `OK — cap 30 clears the real end (${lastPage})` : `TOO LOW — raise past ${lastPage}`
  )
} catch (e) {
  note('devpost', CONFIGURED.devpost, [`unreachable: ${e.message}`], 'UNKNOWN')
}

// ── DoraHacks: cap is 4 pages of 50; does page 5 still return data? ────────
try {
  const findings = []
  let lastNonEmpty = 0
  let total = 0
  for (let p = 1; p <= 10; p++) {
    const d = await getJson(`https://dorahacks.io/api/hackathon/?page=${p}&page_size=50`, {
      headers: { Referer: 'https://dorahacks.io/hackathon' },
    })
    const n = (d.results ?? d.data ?? []).length
    if (n === 0) break
    total += n
    lastNonEmpty = p
    if (p <= 6) findings.push(`page ${p}: ${n} items`)
  }
  findings.push(`data ends at page ${lastNonEmpty} (${total} total)`)
  note(
    'dorahacks',
    CONFIGURED.dorahacks,
    findings,
    lastNonEmpty > 4 ? `TRUNCATED — real end is page ${lastNonEmpty}, we stop at 4` : 'OK — cap 4 clears the end'
  )
} catch (e) {
  note('dorahacks', CONFIGURED.dorahacks, [`unreachable: ${e.message}`], 'UNKNOWN')
}

// ── allhackathons: cap is 5 pages; how many does the pager advertise? ──────
try {
  const findings = []
  let lastNonEmpty = 0
  for (let p = 1; p <= 12; p++) {
    const url = p === 1 ? 'https://allhackathons.com/hackathons/' : `https://allhackathons.com/hackathons/?page=${p}`
    const { ok, status, text } = await getText(url)
    if (!ok) {
      findings.push(`page ${p}: HTTP ${status}`)
      break
    }
    const cards = (text.match(/<!--\s*Job\s*-->/gi) ?? []).length
    if (cards === 0) break
    lastNonEmpty = p
    if (p <= 8) findings.push(`page ${p}: ${cards} cards`)
  }
  findings.push(`cards end at page ${lastNonEmpty}`)
  note(
    'allhackathons',
    CONFIGURED.allhackathons,
    findings,
    lastNonEmpty > 5 ? `TRUNCATED — real end is page ${lastNonEmpty}, we stop at 5` : 'OK — cap 5 clears the end'
  )
} catch (e) {
  note('allhackathons', CONFIGURED.allhackathons, [`unreachable: ${e.message}`], 'UNKNOWN')
}

// ── HackerEarth / Hack Club: single-shot endpoints, confirm they aren't paged ─
for (const [id, url, pick] of [
  ['hackerearth', 'https://www.hackerearth.com/chrome-extension/events/', (d) => (d.response ?? []).length],
  ['hackclub', 'https://hackathons.hackclub.com/api/events/upcoming', (d) => (Array.isArray(d) ? d : (d.events ?? [])).length],
]) {
  try {
    const d = await getJson(url)
    const n = pick(d)
    note(id, 'single request, no pagination', [`${n} items returned`], 'OK — endpoint is not paginated')
  } catch (e) {
    note(id, 'single request, no pagination', [`unreachable: ${e.message}`], 'UNKNOWN')
  }
}

const { writeFileSync } = await import('node:fs')
writeFileSync('source-cap-audit.json', JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 2))

const bad = report.filter((r) => r.verdict.startsWith('TRUNCATED') || r.verdict.startsWith('TOO LOW'))
console.log(`\n${'='.repeat(64)}`)
console.log(bad.length ? `CAPS THAT ARE BINDING: ${bad.map((b) => b.id).join(', ')}` : 'No binding caps found.')
