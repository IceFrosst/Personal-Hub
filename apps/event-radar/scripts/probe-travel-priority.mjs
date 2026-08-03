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
  // EU expansion — all unreachable from the sandbox, so this weekly open-egress
  // run is the ONLY way they collect evidence. Promote a circuit to Tier A in
  // lib/travel-priority-additions.ts once it reports travel_language here (and
  // the wording is a real policy, not a sponsor blurb).
  { id: 'hackatum', tier: 'B', url: 'https://hack.tum.de/', paths: ['/faq', '/travel'] },
  { id: 'hack-cambridge', tier: 'B', url: 'https://hackcambridge.com/', paths: ['/faq'] },
  { id: 'cassini', tier: 'B', url: 'https://www.cassini.eu/hackathons', paths: ['/faq'] },
  { id: 'edth', tier: 'B', url: 'https://www.europeandefensetech.com/', paths: ['/faq'] },
  { id: 'hackkosice', tier: 'A', url: 'https://www.hackkosice.com/', paths: ['/faq'] },
  { id: 'ichack', tier: 'B', url: 'https://ichack.org/', paths: ['/faq'] },
  { id: 'hacktheburgh', tier: 'B', url: 'https://hacktheburgh.com/', paths: ['/faq'] },
  // Still scope=null in the registry and eligible in the feed, so each of these
  // is currently stuck on "Travel · check FAQ". EU ones first — they are the
  // ones that would actually change the Travel filter for a Baltic traveller.
  { id: 'starthack', tier: 'A', url: 'https://www.startglobal.org/start-hack/home', paths: ['/faq'] },
  { id: 'junction-2026', tier: 'B', url: 'https://www.hackjunction.com/', paths: ['/faq', '/about'] },
  { id: 'unihack', tier: 'B', url: 'https://unihack.eu/', paths: ['/faq'] },
  { id: 'hackrice', tier: 'B', url: 'https://hackrice.com/', paths: ['/faq'] },
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

function visibleText(html) {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The signal labels say a policy EXISTS; they never say who it covers. Promoting
 * a circuit B → A (and picking its travel scope) needs the actual wording, so
 * pull the sentences around each travel match into the report.
 */
/**
 * Accordion FAQs render only their questions; the answers sit in a Next.js /
 * Nuxt JSON payload. Unescaping the raw body and searching that as well is what
 * makes MHacks- and LA Hacks-shaped sites readable — a visible-text-only scan
 * returns their question list and nothing else.
 */
function payloadText(html) {
  const blobs = []
  for (const m of html.matchAll(/<script[^>]*>([\s\S]{200,}?)<\/script>/gi)) blobs.push(m[1])
  return blobs
    .join(' ')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\s+/g, ' ')
}

function travelQuotes(html) {
  const text = visibleText(html) + ' ' + payloadText(html)
  const quotes = []
  const re =
    /travel|reimburs|stipend|bursary|airfare|flight|scholarship|covered up to|we (?:cover|will cover|reimburse)/gi
  let m
  while ((m = re.exec(text)) !== null && quotes.length < 8) {
    const start = Math.max(0, text.lastIndexOf('.', m.index - 1) + 1)
    const dot = text.indexOf('.', m.index)
    const end = dot === -1 ? Math.min(text.length, m.index + 220) : Math.min(dot + 1, m.index + 300)
    const q = text.slice(start, end).trim()
    // Skip nav/footer noise and near-duplicates.
    if (q.length < 40 || q.length > 400) continue
    if (quotes.some((prev) => prev.includes(q.slice(0, 40)))) continue
    quotes.push(q)
    re.lastIndex = end
  }
  return quotes
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
    const quotes = [...new Set(pages.flatMap((p) => travelQuotes(p.text)))].slice(0, 10)
    // A JS-only SPA returns a big shell with almost no words — the reason
    // production enrichment learns nothing from these sites. Record it so a
    // silent "no travel language" is distinguishable from "page has no text".
    const shell = pages.map((p) => ({
      path: p.path,
      status: p.status,
      bytes: p.text.length,
      words: visibleText(p.text).split(' ').length,
    }))
    results.push({
      id: c.id,
      tier: c.tier,
      ok: pages.some((p) => p.ok),
      signals: allSignals,
      alert: allSignals.includes('reg_open_language'),
      travel_hit: allSignals.includes('travel_language'),
      quotes,
      pages: shell,
      ms: Date.now() - started,
    })
    console.log(
      `${pages.some((p) => p.ok) ? 'OK' : 'FAIL'} ${c.tier} ${c.id.padEnd(14)} ${allSignals.join(',') || '—'}` +
        ` [${shell.map((p) => `${p.path}:${p.words}w`).join(' ')}]`
    )
    for (const q of quotes) console.log(`      » ${q.slice(0, 240)}`)
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
