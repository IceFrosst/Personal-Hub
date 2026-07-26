#!/usr/bin/env node
/**
 * EU coverage discovery — which additions would actually yield events?
 *
 * The region packs cover the Baltics, PL, FI, DE, NL, SE, DK, NO, IT, CZ, UK,
 * BE, AT, HU, GE. Western/southern/south-eastern Europe is absent: France has a
 * single bare "hackathon Paris" query and Spain, Portugal, Greece, Malta,
 * Ireland, Switzerland, Romania, Bulgaria and the Balkans have nothing at all.
 *
 * Rather than add ~50 speculative queries, this measures them first from open
 * egress and reports what each one actually returns — name-matched hackathons,
 * how many are in-person, how many are still in the future. Only queries that
 * yield get wired in.
 *
 * Part two probes candidate EU hub sites for parseability, so a new source is
 * chosen on evidence the same way allhackathons.com was.
 */

const UA = 'Mozilla/5.0 (compatible; EventRadar-EUCoverage/1.0)'
const LUMA = 'https://api.lu.ma/discover/get-paginated-events'

/** Same name filter the real Luma source applies — counts must be comparable. */
const HACK_RE = /\bhack|hackathon|hack[- ]?day|hack[- ]?night|game\s*jam|buildathon|hakaton|häkaton\b/i

const QUERIES = [
  // ── France ───────────────────────────────────────────────────────────────
  'hackathon Paris',
  'hackathon France',
  'hackathon Lyon',
  'hackathon Toulouse',
  'hackathon Nantes',
  'hackathon Lille',
  'hackathon Marseille',
  'hackathon Grenoble',
  'hackathon Station F',
  // ── Spain ────────────────────────────────────────────────────────────────
  'hackathon Spain',
  'hackathon Barcelona',
  'hackathon Madrid',
  'hackathon Valencia',
  'hackathon Bilbao',
  'hackathon Sevilla',
  // ── Portugal ─────────────────────────────────────────────────────────────
  'hackathon Portugal',
  'hackathon Lisbon',
  'hackathon Lisboa',
  'hackathon Porto',
  'hackathon Braga',
  // ── Greece / Cyprus / Malta ──────────────────────────────────────────────
  'hackathon Greece',
  'hackathon Athens',
  'hackathon Thessaloniki',
  'hackathon Patras',
  'hackathon Cyprus',
  'hackathon Nicosia',
  'hackathon Malta',
  'hackathon Valletta',
  // ── Ireland ──────────────────────────────────────────────────────────────
  'hackathon Ireland',
  'hackathon Dublin',
  'hackathon Cork',
  'hackathon Galway',
  // ── Switzerland ──────────────────────────────────────────────────────────
  'hackathon Switzerland',
  'hackathon Zurich',
  'hackathon Zürich',
  'hackathon Lausanne',
  'hackathon Geneva',
  'hackathon Basel',
  'hackathon EPFL',
  // ── Romania / Bulgaria ───────────────────────────────────────────────────
  'hackathon Romania',
  'hackathon Bucharest',
  'hackathon Cluj',
  'hackathon Timisoara',
  'hackathon Bulgaria',
  'hackathon Sofia',
  // ── Balkans / Central ────────────────────────────────────────────────────
  'hackathon Croatia',
  'hackathon Zagreb',
  'hackathon Slovenia',
  'hackathon Ljubljana',
  'hackathon Slovakia',
  'hackathon Bratislava',
  'hackathon Kosice',
  'hackathon Serbia',
  'hackathon Belgrade',
  'hackathon Novi Sad',
  // ── Small states / Nordics gap ───────────────────────────────────────────
  'hackathon Luxembourg',
  'hackathon Iceland',
  'hackathon Reykjavik',
  'hackathon Turku',
  // ── Pan-EU phrasing ──────────────────────────────────────────────────────
  'hackathon Europe',
  'hackathon EU',
  'European hackathon',
  'hackathon defence Europe',
  'AI hackathon Europe',
]

/** Candidate EU hub / listing sites — is any of them parseable? */
const DOMAINS = [
  { id: 'eu-startups', url: 'https://www.eu-startups.com/events/' },
  { id: 'cassini', url: 'https://www.cassini.eu/hackathons' },
  { id: 'junction-platform', url: 'https://hackjunction.app/hackathons' },
  { id: 'best-eu', url: 'https://best.eu.org/events/index.jsp' },
  { id: 'lablab', url: 'https://lablab.ai/event' },
  { id: 'codemotion', url: 'https://events.codemotion.com/' },
  { id: 'innovationlabs-ro', url: 'https://www.innovationlabs.ro/' },
  { id: 'lauzhack', url: 'https://lauzhack.com/' },
  { id: 'hackzurich', url: 'https://hackzurich.com/' },
  { id: 'hackepsi', url: 'https://hackeps.com/' },
  { id: 'ichack', url: 'https://ichack.org/' },
  { id: 'hackkosice', url: 'https://www.hackkosice.com/' },
  { id: 'edth', url: 'https://www.europeandefensetech.com/' },
  { id: 'hackathon-gr', url: 'https://hackathon.gr/' },
  { id: 'mita-malta', url: 'https://mita.gov.mt/events/' },
  { id: 'startupweekend', url: 'https://www.techstars.com/communities/startup-weekend' },
  { id: 'devpost-eu', url: 'https://devpost.com/api/hackathons?challenge_type[]=in-person&page=1' },
  { id: 'mlh-europe', url: 'https://mlh.io/seasons/2026/events' },
]

