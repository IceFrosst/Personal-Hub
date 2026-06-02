-- Cookie Jar: jars + cookies in a dedicated `cookie_jar` schema.
-- Iron rules: one Supabase project, per-app schema, additive forever, RLS on
-- every user-data table. Idempotent.

create schema if not exists cookie_jar;

-- Jars — each user names their own (multiple allowed).
create table if not exists cookie_jar.jars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists jars_user_idx on cookie_jar.jars (user_id);

-- Cookies — the hard things you've conquered. Title required; story + date optional.
create table if not exists cookie_jar.cookies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  jar_id uuid not null references cookie_jar.jars on delete cascade,
  title text not null,
  description text,
  earned_on date,
  created_at timestamptz not null default now()
);

create index if not exists cookies_jar_idx on cookie_jar.cookies (jar_id);
create index if not exists cookies_user_idx on cookie_jar.cookies (user_id);

-- Row Level Security: a user only ever sees/writes their own rows.
alter table cookie_jar.jars enable row level security;
alter table cookie_jar.cookies enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'cookie_jar' and tablename = 'jars' and policyname = 'jars_owner') then
    create policy jars_owner on cookie_jar.jars
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'cookie_jar' and tablename = 'cookies' and policyname = 'cookies_owner') then
    create policy cookies_owner on cookie_jar.cookies
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
