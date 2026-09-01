-- Officer-eyes-only visitor intel (IP, IP-geo, Instagram origin, battery,
-- connection class, selfie retakes — see apps/republic/lib/intel.ts).
-- Additive-only. Same access model as everything else here: anon writes it,
-- only the ministry email can read it back (policies from migration 0004).
alter table republic.applications
  add column if not exists intel jsonb;

-- Keep officer-only intel bounded and strictly limited to the fields collected
-- by lib/intel.ts. Textual checks intentionally reject image/blob transport
-- payloads even when they are hidden inside an otherwise-valid JSON object.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'applications_intel_check'
      and conrelid = 'republic.applications'::regclass
  ) then
    alter table republic.applications
      add constraint applications_intel_check check (
        intel is null or (
          jsonb_typeof(intel) = 'object'
          and intel - array[
            'ip', 'country', 'region', 'city', 'ipTimezone', 'deviceTimezone',
            'referrer', 'fromInstagram', 'battery', 'connection', 'selfieRetakes'
          ]::text[] = '{}'::jsonb
          and octet_length(convert_to(intel::text, 'utf8')) <= 12288
          and lower(intel::text) not like '%data:%'
          and lower(intel::text) not like '%;base64,%'
          -- `selfieRetakes` is the sole approved selfie-prefixed key. The
          -- replacement avoids rejecting that exact key while catching nested
          -- or top-level selfie/photo/blob transport keys.
          and replace(lower(intel::text), '"selfieretakes"', '') !~ '"selfie[^"]*"\s*:'
          and lower(intel::text) !~ '"photo[^"]*"\s*:'
          and lower(intel::text) !~ '"blob[^"]*"\s*:'
          and lower(intel::text) !~ '"thumbnail[^"]*"\s*:'
          and lower(intel::text) !~ '"dataurl[^"]*"\s*:'
        )
      );
  end if;
end
$$;
