import assert from 'node:assert/strict'
import test from 'node:test'

// Plain (no JSX) module, unlike lib/applicationContext.tsx, so it can be
// imported directly under Node's --experimental-strip-types.
const {
  EMPTY_STATE,
  claimProviderHydration,
  isFinalizedApplicationState,
  isFreshApplicationState,
  mapSubmittedApplication,
  mergeSelfieThumbnail,
  synthesizeIssuedDate,
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
  // Genuinely incomplete (no slot/referenceCode) — nothing to synthesize;
  // this record was never actually finished, so it correctly stays that way.
  assert.equal(legacy.serial, null)
  assert.equal(legacy.issuedDate, null)
  assert.equal(legacy.referenceCode, null)
  assert.equal(legacy.draftId, null)
  assert.equal(legacy.intel, null)
  assert.deepEqual(legacy.fianceAnswers, [])
})

test('mapSubmittedApplication synthesizes serial/issuedDate for an otherwise-complete legacy record (the /visa-issued redirect-to-/appointment bug)', () => {
  const legacyComplete = {
    applicantName: 'Old Timer',
    instagramHandle: 'old.timer',
    visaType: 'tourist',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    referenceCode: 'RIG-OLDX',
    selfieCaptured: true,
    submittedAt: '2026-09-01T12:00:00.000Z',
    // No serial, no issuedDate — the exact shape an older app version wrote.
  }
  const restored = mapSubmittedApplication(legacyComplete)
  // All of /visa-issued's completeness-guard fields must now be truthy —
  // this is the actual bug fix: previously `serial`/`issuedDate` stayed
  // null here and the guard bounced the restore to /visa, which forward-
  // locked straight through to /appointment instead of showing the final
  // passport.
  assert.ok(restored.visaType)
  assert.ok(restored.serial)
  assert.ok(restored.slot)
  assert.ok(restored.issuedDate)
  assert.ok(restored.referenceCode)
  assert.equal(restored.selfieCaptured, true)
  // SERIAL is guard-only/internal now (never rendered) — just needs to be a
  // stable non-empty string distinct from the real `SN-######` format so it
  // can never be mistaken for/collide with a genuinely issued one.
  assert.match(restored.serial, /^SN-LEGACY-\d{6}$/)
  // issuedDate DOES render (the /visa-issued stamp) — DD/MM/YYYY derived
  // from the record's own submittedAt using UTC calendar getters.
  assert.equal(restored.issuedDate, '01/09/2026')

  // Never randomized/regenerated on repeat views of the exact same record.
  const restoredAgain = mapSubmittedApplication(legacyComplete)
  assert.equal(restoredAgain.serial, restored.serial)
  assert.equal(restoredAgain.issuedDate, restored.issuedDate)
})

test('synthesizeIssuedDate uses UTC calendar date regardless of local timezone', () => {
  // This instant is 01 September in UTC but 31 August in US Pacific time.
  assert.equal(synthesizeIssuedDate('2026-09-01T00:30:00.000Z'), '01/09/2026')
  assert.equal(synthesizeIssuedDate('2026-08-31T19:30:00-05:00'), '01/09/2026')
})

test('synthesizeIssuedDate uses a truthful guard value for missing or invalid submittedAt', () => {
  assert.equal(synthesizeIssuedDate(undefined), 'DATE ON FILE')
  assert.equal(synthesizeIssuedDate('not-a-date'), 'DATE ON FILE')
})

test('mapSubmittedApplication falls back to a truthful deterministic issuedDate when submittedAt is also missing', () => {
  const veryOld = {
    applicantName: 'Ancient',
    visaType: 'business',
    slot: 'MON, 1 SEPT 2025 — MORNING',
    referenceCode: 'RIG-VOLD',
    selfieCaptured: true,
    // No submittedAt either — an even older record.
  }
  const first = mapSubmittedApplication(veryOld)
  const second = mapSubmittedApplication(veryOld)
  assert.equal(first.issuedDate, 'DATE ON FILE')
  assert.equal(first.issuedDate, second.issuedDate)
  assert.notEqual(first.issuedDate, '01/01/1970')
})

