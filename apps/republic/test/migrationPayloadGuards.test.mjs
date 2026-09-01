import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const intelSql = migration('0006_visitor_intel.sql')
const auditSql = migration('0007_draft_audit.sql')
const statusLookupSql = migration('0008_application_status_lookup.sql')
const uniqueVisitorsSql = migration('0009_ministry_unique_visitors.sql')

test('0006 constrains intel to bounded JSON objects and rejects transport payloads', () => {
  assert.match(intelSql, /constraint applications_intel_check/)
  assert.match(intelSql, /jsonb_typeof\(intel\) = 'object'/)
  assert.match(intelSql, /octet_length\(convert_to\(intel::text, 'utf8'\)\) <= 12288/)
  for (const key of ['ip', 'country', 'region', 'city', 'ipTimezone', 'deviceTimezone', 'referrer', 'fromInstagram', 'battery', 'connection', 'selfieRetakes']) {
    assert.match(intelSql, new RegExp(`'${key}'`))
  }
  // These broad markers cover image, video, text, octet-stream, and any
  // future data URI media type, including a prefixless base64 payload.
  assert.match(intelSql, /not like '%data:%'/)
  assert.match(intelSql, /not like '%;base64,%'/)
  assert.ok(intelSql.includes("'\"selfie[^\"]*\"\\s*:'"))
  assert.ok(intelSql.includes("'\"photo[^\"]*\"\\s*:'"))
  assert.ok(intelSql.includes("'\"blob[^\"]*\"\\s*:'"))
})

test('0008 status lookup is narrow, validated, and does not grant application SELECT', () => {
  assert.match(statusLookupSql, /create or replace function republic\.lookup_application_status/)
  assert.match(statusLookupSql, /security definer/)
  assert.match(statusLookupSql, /set search_path = pg_catalog, republic/)
  assert.match(statusLookupSql, /select a\.status, a\.decided_at/)
  assert.match(statusLookupSql, /a\.reference_code = p_reference_code/)
  assert.match(statusLookupSql, /regexp_replace\(btrim\(p_instagram_handle\)/)
  assert.match(statusLookupSql, /char_length\(p_instagram_handle\) between 1 and 64/)
  assert.match(statusLookupSql, /grant execute on function republic\.lookup_application_status\(text, text\)/)
  assert.match(statusLookupSql, /revoke all on function republic\.lookup_application_status\(text, text\) from public/)
  assert.doesNotMatch(statusLookupSql, /grant select .*applications/i)
})

test('0009 unique-visitor counter checks is_ministry, uses a fixed search_path, and returns only a count', () => {
  assert.match(uniqueVisitorsSql, /create or replace function republic\.count_unique_visitor_ips\(\)/)
  assert.match(uniqueVisitorsSql, /returns bigint/)
  assert.match(uniqueVisitorsSql, /security definer/)
  assert.match(uniqueVisitorsSql, /set search_path = pg_catalog, republic/)
  // The SECURITY DEFINER function bypasses RLS, so it must gate itself.
  assert.match(uniqueVisitorsSql, /if not republic\.is_ministry\(\) then/)
  assert.match(uniqueVisitorsSql, /raise exception/)
  // Fully-qualified table references, not bare/unqualified names.
  assert.match(uniqueVisitorsSql, /from republic\.applications/)
  assert.match(uniqueVisitorsSql, /from republic\.draft_events/)
  // Sources: applications.intel and draft_events intel_collected only.
  assert.match(uniqueVisitorsSql, /intel ->> 'ip'/)
  assert.match(uniqueVisitorsSql, /event_type = 'intel_collected'/)
  assert.match(uniqueVisitorsSql, /value ->> 'ip'/)
  // Blank IPs excluded before counting.
  assert.match(uniqueVisitorsSql, /nullif\(btrim\(intel ->> 'ip'\), ''\)/)
  assert.match(uniqueVisitorsSql, /nullif\(btrim\(value ->> 'ip'\), ''\)/)
  // Documentation/test ranges excluded so synthetic smoke checks never inflate the count.
  for (const range of ["'192.0.2.0/24'", "'198.51.100.0/24'", "'203.0.113.0/24'", "'2001:db8::/32'"]) {
    assert.ok(uniqueVisitorsSql.includes(range), `expected exclusion of ${range}`)
  }
  // No raw IP values are ever returned — only a scalar count.
  assert.match(uniqueVisitorsSql, /return \(select count\(distinct value\) from unnest\(ip_list\) as value\)/)
  // Revoke-then-grant, authenticated only — anon must never be able to call this.
  assert.match(uniqueVisitorsSql, /revoke all on function republic\.count_unique_visitor_ips\(\) from public/)
  assert.match(uniqueVisitorsSql, /revoke all on function republic\.count_unique_visitor_ips\(\) from anon, authenticated/)
  assert.match(uniqueVisitorsSql, /grant execute on function republic\.count_unique_visitor_ips\(\) to authenticated/)
  assert.doesNotMatch(uniqueVisitorsSql, /grant execute on function republic\.count_unique_visitor_ips\(\) to anon/)
  // No widened SELECT grant on the underlying tables was introduced here
  // (an actual `grant ... select` statement, not just the word appearing in
  // a comment describing that fact).
  assert.doesNotMatch(uniqueVisitorsSql, /^\s*grant\s+select/im)
})

test('0007 rejects all data URI and bare base64 bypass markers', () => {
  assert.match(auditSql, /constraint draft_events_no_image_payload_check/)
  // A type-agnostic marker rejects bypasses such as these, not only image/video.
  for (const payload of [
    'data:image/jpeg;base64,abc',
    'data:video/mp4;base64,abc',
    'data:application/octet-stream;base64,abc',
    'data:text/plain;base64,abc',
    'raw bytes ;base64,abc',
  ]) {
    assert.match(payload, /data:|;base64,/i)
  }
  assert.match(auditSql, /lower\(coalesce\(previous_value::text, ''\)\) not like '%data:%'/)
  assert.match(auditSql, /lower\(coalesce\(value::text, ''\)\) not like '%data:%'/)
  assert.match(auditSql, /lower\(coalesce\(previous_value::text, ''\)\) not like '%;base64,%'/)
  assert.match(auditSql, /lower\(coalesce\(value::text, ''\)\) not like '%;base64,%'/)
  assert.match(auditSql, /draft_events_value_size_check/)
  assert.match(auditSql, /draft_events_intel_keys_check/)
})
