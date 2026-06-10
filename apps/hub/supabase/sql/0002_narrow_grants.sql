-- Tighten API grants: every app gates behind Google sign-in, so the anon role
-- never queries hub tables. RLS already gates rows; this is defense-in-depth.
-- Applied to project qcsyihymmaktkbqfxlkl on 2026-06-10.

revoke all on all tables in schema hub from anon;
revoke all on all sequences in schema hub from anon;
alter default privileges in schema hub revoke all on tables from anon;
alter default privileges in schema hub revoke all on sequences from anon;
