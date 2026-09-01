-- Application review (Ministry desk): status + decision timestamp, and
-- owner-only read/decide access. Additive-only per SCHEMA_RULES.md.
--
-- Access model recap (see 0002): visitors are anonymous and WRITE-ONLY.
-- The one human allowed to read and decide applications is Ignas, signed in
-- with the portfolio's Google OAuth — policies key on the JWT email rather
-- than a hardcoded auth.uid, so they survive account re-creation.

alter table republic.applications
  add column if not exists status text not null default 'pending';
alter table republic.applications
  add column if not exists decided_at timestamptz;

-- Guard rails on the status vocabulary (new states may be ADDED later).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'applications_status_check'
  ) then
    alter table republic.applications
      add constraint applications_status_check
      check (status in ('pending', 'approved', 'denied'));
  end if;
end $$;

create or replace function republic.is_ministry()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'ign3107s@gmail.com'
$$;

drop policy if exists "ministry can read applications" on republic.applications;
create policy "ministry can read applications"
  on republic.applications for select
  to authenticated
  using (republic.is_ministry());

drop policy if exists "ministry can decide applications" on republic.applications;
create policy "ministry can decide applications"
  on republic.applications for update
  to authenticated
  using (republic.is_ministry())
  with check (republic.is_ministry());

-- RLS gates the rows; PostgREST still needs the table grants.
grant select, update on republic.applications to authenticated;
