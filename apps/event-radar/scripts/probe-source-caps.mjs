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
  dorahacks: 'MAX_PAGES 40 × PAGE_SIZE 50 (was 4)',
  allhackathons: 'MAX_PAGES 30 (was 5 — measured TRUNCATED 2026-08-04)',
  startuplithuania: 'MAX_PAGES 3 × PER_PAGE 100 (breaks early when short)',
  hackquest: 'limit 200, single call',
  devfolio: 'size 100 per type, single call',
  taikai: 'perPage 100, single call',
  unstop: 'MAX_PAGES 3 × PER_PAGE 100 (last_page stop in front)',
  luma: 'PAGES_PER_QUERY 2 rotation / PRIMARY_PAGES 10 primary',
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
  // Walk past the cap (40), not up to it — a walk that stops at its own ceiling
  // measures the ceiling, not the data.
  const DORA_WALK = 45
  for (let p = 1; p <= DORA_WALK; p++) {
    const d = await getJson(`https://dorahacks.io/api/hackathon/?page=${p}&page_size=50`, {
      headers: { Referer: 'https://dorahacks.io/hackathon' },
    })
    const n = (d.results ?? d.data ?? []).length
    if (n === 0) break
    total += n
    lastNonEmpty = p
    if (p <= 6) findings.push(`page ${p}: ${n} items`)
  }
  const doraHitCeiling = lastNonEmpty === DORA_WALK
  findings.push(
    doraHitCeiling
      ? `still returning data at page ${lastNonEmpty} — walk ceiling reached, real end unknown`
      : `data ends at page ${lastNonEmpty} (${total} total)`
  )
  note(
    'dorahacks',
    CONFIGURED.dorahacks,
    findings,
    doraHitCeiling
      ? `INCONCLUSIVE — raise DORA_WALK above ${DORA_WALK}`
      : lastNonEmpty > 40
        ? `TRUNCATED — real end is page ${lastNonEmpty}, we stop at 40`
        : `OK — cap 40 clears the end (${lastNonEmpty})`
  )
} catch (e) {
  note('dorahacks', CONFIGURED.dorahacks, [`unreachable: ${e.message}`], 'UNKNOWN')
}

// ── allhackathons: cap is 5 pages; how many does the pager advertise? ──────
try {
  const findings = []
  let lastNonEmpty = 0
  // The 2026-08-04 run walked only to 12 and reported "ends at page 12" — but
  // page 12 still had cards, so it had measured its own ceiling. Walk past the
  // configured cap (30) instead, and say so when the ceiling is what stopped us.
  const AH_WALK = 35
  for (let p = 1; p <= AH_WALK; p++) {
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
  const ahHitCeiling = lastNonEmpty === AH_WALK
  findings.push(
    ahHitCeiling
      ? `still returning cards at page ${lastNonEmpty} — walk ceiling reached, real end unknown`
      : `cards end at page ${lastNonEmpty}`
  )
  note(
    'allhackathons',
    CONFIGURED.allhackathons,
    findings,
    ahHitCeiling
      ? `INCONCLUSIVE — raise AH_WALK above ${AH_WALK}`
      : lastNonEmpty > 30
        ? `TRUNCATED — real end is page ${lastNonEmpty}, we stop at 30`
        : `OK — cap 30 clears the end (${lastNonEmpty})`
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

// ── Luma: the cap is per-query, so ask it per query ────────────────────────
// The primary `hackathon` query runs on every sweep and is the broadest one;
// the city queries are the long tail. They behave completely differently, which
// is exactly why a single shared PAGES_PER_QUERY was wrong.
try {
  const findings = []
  let primaryDepth = 0
  for (const q of ['hackathon', 'hackathon Berlin', 'hackathon Paris']) {
    let cursor = null
    let depth = 0
    let entries = 0
    let exhausted = false
    for (let i = 0; i < 15; i++) {
      const p = new URLSearchParams({ query: q })
      if (cursor) p.set('pagination_cursor', cursor)
      const page = await getJson(`https://api.lu.ma/discover/get-paginated-events?${p}`)
      if (!Array.isArray(page.entries)) break
      depth++
      entries += page.entries.length
      cursor = page.next_cursor ?? null
      if (!page.has_more || !cursor) {
        exhausted = true
        break
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    if (q === 'hackathon') primaryDepth = depth
    findings.push(`"${q}": ${depth} pages, ${entries} entries${exhausted ? ' (exhausted)' : ' (still more)'}`)
  }
  note(
    'luma',
    CONFIGURED.luma,
    findings,
    primaryDepth > 10
      ? `TRUNCATED — primary needs ${primaryDepth}, PRIMARY_PAGES is 10`
      : `OK — PRIMARY_PAGES 10 clears the primary (${primaryDepth})`
  )
} catch (e) {
  note('luma', CONFIGURED.luma, [`unreachable: ${e.message}`], 'UNKNOWN')
}

// ── Unstop: MAX_PAGES 3 × 100; does last_page exceed 3? ────────────────────
try {
  const d = await getJson(
    'https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&oppstatus=open&per_page=100&page=1'
  )
  const lastPage = d.data?.last_page ?? null
  const n = (d.data?.data ?? []).length
  note(
    'unstop',
    CONFIGURED.unstop,
    [`page 1: ${n} items, last_page=${lastPage}`],
    lastPage && lastPage > 3 ? `TRUNCATED — last_page ${lastPage} > MAX_PAGES 3` : 'OK — cap 3 clears the end'
  )
} catch (e) {
  note('unstop', CONFIGURED.unstop, [`unreachable: ${e.message}`], 'UNKNOWN')
}

const { writeFileSync } = await import('node:fs')
writeFileSync('source-cap-audit.json', JSON.stringify({ generated_at: new Date().toISOString(), report }, null, 2))

const bad = report.filter((r) => r.verdict.startsWith('TRUNCATED') || r.verdict.startsWith('TOO LOW'))
console.log(`\n${'='.repeat(64)}`)
console.log(bad.length ? `CAPS THAT ARE BINDING: ${bad.map((b) => b.id).join(', ')}` : 'No binding caps found.')
