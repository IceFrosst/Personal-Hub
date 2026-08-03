import assert from 'node:assert/strict'
import test from 'node:test'

import { buildTravelPolicyPatch } from '../lib/ingest/travel-policy-backfill'
import { circuitTravelPolicy } from '../lib/ingest/travel-circuits'
import { matchTravelPriority } from '../lib/travel-priority'
import { decodeTravelPolicyFromThemes } from '../lib/travel-policy-store'
import { travelUsefulForMe } from '../lib/travel-for-me'
import type { Hackathon } from '../lib/types'
import type { CircuitTravelPolicy } from '../lib/travel-priority'

const INTERNATIONAL: CircuitTravelPolicy = {
  scope: 'international',
  regions: ['Europe', 'global'],
  cap: 'up to €120 from Europe',
  quote: 'up to €120 if you are coming from Europe',
  verifiedOn: '2026-07-26',
}

const NO_TRAVEL: CircuitTravelPolicy = {
  scope: 'none',
  quote: 'Unfortunately, we cannot provide travel reimbursements.',
  verifiedOn: '2026-07-26',
}

test('backfill writes scope + regions onto an already-enriched row', () => {
  const patch = buildTravelPolicyPatch(
    { id: 'a', themes: ['student'], travel_covered: true },
    INTERNATIONAL
  )
  assert.ok(patch)
  const decoded = decodeTravelPolicyFromThemes(patch.themes)
  assert.equal(decoded.travel_scope, 'international')
  assert.deepEqual(decoded.travel_regions, ['Europe', 'global'])
  // travel_covered was already true — nothing to change.
  assert.equal(patch.travel_covered, undefined)
  // Pre-existing themes survive.
  assert.ok(patch.themes.includes('student'))
})

test('a scope extracted from the page always wins over the registry', () => {
  const patch = buildTravelPolicyPatch(
    { id: 'a', themes: ['travel_scope:domestic', 'travel_region:US'], travel_covered: true },
    INTERNATIONAL
  )
  assert.equal(patch, null)
})

test('verified "no travel" flips travel_covered false, beating the tier prior', () => {
  const patch = buildTravelPolicyPatch(
    { id: 'a', themes: [], travel_covered: true },
    NO_TRAVEL
  )
  assert.ok(patch)
  assert.equal(patch.travel_covered, false)
  assert.equal(decodeTravelPolicyFromThemes(patch.themes).travel_scope, 'none')
})

test('backfill is idempotent — a second pass is a no-op', () => {
  const first = buildTravelPolicyPatch({ id: 'a', themes: [], travel_covered: true }, INTERNATIONAL)
  assert.ok(first)
  const second = buildTravelPolicyPatch(
    { id: 'a', themes: first.themes, travel_covered: true },
    INTERNATIONAL
  )
  assert.equal(second, null)
})

test('online events get no circuit travel policy', () => {
  assert.equal(
    circuitTravelPolicy({
      source: 'known',
      title: 'HackUPC',
      url: 'https://hackupc.com/',
      format: 'online',
    }),
    null
  )
})

// The regression this whole change exists for: a Tier A row carried
// travel_covered = true with no geography, travelUsefulForMe answered 'maybe',
// and the Travel filter (which requires 'yes') matched 0 of 555 catalog rows.
test('HackUPC reaches travelUsefulForMe "yes" from Lithuania after backfill', () => {
  const policy = circuitTravelPolicy({
    source: 'known',
    title: 'HackUPC',
    url: 'https://hackupc.com/',
    format: 'in_person',
  })
  assert.ok(policy, 'HackUPC must carry a verified policy')

  const patch = buildTravelPolicyPatch({ id: 'a', themes: [], travel_covered: true }, policy)
  assert.ok(patch)
  const decoded = decodeTravelPolicyFromThemes(patch.themes)

  const row = {
    travel_covered: true,
    travel_scope: decoded.travel_scope,
    travel_regions: decoded.travel_regions,
    country: 'Spain',
    location_raw: 'Barcelona, Spain',
    city: 'Barcelona',
    format: 'in_person',
  } as Pick<
    Hackathon,
    'travel_covered' | 'travel_scope' | 'travel_regions' | 'country' | 'location_raw' | 'city' | 'format'
  >

  assert.equal(travelUsefulForMe(row, 'lithuania'), 'yes')
})

test('hackaTUM is registered as explicitly not reimbursing', () => {
  const hit = matchTravelPriority({ title: 'hackaTUM 2026', url: 'https://hack.tum.de/' })
  assert.equal(hit?.travelPolicy?.scope, 'none')
})

test('every registered policy cites a quote and a verification date', () => {
  const circuits = [
    'HackUPC',
    'TreeHacks',
    'YHack',
    'ConUHacks',
    'McHacks',
    'hackaTUM',
  ].map((title) => matchTravelPriority({ title }))

  for (const c of circuits) {
    assert.ok(c, 'circuit should match by title')
    const p = c.travelPolicy
    assert.ok(p, `${c.id} should carry a verified policy`)
    assert.ok(p.quote.length > 20, `${c.id} needs the wording it was read from`)
    assert.match(p.verifiedOn, /^\d{4}-\d{2}-\d{2}$/)
  }
})

// Two unrelated events are called UNIHACK. The Romanian one (unihack.eu) says
// outright it cannot cover travel; the Australian one (unihack.net) has made no
// such statement. Matching the .net row by name would attach a policy nobody
// verified for it.
test('UNIHACK.eu policy never attaches to the unrelated UNIHACK.net event', () => {
  const ro = matchTravelPriority({ title: 'UNIHACK Timișoara', url: 'https://unihack.eu/' })
  assert.equal(ro?.id, 'unihack-ro')
  assert.equal(ro?.travelPolicy?.scope, 'none')

  const au = matchTravelPriority({ title: 'UNIHACK', url: 'https://www.unihack.net/' })
  assert.notEqual(au?.id, 'unihack-ro')
})

test('HackRice records a real stipend programme as selective, not global', () => {
  const hit = matchTravelPriority({ title: 'HackRice', url: 'https://hackrice.com/' })
  // The page states a funded programme but no geography — promoting that to
  // global would manufacture the exact false positive the design prevents.
  assert.equal(hit?.travelPolicy?.scope, 'selective')
  assert.match(hit?.travelPolicy?.quote ?? '', /majority of our budget/)
})
