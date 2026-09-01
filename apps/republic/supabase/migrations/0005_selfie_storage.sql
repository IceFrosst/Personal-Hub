-- Applicant photos for the Ministry desk. Additive-only.
--
-- A PRIVATE storage bucket: visitors (anon) may only UPLOAD their own
-- selfie at finalization (write-only, same model as the tables); only the
-- ministry email may read them back (republic.is_ministry(), migration
-- 0004). No public access, no listing for anon, no updates/deletes from
-- the browser at all — first write wins.

alter table republic.applications
  add column if not exists selfie_path text;

insert into storage.buckets (id, name, public)
values ('republic-selfies', 'republic-selfies', false)
on conflict (id) do nothing;

drop policy if exists "anon can upload republic selfies" on storage.objects;
create policy "anon can upload republic selfies"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'republic-selfies');

drop policy if exists "ministry can read republic selfies" on storage.objects;
create policy "ministry can read republic selfies"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'republic-selfies' and republic.is_ministry());
