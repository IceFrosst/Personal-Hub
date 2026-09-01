import assert from 'node:assert/strict'
import test from 'node:test'

const { fetchUniqueVisitorCount, parseUniqueVisitorCount } = await import('../lib/ministryVisitors.ts')

test('parseUniqueVisitorCount accepts a JSON number', () => {
  assert.equal(parseUniqueVisitorCount(7), 7)
  assert.equal(parseUniqueVisitorCount(0), 0)
})

test('parseUniqueVisitorCount accepts a numeric string (PostgREST bigint serialization)', () => {
  assert.equal(parseUniqueVisitorCount('42'), 42)
})

test('parseUniqueVisitorCount unwraps a single-row RPC array response', () => {
  assert.equal(parseUniqueVisitorCount([12]), 12)
})

test('parseUniqueVisitorCount rejects malformed/negative/non-finite payloads', () => {
  assert.equal(parseUniqueVisitorCount(null), null)
  assert.equal(parseUniqueVisitorCount(undefined), null)
  assert.equal(parseUniqueVisitorCount('not-a-number'), null)
  assert.equal(parseUniqueVisitorCount(-1), null)
  assert.equal(parseUniqueVisitorCount(1.5), null)
  assert.equal(parseUniqueVisitorCount(Number.POSITIVE_INFINITY), null)
  assert.equal(parseUniqueVisitorCount({}), null)
  assert.equal(parseUniqueVisitorCount([]), null)
})

test('parseUniqueVisitorCount rejects a blank/whitespace-only numeric string rather than coercing it to 0', () => {
  assert.equal(parseUniqueVisitorCount(''), null)
  assert.equal(parseUniqueVisitorCount('   '), null)
  assert.equal(parseUniqueVisitorCount('\t\n'), null)
})

test('parseUniqueVisitorCount rejects non-integer-notation numeric strings (decimal, exponent, separators)', () => {
  assert.equal(parseUniqueVisitorCount('1.5'), null)
  assert.equal(parseUniqueVisitorCount('1e3'), null)
  assert.equal(parseUniqueVisitorCount('1,000'), null)
  assert.equal(parseUniqueVisitorCount('-1'), null)
  assert.equal(parseUniqueVisitorCount(' 42 '), 42)
})

test('parseUniqueVisitorCount requires exactly one array element, rejecting empty or multi-row responses', () => {
  assert.equal(parseUniqueVisitorCount([]), null)
  assert.equal(parseUniqueVisitorCount([7, 8]), null)
  assert.equal(parseUniqueVisitorCount([7]), 7)
})

test('parseUniqueVisitorCount rejects an integer above Number.MAX_SAFE_INTEGER (unsafe bigint precision)', () => {
  assert.equal(parseUniqueVisitorCount(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER)
  assert.equal(parseUniqueVisitorCount(Number.MAX_SAFE_INTEGER + 2), null)
  assert.equal(parseUniqueVisitorCount(String(BigInt(Number.MAX_SAFE_INTEGER) + 2n)), null)
})

test('parseUniqueVisitorCount accepts a native bigint (defensive, non-JSON transport) within safe range and rejects negative/oversized bigints', () => {
  assert.equal(parseUniqueVisitorCount(42n), 42)
  assert.equal(parseUniqueVisitorCount(0n), 0)
  assert.equal(parseUniqueVisitorCount(-1n), null)
  assert.equal(parseUniqueVisitorCount(BigInt(Number.MAX_SAFE_INTEGER) + 1n), null)
})

test('fetchUniqueVisitorCount fails closed to null with no client', async () => {
  assert.equal(await fetchUniqueVisitorCount(null), null)
})

test('fetchUniqueVisitorCount fails closed to null on an RPC error', async () => {
  const supabase = { rpc: async () => ({ data: null, error: { message: 'denied' } }) }
  assert.equal(await fetchUniqueVisitorCount(supabase), null)
})

test('fetchUniqueVisitorCount fails closed to null when the RPC call throws', async () => {
  const supabase = {
    rpc: async () => {
      throw new Error('network down')
    },
  }
  assert.equal(await fetchUniqueVisitorCount(supabase), null)
})

test('fetchUniqueVisitorCount resolves the parsed count on success', async () => {
  const supabase = { rpc: async (fn) => ({ data: fn === 'count_unique_visitor_ips' ? 5 : null, error: null }) }
  assert.equal(await fetchUniqueVisitorCount(supabase), 5)
})
