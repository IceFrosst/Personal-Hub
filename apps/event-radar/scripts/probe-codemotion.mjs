#!/usr/bin/env node
/**
 * Structure probe for events.codemotion.com — the one untapped listing that
 * claims pan-European coverage ("more than 500 tech events for developers
 * across Europe"). Nuxt-rendered, so the question is whether the event list is
 * in the server HTML, in a __NUXT__ payload, or only fetched client-side.
 *
 * Also checks for a JSON API behind the page, which would beat HTML parsing.
 */
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const TARGETS = [
  'https://events.codemotion.com/',
  'https://events.codemotion.com/hackathons/',
  'https://events.codemotion.com/conferences/',
  'https://events.codemotion.com/?search=hackathon',
  'https://events.codemotion.com/api/events',
  'https://events.codemotion.com/_nuxt/builds/latest.json',
  'https://events.codemotion.com/sitemap.xml',
]

function visible(html) {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

for (const url of TARGETS) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*' },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    })
    const body = await res.text()
    const text = visible(body)
    console.log('='.repeat(78))
    console.log(`${res.status}  ${url}  bytes=${body.length} words=${text.split(' ').length}`)

    if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
      console.log('JSON:', body.slice(0, 1500))
      continue
    }

    // Nuxt payload: where the data actually lives if the list is SSR'd.
    const nuxt = /window\.__NUXT__\s*=\s*([\s\S]{0,400})/.exec(body)
    if (nuxt) console.log('__NUXT__ head:', nuxt[1].replace(/\s+/g, ' ').slice(0, 350))
    const payloadUrl = /"(\/_payload\.json[^"]*)"|"(\/_nuxt\/[^"]+\.json)"/.exec(body)
    if (payloadUrl) console.log('payload ref:', payloadUrl[0])

    // Event-shaped anchors and their surrounding markup.
    const links = [...body.matchAll(/<a[^>]+href="([^"]*(?:event|hackathon)[^"]*)"[^>]*>([\s\S]{0,150}?)<\/a>/gi)]
    console.log(`event-ish anchors: ${links.length}`)
    for (const m of links.slice(0, 8)) {
      console.log(`   ${m[1]}  ::  ${visible(m[2]).slice(0, 80)}`)
    }
    if (links.length > 0) {
      const first = body.indexOf(links[0][0])
      console.log('RAW around first anchor:')
      console.log(body.slice(Math.max(0, first - 900), first + 900).replace(/\s+/g, ' '))
    }
    console.log('TEXT:', text.slice(0, 600))
  } catch (e) {
    console.log('='.repeat(78))
    console.log(`FAIL ${url}: ${e?.message ?? e}`)
  }
}
