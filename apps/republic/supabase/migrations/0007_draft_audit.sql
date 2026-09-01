-- Abandoned applications: append-only, officer-readable draft history.
-- Anonymous applicants may INSERT only; only ministry sessions may SELECT.
-- Browser audit values are deliberately bounded and never contain raw images.

alter table republic.applications
  add column if not exists draft_id uuid;
create index if not exists applications_draft_id_idx
  on republic.applications (draft_id);

create table if not exists republic.draft_events (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  draft_id uuid not null,
  created_at timestamptz not null default now(),
  client_at timestamptz not null,
  event_type text not null,
  field text,
  previous_value jsonb,
  value jsonb,
  sequence integer not null,
  constraint draft_events_event_type_check check (event_type in ('draft_started', 'field_changed', 'intel_collected', 'submitted')),
  constraint draft_events_field_check check (
    (event_type = 'field_changed' and field in (
      'applicantName', 'instagramHandle', 'gender', 'visaType',
      'sidequestIdea', 'sidequestSupplies', 'specialOtherness',
      'specialStatement', 'businessPitch', 'fianceAnswers', 'slot',
      'declaredIq', 'declaredConfidence', 'screeningQuestion',
      'screeningAnswer', 'dutyFreeItems', 'selfieRetakes'
    ))
    or (event_type <> 'field_changed' and field is null)
  ),
  constraint draft_events_sequence_check check (sequence > 0),
  -- `intel_collected` events carry the officer-eyes-only visitor probe
  -- (see apps/republic/lib/intel.ts / lib/draftAudit.ts's INTEL_FIELDS
  -- whitelist, which `recordDraftIntel` already enforces client-side). This
  -- mirrors that whitelist at the DB layer: a plain check constraint can't
  -- run a set-returning subquery, so instead of `IN (SELECT ...)` this
  -- subtracts every known-good key (the `jsonb - text[]` key-removal
  -- operator) and requires nothing to be left over, plus `jsonb_typeof`
  -- to reject non-object payloads (arrays/scalars) outright. Keep this key
  -- list in exact sync with `INTEL_FIELDS` in lib/draftAudit.ts.
  constraint draft_events_intel_keys_check check (
    event_type <> 'intel_collected'
    or (
      value is not null
      and jsonb_typeof(value) = 'object'
      and value - array[
        'ip', 'country', 'region', 'city', 'ipTimezone', 'deviceTimezone',
        'referrer', 'fromInstagram', 'battery', 'connection'
      ]::text[] = '{}'::jsonb
    )
  ),
  constraint draft_events_previous_size_check check (
    previous_value is null or octet_length(convert_to(previous_value::text, 'utf8')) <= 12288
  ),
  constraint draft_events_value_size_check check (
    value is null or octet_length(convert_to(value::text, 'utf8')) <= 12288
  ),
  constraint draft_events_no_image_payload_check check (
    -- Reject every data URI media/type, not just image/video, plus the
    -- encoding marker even when a caller omits the `data:` prefix.
    lower(coalesce(previous_value::text, '')) not like '%data:%'
    and lower(coalesce(previous_value::text, '')) not like '%;base64,%'
    and lower(coalesce(value::text, '')) not like '%data:%'
    and lower(coalesce(value::text, '')) not like '%;base64,%'
    and lower(coalesce(previous_value::text, '')) not like '%selfiedataurl%'
    and lower(coalesce(previous_value::text, '')) not like '%selfiethumbnail%'
    and lower(coalesce(previous_value::text, '')) not like '%photoinput%'
    and lower(coalesce(value::text, '')) not like '%selfiedataurl%'
    and lower(coalesce(value::text, '')) not like '%selfiethumbnail%'
    and lower(coalesce(value::text, '')) not like '%photoinput%'
  )
);

create unique index if not exists draft_events_event_id_key
  on republic.draft_events (event_id);
create index if not exists draft_events_draft_created_idx
  on republic.draft_events (draft_id, created_at asc, id asc);
create index if not exists draft_events_draft_sequence_idx
  on republic.draft_events (draft_id, sequence);

alter table republic.draft_events enable row level security;

drop policy if exists "anon can insert draft events" on republic.draft_events;
create policy "anon can insert draft events"
  on republic.draft_events for insert
  to anon
  with check (true);

drop policy if exists "ministry can read draft events" on republic.draft_events;
create policy "ministry can read draft events"
  on republic.draft_events for select
  to authenticated
  using (republic.is_ministry());

revoke all on republic.draft_events from anon, authenticated;
grant usage on schema republic to anon, authenticated;
grant insert on republic.draft_events to anon;
grant select on republic.draft_events to authenticated;

do $$
declare
  seq text;
begin
  seq := pg_get_serial_sequence('republic.draft_events', 'id');
  if seq is null then
    raise exception 'missing identity sequence for republic.draft_events';
  end if;
  execute format('grant usage on sequence %s to anon', seq);
end $$;
