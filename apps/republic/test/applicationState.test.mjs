import assert from 'node:assert/strict'
import test from 'node:test'

// Plain (no JSX) module, unlike lib/applicationContext.tsx, so it can be
// imported directly under Node's --experimental-strip-types.
const {
  EMPTY_STATE,
  claimProviderHydration,
  isFreshApplicationState,
  mapSubmittedApplication,
  resolveRestoredThumbnail,
} = await import('../lib/applicationState.ts')

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

test('mapSubmittedApplication restores completed fields and forward locks each visa path', () => {
  const common = {
    applicantName: 'Ada Applicant',
    instagramHandle: 'ada.applicant',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    issuedDate: '13/09/2026',
    serial: 'SN-123456',
    referenceCode: 'RIG-ABCD',
    screeningQuestion: 'WHY?',
    screeningAnswer: 'BECAUSE.',
    declaredIq: 124,
    declaredConfidence: 88,
    decisionSeconds: 12.5,
    gender: 'F',
    dutyFreeItems: ['Unsolicited life advice'],
    selfieCaptured: true,
    selfieSizeBytes: 12345,
    selfiePath: 'RIG-ABCD.jpg',
  }

  const tourist = mapSubmittedApplication({
    ...common,
    visaType: 'tourist',
    idea: 'A questionable plan',
    supplies: ['Snacks', 'Bail money'],
  })
  assert.equal(tourist.visaType, 'tourist')
  assert.equal(tourist.sidequestIdea, 'A questionable plan')
  assert.deepEqual(tourist.sidequestSupplies, ['Snacks', 'Bail money'])
  assert.equal(tourist.sidequestIdeaSubmitted, true)
  assert.equal(tourist.sidequestSuppliesDeclared, true)

  const business = mapSubmittedApplication({ ...common, visaType: 'business', pitch: 'A serious pitch' })
  assert.equal(business.businessPitch, 'A serious pitch')
  assert.equal(business.businessPitchSubmitted, true)

  const special = mapSubmittedApplication({
    ...common,
    visaType: 'special',
    otherness: 'Extremely other',
    statement: 'I solemnly declare.',
  })
  assert.equal(special.specialOtherness, 'Extremely other')
  assert.equal(special.specialOthernessSubmitted, true)
  assert.equal(special.specialStatement, 'I solemnly declare.')
  assert.equal(special.specialStatementSubmitted, true)

  const fiance = mapSubmittedApplication({
    ...common,
    visaType: 'fiance',
    interviewAnswers: ['Unclear, but I paid the declaration fee', 'Diplomatic immunity via charm.'],
  })
  assert.deepEqual(fiance.fianceAnswers, ['Unclear, but I paid the declaration fee', 'Diplomatic immunity via charm.'])
  assert.equal(fiance.fianceInterviewSubmitted, true)
  assert.equal(fiance.selfieCaptured, true)
  assert.equal(fiance.selfieSizeBytes, 12345)
  assert.equal(fiance.selfiePath, 'RIG-ABCD.jpg')
  assert.equal(fiance.selfieDataUrl, null)
  assert.equal(fiance.draftId, null)
  assert.equal(fiance.intel, null)
  assert.equal(fiance.referenceCode, 'RIG-ABCD')
  assert.equal(fiance.serial, 'SN-123456')
  assert.equal(fiance.issuedDate, '13/09/2026')
  assert.equal(fiance.slot, common.slot)
  assert.equal(fiance.screeningQuestion, common.screeningQuestion)
  assert.equal(fiance.screeningAnswer, common.screeningAnswer)
  assert.equal(fiance.declaredIq, 124)
  assert.equal(fiance.declaredConfidence, 88)
  assert.equal(fiance.dateDecisionSeconds, 12.5)
  assert.deepEqual(fiance.dutyFreeItems, common.dutyFreeItems)
  assert.equal(fiance.identitySubmitted, true)
  assert.equal(fiance.handleSubmitted, true)
})

test('mapSubmittedApplication safely accepts legacy records missing newer fields', () => {
  const legacy = mapSubmittedApplication({ applicantName: 'Legacy', visaType: 'tourist', selfieCaptured: true })
  assert.equal(legacy.applicantName, 'Legacy')
  assert.equal(legacy.selfieCaptured, true)
  assert.equal(legacy.serial, null)
  assert.equal(legacy.issuedDate, null)
  assert.equal(legacy.referenceCode, null)
  assert.equal(legacy.draftId, null)
  assert.equal(legacy.intel, null)
  assert.deepEqual(legacy.fianceAnswers, [])
})

test('mapSubmittedApplication never mints a draft — restore is not activation', () => {
  // `restoreSubmittedApplication` in applicationContext.tsx builds its next
  // state purely from this mapper's output plus `resolveRestoredThumbnail`;
  // neither calls any of draftAudit's newDraftId/recordDraftStarted helpers.
  // Asserting `draftId: null` here (for both a fully populated and a legacy
  // record) is therefore sufficient coverage that the restore path cannot
  // accidentally mint/audit a new draft the way `reset()` and the provider's
  // hydration effect deliberately do.
  const populated = mapSubmittedApplication({
    applicantName: 'Ada Applicant',
    visaType: 'tourist',
    referenceCode: 'RIG-ABCD',
  })
  assert.equal(populated.draftId, null)
  const legacy = mapSubmittedApplication({ applicantName: 'Legacy' })
  assert.equal(legacy.draftId, null)
})

test('resolveRestoredThumbnail keeps the thumbnail only on an exact, unambiguous reference-code match', () => {
  // Same reference code on both sides — the tab restoring its own still-open
  // application — retains the thumbnail.
  assert.equal(resolveRestoredThumbnail('RIG-ABCD', 'data:image/thumb', 'RIG-ABCD'), 'data:image/thumb')
  // Different reference codes — restoring some other application — must never
  // leak the current tab's thumbnail onto it.
  assert.equal(resolveRestoredThumbnail('RIG-ABCD', 'data:image/thumb', 'RIG-WXYZ'), null)
  // No current reference code (fresh/empty session) — nothing to match against.
  assert.equal(resolveRestoredThumbnail(null, 'data:image/thumb', 'RIG-ABCD'), null)
  // Record has no reference code (legacy record) — can't unambiguously confirm
  // it's the same application, so no thumbnail either.
  assert.equal(resolveRestoredThumbnail('RIG-ABCD', 'data:image/thumb', null), null)
  assert.equal(resolveRestoredThumbnail('RIG-ABCD', 'data:image/thumb', undefined), null)
  // Both empty/missing — still no unambiguous match, no thumbnail.
  assert.equal(resolveRestoredThumbnail(null, 'data:image/thumb', null), null)
  // A match with no captured thumbnail on this tab correctly resolves to null
  // (nothing to carry over), not a false positive.
  assert.equal(resolveRestoredThumbnail('RIG-ABCD', null, 'RIG-ABCD'), null)
})

test('isFreshApplicationState is false once any other field diverges from EMPTY_STATE', () => {
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', applicantName: 'Ignas' }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', dutyFreeItems: ['Snacks'] }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', intel: { ip: '1.2.3.4' } }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', selfieRetakes: 1 }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', visaType: 'tourist' }), false)
})
