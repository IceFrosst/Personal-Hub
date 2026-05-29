-- =============================================
-- hub.user_app_preferences — remembers each user's
-- preferred version (stable / previous / experimental)
-- per app slug.
-- =============================================

create schema if not exists hub;

create table hub.user_app_preferences (
  user_id          uuid not null references auth.users(id) on delete cascade,
  app_slug         text not null,
  preferred_version text not null check (preferred_version in ('stable', 'previous', 'experimental')),
  updated_at       timestamptz not null default now(),
  primary key (user_id, app_slug)
);

alter table hub.user_app_preferences enable row level security;

-- Iron rule #4 — users only see/edit their own rows.
create policy "uap_select_own" on hub.user_app_preferences
  for select using ( auth.uid() = user_id );

create policy "uap_insert_own" on hub.user_app_preferences
  for insert with check ( auth.uid() = user_id );

create policy "uap_update_own" on hub.user_app_preferences
  for update using ( auth.uid() = user_id );

create policy "uap_delete_own" on hub.user_app_preferences
  for delete using ( auth.uid() = user_id );

-- Touch updated_at on every update. Reuses the function defined for public.profiles
-- in the previous migration.
create trigger user_app_preferences_updated_at
  before update on hub.user_app_preferences
  for each row execute function public.handle_updated_at();

-- Expose the `hub` schema to the Data API so the supabase-js client can read it.
-- (Default Supabase config only exposes `public`.)
grant usage on schema hub to anon, authenticated;
grant all on hub.user_app_preferences to anon, authenticated;
