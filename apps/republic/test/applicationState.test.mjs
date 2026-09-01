import assert from 'node:assert/strict'
import test from 'node:test'

// Plain (no JSX) module, unlike lib/applicationContext.tsx, so it can be
// imported directly under Node's --experimental-strip-types.
const { EMPTY_STATE, claimProviderHydration, isFreshApplicationState } = await import('../lib/applicationState.ts')

test('provider hydration claim allows one Strict Mode replay-safe initialization', () => {
  const gate = { current: false }
  let initializationCount = 0
  let eventCount = 0
  const hydrate = () => {
    if (!claimProviderHydration(gate)) return
    initializationCount += 1
    eventCount += 1
  }

  hydrate()
  hydrate() // React Strict Mode passive-effect replay on the same provider
  assert.equal(initializationCount, 1)
  assert.equal(eventCount, 1)
  // A real remount owns a new ref and therefore hydrates independently.
  assert.equal(claimProviderHydration({ current: false }), true)
})

test('isFreshApplicationState is true for a just-hydrated/reset state (only draftId set)', () => {
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'draft-abc' }), true)
  // draftId itself is explicitly excluded from the comparison.
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: null }), true)
})

test('isFreshApplicationState is false once any other field diverges from EMPTY_STATE', () => {
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', applicantName: 'Ignas' }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', dutyFreeItems: ['Snacks'] }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', intel: { ip: '1.2.3.4' } }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', selfieRetakes: 1 }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', visaType: 'tourist' }), false)
})
