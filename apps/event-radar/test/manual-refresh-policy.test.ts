import assert from 'node:assert/strict'
import test from 'node:test'

import { manualRefreshRejection } from '../lib/manual-refresh-policy'

const allowed = {
  signedIn: true,
  email: 'owner@example.com',
  action: 'refresh-sources',
  refreshInFlight: false,
}

test('manual refresh policy rejects unauthenticated and non-owner requests', () => {
  const previous = process.env.EVENT_RADAR_ADMIN_EMAIL
  process.env.EVENT_RADAR_ADMIN_EMAIL = 'owner@example.com'
  try {
    assert.deepEqual(manualRefreshRejection({ ...allowed, signedIn: false }), {
      error: 'unauthorized',
      status: 401,
    })
    assert.deepEqual(manualRefreshRejection({ ...allowed, email: 'friend@example.com' }), {
      error: 'forbidden',
      status: 403,
    })
  } finally {
    if (previous === undefined) delete process.env.EVENT_RADAR_ADMIN_EMAIL
    else process.env.EVENT_RADAR_ADMIN_EMAIL = previous
  }
})

test('manual refresh policy requires the action header and rejects overlapping runs', () => {
  const previous = process.env.EVENT_RADAR_ADMIN_EMAIL
  process.env.EVENT_RADAR_ADMIN_EMAIL = 'owner@example.com'
  try {
    assert.deepEqual(manualRefreshRejection({ ...allowed, action: null }), {
      error: 'invalid_action',
      status: 403,
    })
    assert.deepEqual(manualRefreshRejection({ ...allowed, refreshInFlight: true }), {
      error: 'refresh_in_progress',
      status: 409,
    })
    assert.equal(manualRefreshRejection(allowed), null)
  } finally {
    if (previous === undefined) delete process.env.EVENT_RADAR_ADMIN_EMAIL
    else process.env.EVENT_RADAR_ADMIN_EMAIL = previous
  }
})
