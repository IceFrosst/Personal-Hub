import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// lib/api.ts has its own runtime relative imports (e.g. ./applicationStatus)
// that only resolve inside a bundler, not under Node's native ESM resolver
// this test suite runs with (--experimental-strip-types, no bundler) — see
// lib/applicationState.ts's file header comment for the same constraint on
// that (successfully directly-importable) module. So, same convention as
// test/migrationPayloadGuards.test.mjs uses for SQL migrations, this suite
// asserts on lib/api.ts's own source text for the one narrow guarantee that
// matters here (the applications table JSON omits the thumbnail/submittedAt
// fields) rather than executing the module. Processing's source is checked
// separately below because its private-Storage review-image fallback is
// intentional when full-res capture is unavailable.
const apiSource = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8')
const processingSource = readFileSync(new URL('../app/processing/page.tsx', import.meta.url), 'utf8')

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`)
  assert.ok(start !== -1, `${functionName} not found in lib/api.ts`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(bodyStart, i + 1)
    }
  }
  throw new Error(`unterminated body for ${functionName}`)
}

test('buildApplicationSupabasePayload is an extracted, independently named helper (testable without executing the module)', () => {
  assert.match(apiSource, /export function buildApplicationSupabasePayload\(record: ApplicationRecord\)/)
  assert.match(apiSource, /void tryRest\('applications', buildApplicationSupabasePayload\(record\)\)/)
})

test('buildApplicationSupabasePayload omits selfieThumbnailUrl/submittedAt from the republic.applications table JSON payload', () => {
  const body = extractFunctionBody(apiSource, 'buildApplicationSupabasePayload')
  assert.doesNotMatch(body, /selfieThumbnailUrl/)
  assert.doesNotMatch(body, /selfie_thumbnail_url/)
  assert.doesNotMatch(body, /submittedAt/)
  assert.doesNotMatch(body, /submitted_at/)
  // Sanity: the officer/DB-facing fields it's actually supposed to carry are
  // still there — this isn't just an empty/broken function.
  assert.match(body, /reference_code: record\.referenceCode/)
  assert.match(body, /selfie_captured: record\.selfieCaptured/)
  assert.match(body, /intel: record\.intel/)
})

test('recordApplication local-log write keeps selfieThumbnailUrl/submittedAt but strips intel/draftId', () => {
  const body = extractFunctionBody(apiSource, 'recordApplication')
  assert.match(body, /delete localRecord\.intel/)
  assert.match(body, /delete localRecord\.draftId/)
  assert.doesNotMatch(body, /delete localRecord\.selfieThumbnailUrl/)
  assert.doesNotMatch(body, /delete localRecord\.submittedAt/)
})

test('persistApplicationThumbnail only ever writes through the pure mergeSelfieThumbnail helper (exact-match guard lives in lib/applicationState.ts, tested there)', () => {
  const body = extractFunctionBody(apiSource, 'persistApplicationThumbnail')
  assert.match(body, /mergeSelfieThumbnail\(log, referenceCode, thumbnailUrl\)/)
  assert.match(body, /if \(next === log\) return/)
})

test('processing retains the private Storage review-image fallback when full-res selfie is unavailable', () => {
  assert.match(processingSource, /const source = state\.selfieDataUrl \?\? state\.selfieThumbnailUrl/)
  assert.match(processingSource, /uploadSelfie\(code, review \?\? source\)/)
  assert.match(processingSource, /private bucket/)
})
