import assert from 'node:assert/strict'
import test from 'node:test'

import { isEventRadarAdmin } from '../lib/owner'

test('manual refresh authorization is case-insensitive and fail-closed', () => {
  const previous = process.env.EVENT_RADAR_ADMIN_EMAIL
  process.env.EVENT_RADAR_ADMIN_EMAIL = 'owner@example.com'
  try {
    assert.equal(isEventRadarAdmin('OWNER@example.com'), true)
    assert.equal(isEventRadarAdmin('someone@example.com'), false)
    assert.equal(isEventRadarAdmin(null), false)
  } finally {
    if (previous === undefined) delete process.env.EVENT_RADAR_ADMIN_EMAIL
    else process.env.EVENT_RADAR_ADMIN_EMAIL = previous
  }
})

test('manual refresh defaults to the portfolio owner without extra configuration', () => {
  const previous = process.env.EVENT_RADAR_ADMIN_EMAIL
  delete process.env.EVENT_RADAR_ADMIN_EMAIL
  try {
    assert.equal(isEventRadarAdmin('ign3107s@gmail.com'), true)
    assert.equal(isEventRadarAdmin('someone@example.com'), false)
  } finally {
    if (previous !== undefined) process.env.EVENT_RADAR_ADMIN_EMAIL = previous
  }
})