test('mapSubmittedApplication uses DATE ON FILE for an invalid submittedAt fallback', () => {
  const restored = mapSubmittedApplication({
    applicantName: 'Bad Date',
    visaType: 'tourist',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    referenceCode: 'RIG-BADD',
    selfieCaptured: true,
    submittedAt: 'invalid-timestamp',
  })
  assert.equal(restored.issuedDate, 'DATE ON FILE')
})

test('mapSubmittedApplication never overwrites an existing serial/issuedDate, even on an otherwise-complete record', () => {
  const restored = mapSubmittedApplication({
    applicantName: 'Has Both',
    visaType: 'special',
    slot: 'TUE, 2 SEPT 2025 — MORNING',
    referenceCode: 'RIG-BOTH',
    selfieCaptured: true,
    serial: 'SN-123456',
    issuedDate: '02/09/2025',
    submittedAt: '2099-01-01T00:00:00.000Z',
  })
  assert.equal(restored.serial, 'SN-123456')
  assert.equal(restored.issuedDate, '02/09/2025')
})

test('mapSubmittedApplication does not synthesize serial/issuedDate for a record missing slot/referenceCode/selfie, even with a visaType', () => {
  const missingSlot = mapSubmittedApplication({
    applicantName: 'No Slot',
    visaType: 'tourist',
    referenceCode: 'RIG-NOSL',
    selfieCaptured: true,
  })
  assert.equal(missingSlot.serial, null)
  assert.equal(missingSlot.issuedDate, null)

  const missingReference = mapSubmittedApplication({
    applicantName: 'No Ref',
    visaType: 'tourist',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    selfieCaptured: true,
  })
  assert.equal(missingReference.serial, null)
  assert.equal(missingReference.issuedDate, null)

  const noSelfie = mapSubmittedApplication({
    applicantName: 'No Selfie',
    visaType: 'tourist',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    referenceCode: 'RIG-NOSF',
    selfieCaptured: false,
  })
  assert.equal(noSelfie.serial, null)
  assert.equal(noSelfie.issuedDate, null)
})

