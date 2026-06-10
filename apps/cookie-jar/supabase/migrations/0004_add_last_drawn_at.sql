-- Cookie Jar: weighted reach-in draws. Additive only (SCHEMA_RULES.md) — a new
-- nullable column; older app versions ignore it. Idempotent.
-- Applied to project qcsyihymmaktkbqfxlkl on 2026-06-10.

alter table cookie_jar.cookies
  add column if not exists last_drawn_at timestamptz;
