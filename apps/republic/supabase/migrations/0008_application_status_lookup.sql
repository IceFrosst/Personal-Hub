-- Applicant-facing decision lookup. The public API exposes only the two fields
-- needed to update a returning applicant's screen; application rows remain
-- unreadable to anon/authenticated (see 0002/0004).
-- Additive-only per SCHEMA_RULES.md.

create or replace function republic.lookup_application_status(
  p_reference_code text,
  p_instagram_handle text
)
returns table(status text, decided_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, republic
as $$
  select a.status, a.decided_at
  from republic.applications as a
  where
    -- Reference codes are generated as RIG-XXXX. Do not trim or otherwise
    -- transform this value: the reference match is exact.
    p_reference_code is not null
    and char_length(p_reference_code) between 8 and 8
    and p_reference_code ~ '^RIG-[A-Z2-9]{4}$'
    -- Instagram handles are normalized for comparison, but bounded and
    -- restricted to Instagram's ordinary handle alphabet before querying.
    and p_instagram_handle is not null
    and char_length(p_instagram_handle) between 1 and 64
    and lower(btrim(regexp_replace(btrim(p_instagram_handle), '^@+', ''))) ~ '^[a-z0-9._]{1,30}$'
    and lower(btrim(regexp_replace(btrim(a.instagram_handle), '^@+', ''))) =
      lower(btrim(regexp_replace(btrim(p_instagram_handle), '^@+', '')))
    and a.reference_code = p_reference_code
  limit 1;
$$;

-- SECURITY DEFINER is intentionally not an application SELECT grant. The
-- function owner can perform this narrow lookup; callers can execute only it.
revoke all on function republic.lookup_application_status(text, text) from public;
revoke all on function republic.lookup_application_status(text, text) from anon, authenticated;
grant execute on function republic.lookup_application_status(text, text) to anon, authenticated;
