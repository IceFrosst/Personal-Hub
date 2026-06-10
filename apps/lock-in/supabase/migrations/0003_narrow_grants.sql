-- Tighten API grants: every app gates behind Google sign-in, so the anon role
-- never queries focus_gate (RLS already gates rows; defense-in-depth only).
-- Schema usage stays granted so nothing else changes shape.
-- Applied to project qcsyihymmaktkbqfxlkl on 2026-06-10.

revoke all on all tables in schema focus_gate from anon;
revoke all on all sequences in schema focus_gate from anon;
alter default privileges in schema focus_gate revoke all on tables from anon;
alter default privileges in schema focus_gate revoke all on sequences from anon;