test('mapSubmittedApplication prefers the record\'s own selfieThumbnailUrl directly', () => {
  const withOwnThumbnail = mapSubmittedApplication({
    applicantName: 'Has Thumb',
    visaType: 'tourist',
    referenceCode: 'RIG-THMB',
    selfieCaptured: true,
    selfieThumbnailUrl: 'data:image/jpeg;base64,ownthumb',
  })
  assert.equal(withOwnThumbnail.selfieThumbnailUrl, 'data:image/jpeg;base64,ownthumb')

  const withoutOwnThumbnail = mapSubmittedApplication({
    applicantName: 'No Thumb',
    visaType: 'tourist',
    referenceCode: 'RIG-NOTH',
    selfieCaptured: true,
  })
  assert.equal(withoutOwnThumbnail.selfieThumbnailUrl, null)
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

test('mergeSelfieThumbnail rescues a thumbnail into the exact-matching row and never touches any other row', () => {
  const log = [
    { referenceCode: 'RIG-ABCD', applicantName: 'Ada' },
    { referenceCode: 'RIG-WXYZ', applicantName: 'Someone Else' },
  ]
  const next = mergeSelfieThumbnail(log, 'RIG-ABCD', 'data:image/jpeg;base64,rescued')
  assert.notEqual(next, log)
  assert.equal(next[0].selfieThumbnailUrl, 'data:image/jpeg;base64,rescued')
  assert.equal(next[0].applicantName, 'Ada')
  // The other application's row must be byte-for-byte untouched.
  assert.equal(next[1], log[1])
  assert.equal(next[1].selfieThumbnailUrl, undefined)
})

test('mergeSelfieThumbnail is a same-reference no-op when no row matches the reference code', () => {
  const log = [{ referenceCode: 'RIG-WXYZ', applicantName: 'Someone Else' }]
  const next = mergeSelfieThumbnail(log, 'RIG-NOPE', 'data:image/jpeg;base64,rescued')
  assert.equal(next, log)
})

test('mergeSelfieThumbnail is a same-reference no-op on an empty log', () => {
  const next = mergeSelfieThumbnail([], 'RIG-ABCD', 'data:image/jpeg;base64,rescued')
  assert.deepEqual(next, [])
})

test('mergeSelfieThumbnail is a same-reference no-op when the matching row already has the exact same thumbnail', () => {
  const log = [{ referenceCode: 'RIG-ABCD', selfieThumbnailUrl: 'data:image/jpeg;base64,same' }]
  const next = mergeSelfieThumbnail(log, 'RIG-ABCD', 'data:image/jpeg;base64,same')
  assert.equal(next, log)
})

test('isFinalizedApplicationState is true for a genuinely complete application state', () => {
  const complete = {
    ...EMPTY_STATE,
    visaType: 'tourist',
    serial: 'SN-123456',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    issuedDate: '13/09/2026',
    referenceCode: 'RIG-ABCD',
    selfieCaptured: true,
  }
  assert.equal(isFinalizedApplicationState(complete), true)
})

test('isFinalizedApplicationState is true for a legacy-complete record once mapSubmittedApplication synthesizes serial/issuedDate', () => {
  const legacyComplete = mapSubmittedApplication({
    applicantName: 'Old Timer',
    visaType: 'tourist',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    referenceCode: 'RIG-OLDX',
    selfieCaptured: true,
    submittedAt: '2026-09-01T12:00:00.000Z',
    // No serial, no issuedDate on the record itself — mapSubmittedApplication
    // synthesizes both (see the dedicated mapper test above), and this
    // predicate must accept the synthesized result exactly like a
    // genuinely-issued one.
  })
  assert.equal(isFinalizedApplicationState(legacyComplete), true)
})

test('isFinalizedApplicationState is false for a genuinely incomplete/corrupt local record — one missing field at a time', () => {
  const complete = {
    ...EMPTY_STATE,
    visaType: 'tourist',
    serial: 'SN-123456',
    slot: 'SUN, 13 SEPT 2026 — AFTERNOON',
    issuedDate: '13/09/2026',
    referenceCode: 'RIG-ABCD',
    selfieCaptured: true,
  }
  for (const field of ['visaType', 'serial', 'slot', 'issuedDate', 'referenceCode']) {
    assert.equal(isFinalizedApplicationState({ ...complete, [field]: null }), false, `expected false with ${field} missing`)
  }
  assert.equal(isFinalizedApplicationState({ ...complete, selfieCaptured: false }), false)
  // A record whose visaType survived (e.g. mid-funnel, or a corrupt local
  // log entry) but genuinely never finished — same shape
  // mapSubmittedApplication's own "otherwise incomplete" branch leaves null
  // for serial/issuedDate — must also fail closed, not just the individual
  // deletions above.
  const midFunnel = mapSubmittedApplication({ applicantName: 'Mid Funnel', visaType: 'tourist' })
  assert.equal(isFinalizedApplicationState(midFunnel), false)
})

test('isFinalizedApplicationState is false for the empty/fresh state', () => {
  assert.equal(isFinalizedApplicationState(EMPTY_STATE), false)
})

test('isFreshApplicationState is false once any other field diverges from EMPTY_STATE', () => {
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', applicantName: 'Ignas' }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', dutyFreeItems: ['Snacks'] }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', intel: { ip: '1.2.3.4' } }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', selfieRetakes: 1 }), false)
  assert.equal(isFreshApplicationState({ ...EMPTY_STATE, draftId: 'd', visaType: 'tourist' }), false)
})
