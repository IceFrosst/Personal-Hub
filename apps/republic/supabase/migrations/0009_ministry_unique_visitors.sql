-- Ministry-only unique-visitor counter, by distinct collected IP string.
-- Additive-only per SCHEMA_RULES.md: no new columns, no existing grants
-- widened. Sources: republic.applications.intel->>'ip' (0006) and
-- republic.draft_events rows where event_type = 'intel_collected' and
-- value->>'ip' (0007). Blank IPs and the standard documentation/test
-- ranges are excluded so the app's own synthetic smoke checks never
-- inflate the count.
--
-- This is a SECURITY DEFINER function, so it bypasses RLS on the tables it
-- reads — it MUST perform its own authorization check rather than relying
-- on the caller's row-level access. No IP values are ever returned, only a
-- count; the function does not grant SELECT on either underlying table.

create or replace function republic.count_unique_visitor_ips()
returns bigint
language plpgsql
stable
security definer
set search_path = pg_catalog, republic
as $$
declare
  ip_list text[] := '{}';
  candidate record;
  parsed inet;
begin
  if not republic.is_ministry() then
    raise exception 'access denied';
  end if;

  for candidate in
    select nullif(btrim(intel ->> 'ip'), '') as ip
    from republic.applications
    where intel is not null and intel ->> 'ip' is not null

    union

    select nullif(btrim(value ->> 'ip'), '') as ip
    from republic.draft_events
    where event_type = 'intel_collected' and value ->> 'ip' is not null
  loop
    if candidate.ip is null then
      continue;
    end if;

    -- Collected IPs are untrusted client-reported strings; guard the cast
    -- so one malformed value can never abort the whole count.
    begin
      parsed := candidate.ip::inet;
    exception when others then
      continue;
    end;

    -- Standard documentation/test ranges (RFC 5737 + RFC 3849) are what our
    -- own synthetic smoke checks use — exclude them so they never inflate
    -- a real visitor count.
    if parsed <<= '192.0.2.0/24'::inet
      or parsed <<= '198.51.100.0/24'::inet
      or parsed <<= '203.0.113.0/24'::inet
      or parsed <<= '2001:db8::/32'::inet
    then
      continue;
    end if;

    ip_list := array_append(ip_list, host(parsed));
  end loop;

  return (select count(distinct value) from unnest(ip_list) as value);
end;
$$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Revoke it
-- explicitly, then grant only to authenticated (ministry access is enforced
-- inside the function body, not by this grant alone) — anon must not be
-- able to call this at all.
revoke all on function republic.count_unique_visitor_ips() from public;
revoke all on function republic.count_unique_visitor_ips() from anon, authenticated;
grant execute on function republic.count_unique_visitor_ips() to authenticated;
