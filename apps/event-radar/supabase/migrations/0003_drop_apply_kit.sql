-- 0003 — drop the Apply Kit tables.
--
-- ⚠️  THIS IS A DELIBERATE, OWNER-AUTHORISED EXCEPTION TO IRON RULE #2
--     (schema is additive only, forever — see root SCHEMA_RULES.md).
--
-- It is recorded here rather than done silently so the migration history stays
-- an honest record of what the database actually looks like.
--
-- Why the exception was safe to grant, checked before running:
--   * both tables were EMPTY (0 rows each) on 2026-07-30, so no user data was
--     destroyed;
--   * no foreign keys, views or other objects referenced either table;
--   * the Apply Kit feature was removed entirely in the preceding change, so no
--     shipped code path reads or writes them — including older installed PWA
--     copies, because the client code that touched these tables is gone from
--     every version that could still be cached.
--
-- The usual reason the rule exists — an older client still reading/writing —
-- does not apply here precisely because the feature was scratched rather than
-- migrated. Do NOT treat this as a precedent for dropping a table that any
-- shipped version still touches.

drop table if exists hackathon.application_drafts;
drop table if exists hackathon.application_profiles;
