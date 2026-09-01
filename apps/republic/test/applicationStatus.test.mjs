import assert from 'node:assert/strict'
import test from 'node:test'

const { normalizeInstagramHandle, parseApplicationStatus } = await import('../lib/applicationStatus.ts')

test('normalizes Instagram handles for the narrow status lookup', () => {
  assert.equal(normalizeInstagramHandle('  @@Ignas_Simanavicius  '), 'ignas_simanavicius')
})

test('parses only valid status rows and exposes decided_at as decidedAt', () => {
  assert.deepEqual(parseApplicationStatus([{ status: 'approved', decided_at: '2026-09-01T12:00:00Z', applicant_name: 'secret' }]), {
    status: 'approved',
    decidedAt: '2026-09-01T12:00:00Z',
  })
  assert.deepEqual(parseApplicationStatus({ status: 'pending', decided_at: null }), {
    status: 'pending',
    decidedAt: null,
  })
  assert.equal(parseApplicationStatus({ status: 'approved', decided_at: 123 }), null)
  assert.deepEqual(parseApplicationStatus({ status: 'approved', decided_at: null, answers: 'secret' }), {
    status: 'approved',
    decidedAt: null,
  })
})
