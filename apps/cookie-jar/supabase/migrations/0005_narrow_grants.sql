-- Tighten API grants: every app gates behind Google sign-in, so the anon role
-- never queries cookie_jar (RLS already gates rows; defense-in-depth only).
-- Schema usage stays granted so nothing else changes shape.
-- Applied to project qcsyihymmaktkbqfxlkl on 2026-06-10.

revoke all on all tables in schema cookie_jar from anon;
revoke all on all sequences in schema cookie_jar from anon;
alter default privileges in schema cookie_jar revoke all on tables from anon;
alter default privileges in schema cookie_jar revoke all on sequences from anon;
