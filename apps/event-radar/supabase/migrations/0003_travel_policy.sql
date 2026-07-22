-- Structured travel policy (additive). Enables home-base-aware scoring.
-- Apply via Supabase Management API / SQL editor.

alter table hackathon.hackathons
  add column if not exists travel_scope text,
  add column if not exists travel_regions jsonb not null default '[]',
  add column if not exists travel_cap text,
  add column if not exists travel_notes text;

comment on column hackathon.hackathons.travel_scope is
  'none | domestic | regional | international | selective | global — from enrichment';
comment on column hackathon.hackathons.travel_regions is
  'Eligible regions/countries as free-text tokens, e.g. ["EU","US"]';
comment on column hackathon.hackathons.travel_cap is
  'Human-readable cap, e.g. "€120 EU / €200 outside"';
comment on column hackathon.hackathons.travel_notes is
  'Short quote from FAQ for the detail sheet';
