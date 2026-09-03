import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// lib/finalPassportDocument.ts and components/FinalPassport.tsx have runtime
// relative value imports (./content, ./visaAddendum, @/lib/finalPassportDocument,
// etc.) that only resolve inside a bundler, not under Node's native ESM
// resolver this test suite runs with (--experimental-strip-types, no
// bundler) — same documented constraint as lib/api.ts, see
// test/api.test.mjs's file header comment. So, same convention as
// test/migrationPayloadGuards.test.mjs uses for SQL migrations, this suite
// asserts on the relevant files' own source text for the guarantees that
// matter here, rather than executing the module. Executable coverage of the
// finalized-state predicate these callsites gate on lives in
// test/applicationState.test.mjs (isFinalizedApplicationState — complete,
// legacy-complete, and per-field-missing/incomplete cases).
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const finalPassportDocumentSrc = read('lib/finalPassportDocument.ts')
const finalPassportComponentSrc = read('components/FinalPassport.tsx')
const visaIssuedSrc = read('app/visa-issued/page.tsx')
const landingSrc = read('app/page.tsx')
const applicationStateSrc = read('lib/applicationState.ts')

test('buildFinalPassportDocument builds the standard finalized-passport field set (name/passport/visaType/other/sex, then optional iq/confidence, then appointment)', () => {
  assert.match(finalPassportDocumentSrc, /export function buildFinalPassportDocument\(state: ApplicationState\)/)
  for (const key of ['name', 'passport', 'visaType', 'other', 'sex', 'iq', 'confidence', 'appointment']) {
    assert.match(finalPassportDocumentSrc, new RegExp(`key: '${key}'`))
  }
  // IQ/confidence are conditional on the matching declared value existing.
  assert.match(finalPassportDocumentSrc, /state\.declaredIq !== null/)
  assert.match(finalPassportDocumentSrc, /state\.declaredConfidence !== null/)
  // Returns null (rather than throwing) when there's no visa yet.
  assert.match(finalPassportDocumentSrc, /if \(!visa\) return null/)
})

test('buildFinalPassportDocument builds every addendum kind (otherness/sub-step/screening/decision-time/duty-free) and the FULLY EQUIPPED corner stamp', () => {
  for (const key of ['otherness', 'subStep', 'decisionTime', 'duty-free']) {
    assert.match(finalPassportDocumentSrc, new RegExp(`key: '${key}'`))
  }
  assert.match(finalPassportDocumentSrc, /key: `screening-\$\{index\}`/)
  assert.match(finalPassportDocumentSrc, /cornerStamp:\s*\n?\s*state\.visaType === 'tourist' && isFullyEquipped\(state\.sidequestSupplies\) \? FULLY_EQUIPPED_STAMP : undefined/)
})

test('FinalPassport is the ONE shared presentation component — wrapper, VisaDocument, photo selection, and StampSlam all in one place — and forwards its root DOM ref', () => {
  assert.match(finalPassportComponentSrc, /import \{ StampSlam \} from '\.\/StampSlam'/)
  assert.match(finalPassportComponentSrc, /import \{ VisaDocument \} from '\.\/VisaDocument'/)
  assert.match(finalPassportComponentSrc, /import \{ buildFinalPassportDocument \} from '@\/lib\/finalPassportDocument'/)
  // Forwards a ref to its own root node — this is what lets /visa-issued's
  // DOWNLOAD VISA (DOM capture via html-to-image) keep capturing the exact
  // shared component instead of some other wrapper node.
  assert.match(finalPassportComponentSrc, /forwardRef<HTMLDivElement, FinalPassportProps>/)
  assert.match(finalPassportComponentSrc, /<div ref={ref}/)
  // Photo source selection lives here, not duplicated per caller.
  assert.match(finalPassportComponentSrc, /photoUrl={state\.selfieDataUrl \?\? state\.selfieThumbnailUrl}/)
  assert.match(finalPassportComponentSrc, /<StampSlam/)
  assert.match(finalPassportComponentSrc, /<VisaDocument/)
})

