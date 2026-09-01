import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')
const intelSql = migration('0006_visitor_intel.sql')
const auditSql = migration('0007_draft_audit.sql')
const statusLookupSql = migration('0008_application_status_lookup.sql')

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
