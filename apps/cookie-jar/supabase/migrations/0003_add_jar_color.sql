-- Cookie Jar: per-jar accent colour. Additive only (SCHEMA_RULES.md) — a new
-- nullable-with-default column, never renamed or dropped. Older app versions
-- ignore it; newer ones tint the jar glass. Idempotent.

alter table cookie_jar.jars
  add column if not exists color text not null default 'coral';