async function lumaQuery(query) {
  const res = await fetch(`${LUMA}?${new URLSearchParams({ query })}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return { ok: false, status: res.status }
  const page = await res.json()
  const entries = page.entries ?? []
  const now = Date.now()
  const hits = []
  for (const e of entries) {
    const ev = e?.event
    const name = ev?.name
    if (!name || !HACK_RE.test(name)) continue
    const geo = ev.geo_address_info ?? null
    const place =
      geo?.city_state ?? [geo?.city, geo?.country].filter(Boolean).join(', ') ?? null
    hits.push({
      name,
      place: place || null,
      inPerson: ev.location_type === 'offline' || !!place,
      future: ev.start_at ? Date.parse(ev.start_at) > now : false,
      start: ev.start_at ?? null,
    })
  }
  return {
    ok: true,
    entries: entries.length,
    matched: hits.length,
    future: hits.filter((h) => h.future).length,
    futureInPerson: hits.filter((h) => h.future && h.inPerson).length,
    sample: hits
      .filter((h) => h.future)
      .slice(0, 6)
      .map((h) => `${h.name}${h.place ? ` — ${h.place}` : ''}${h.start ? ` (${h.start.slice(0, 10)})` : ''}`),
  }
}

function visibleText(html) {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function probeDomain(d) {
  try {
    const res = await fetch(d.url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    const body = await res.text()
    const text = visibleText(body)
    const structured = []
    if (/application\/ld\+json/.test(body)) structured.push('json-ld')
    if (/__NEXT_DATA__/.test(body)) structured.push('next-data')
    if (/self\.__next_f\.push/.test(body)) structured.push('rsc-flight')
    if (/window\.__NUXT__/.test(body)) structured.push('nuxt')
    // Does the JSON-LD actually describe Events?
    const ldEvents = (body.match(/"@type"\s*:\s*"[^"]*Event[^"]*"/g) ?? []).length
    return {
      id: d.id,
      ok: res.ok,
      status: res.status,
      bytes: body.length,
      words: text.split(' ').length,
      structured,
      ld_event_nodes: ldEvents,
      // High bytes + low words = JS shell, the pattern that makes a site useless
      // to plain fetch (see the travel-policy finding).
      spa_shell: body.length > 20000 && text.split(' ').length < 150,
      excerpt: text.slice(0, 220),
    }
  } catch (err) {
    return { id: d.id, ok: false, error: String(err?.message ?? err) }
  }
}

const luma = []
for (const q of QUERIES) {
  try {
    const r = await lumaQuery(q)
    luma.push({ query: q, ...r })
    const tag = r.ok ? `matched=${r.matched} future=${r.future} futureIRL=${r.futureInPerson}` : `HTTP ${r.status}`
    console.log(`${(r.futureInPerson ?? 0) > 0 ? '★' : ' '} ${q.padEnd(32)} ${tag}`)
    for (const s of r.sample ?? []) console.log(`      · ${s}`)
  } catch (e) {
    luma.push({ query: q, ok: false, error: String(e) })
    console.log(`  ${q.padEnd(32)} ERROR`)
  }
}

console.log('\n─── candidate EU hub sites ───')
const domains = []
for (const d of DOMAINS) {
  const r = await probeDomain(d)
  domains.push(r)
  console.log(
    `${r.ok ? 'OK  ' : 'FAIL'} ${r.id.padEnd(18)} ${r.status ?? r.error ?? ''} ` +
      `words=${r.words ?? '-'} ld_events=${r.ld_event_nodes ?? '-'} ` +
      `${(r.structured ?? []).join(',') || '—'}${r.spa_shell ? ' SPA-SHELL' : ''}`
  )
  if (r.excerpt) console.log(`      ${r.excerpt.slice(0, 160)}`)
}

const { writeFileSync } = await import('node:fs')
writeFileSync(
  'eu-coverage-probe.json',
  JSON.stringify({ generated_at: new Date().toISOString(), luma, domains }, null, 2)
)

const winners = luma.filter((r) => (r.futureInPerson ?? 0) > 0)
console.log(`\n${winners.length}/${luma.length} queries return a future in-person hackathon:`)
console.log(winners.map((w) => `${w.query} (${w.futureInPerson})`).join('\n') || '  none')