test('/visa-issued renders the shared FinalPassport component (not its own inline VisaDocument/StampSlam JSX), forwarding documentRef for DOWNLOAD VISA capture, and gates on isFinalizedApplicationState', () => {
  assert.match(visaIssuedSrc, /import \{ FinalPassport \} from '@\/components\/FinalPassport'/)
  assert.match(visaIssuedSrc, /import \{ isFinalizedApplicationState \} from '@\/lib\/applicationState'/)
  assert.match(visaIssuedSrc, /<FinalPassport ref={documentRef} state={state} stampText={statusCopy\.stamp} stampColor={statusCopy\.stampColor} \/>/)
  assert.match(visaIssuedSrc, /if \(!isFinalizedApplicationState\(state\)\) \{/)
  assert.match(visaIssuedSrc, /if \(!hydrated \|\| !visa \|\| !isFinalizedApplicationState\(state\)\) return null/)
  // The old inline field/addenda literal construction, and the old
  // hand-rolled wrapper/VisaDocument/StampSlam JSX this extraction
  // replaced, must not have been duplicated back in.
  assert.doesNotMatch(visaIssuedSrc, /key: 'name', label: STICKER_LABELS\.name/)
  assert.doesNotMatch(visaIssuedSrc, /<VisaDocument\b/)
  assert.doesNotMatch(visaIssuedSrc, /<StampSlam\b/)
  // The old six-field completeness check must not be duplicated inline
  // anymore now that both callsites share isFinalizedApplicationState.
  assert.doesNotMatch(visaIssuedSrc, /!state\.serial \|\|\s*\n\s*!state\.slot/)
})

test('landing renders the shared FinalPassport component only when isFinalizedApplicationState(state) is true, with no boxed reference/visa/status summary and no VIEW FINAL APPLICATION button', () => {
  assert.match(landingSrc, /import \{ FinalPassport \} from '@\/components\/FinalPassport'/)
  assert.match(landingSrc, /isFinalizedApplicationState/)
  assert.match(landingSrc, /isFreshApplicationState/)
  assert.match(landingSrc, /mapSubmittedApplication/)
  assert.match(landingSrc, /from '@\/lib\/applicationState'/)
  assert.match(landingSrc, /const isFinalized = isFinalizedApplicationState\(state\)/)
  assert.match(landingSrc, /\{isFinalized && <FinalPassport state={state} stampText={statusCopy\.stamp} stampColor={statusCopy\.stampColor} \/>\}/)
  assert.match(landingSrc, /restoreSubmittedApplication\(last\)/)
  // Heading/status context survives.
  assert.match(landingSrc, /\{statusCopy\.landingHeading\}/)
  assert.match(landingSrc, /\{statusCopy\.landingNote\}/)
  // The old boxed reference/visa/status summary and its button are gone,
  // and so is the old hand-rolled VisaDocument/StampSlam JSX this
  // extraction replaced.
  assert.doesNotMatch(landingSrc, /PENDING_LANDING\.referenceLabel/)
  assert.doesNotMatch(landingSrc, /PENDING_LANDING\.visaLabel/)
  assert.doesNotMatch(landingSrc, /PENDING_LANDING\.viewFinalApplication/)
  assert.doesNotMatch(landingSrc, /statusCopy\.landingStatus/)
  assert.doesNotMatch(landingSrc, /<VisaDocument\b/)
  assert.doesNotMatch(landingSrc, /<StampSlam\b/)
  // SUBMIT ANOTHER APPLICATION stays.
  assert.match(landingSrc, /\{PENDING_LANDING\.submitAnother\}/)
})

test('landingStatus copy was removed from every decision status entry now that nothing reads it', () => {
  const contentSrc = read('lib/content.ts')
  assert.doesNotMatch(contentSrc, /landingStatus:/)
})

test('isFinalizedApplicationState is exported and checks all six /visa-issued completeness-guard fields', () => {
  assert.match(applicationStateSrc, /export function isFinalizedApplicationState\(state: ApplicationState\): boolean/)
  for (const field of ['visaType', 'serial', 'slot', 'issuedDate', 'referenceCode', 'selfieCaptured']) {
    assert.match(applicationStateSrc, new RegExp(`state\\.${field}`))
  }
})
