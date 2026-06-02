# Cookie Jar — app context (`apps/cookie-jar`)

> Read the repo-root `CLAUDE.md` and `SCHEMA_RULES.md` first — they govern every app.
> **Keep `Current state` and `Next` (bottom) up to date — update them after every change.**

David Goggins' cookie jar: bank the hard things you've conquered, reach in for fuel when
you're hurting. Multiple named jars, each holding cookies (a win = title + optional story +
optional date). Two modes: **show all**, or **reach in** for a random one revealed with a
small animation. Private; sharing is IRL ("here's the cookie I drew").

## Stack
- Next.js 15 (App Router, `next 15.5.18`) + React 19 + TypeScript
- **`app/` layout** + **flat ESLint** (`eslint.config.mjs`) — matches Lock In / Focus Gate, not the hub's `src/`.
- Tailwind 3, **mauve base + coral accent** (canonical palette, dark only — see root `CLAUDE.md`). Tokens hardcoded as hex in `tailwind.config.ts` (no `@radix-ui/colors` dep, same as the other apps).
- Tabler icons (`@tabler/icons-react`), Supabase SSR (Google OAuth), PWA (`public/sw.js`, `public/manifest.json`).
- Prod: `icefrosst-cookie-jar.vercel.app` (Vercel project `icefrosst-cookie-jar`, Root Directory `apps/cookie-jar`).

## Conventions
- App code in `app/`; components in `components/`; helpers/types in `lib/`; `@/*` → app root.
- Supabase clients in `lib/supabase/` (`client.ts` browser, `server.ts` SSR); `middleware.ts` only refreshes the session.
- Types in `lib/types.ts` (`Jar`, `Cookie`). Date formatting in `lib/format.ts` (`formatEarned`, parses date-only component-wise to avoid TZ shift).
- Bottom sheets share `components/Sheet.tsx` (dim backdrop, `rounded-t-3xl`, Escape-to-close, safe-area padded).
- All DB access via `.schema('cookie_jar').from('jars' | 'cookies')`.

## Data model
- New **`cookie_jar`** schema. `supabase/migrations/`:
  - `0001_cookie_jar_schema.sql` — `jars (id, user_id, name, created_at)` and `cookies (id, user_id, jar_id→jars, title, description, earned_on, created_at)`. RLS enabled, owner-only policies (`user_id = auth.uid()`). `on delete cascade` from jar → cookies and from `auth.users`.
  - `0002_grant_cookie_jar_api_access.sql` — grants + **reminder that `cookie_jar` must be in PostgREST's exposed-schema list** (`db_schema = 'public,graphql_public,hub,focus_gate,cookie_jar'`), or API reads 404.
- Additive-only (`SCHEMA_RULES.md`); never drop/rename.

## Gotchas
- **Exposed-schema list**: like `focus_gate`, the `cookie_jar` schema must be added to the Supabase project's PostgREST exposed schemas (project config / Management API `PATCH …/config/postgrest`), not just granted — otherwise every query 404s. Set when the migration is applied.
- Title is the only required cookie field; `description`/`earned_on` are nullable — components must handle null.
- `reachIn` picks client-side from already-loaded cookies and avoids immediately repeating the cookie already on screen (when the jar has >1). No DB round-trip per draw.
- Active jar is remembered in `localStorage` (`cookie-jar:active`); falls back to the first jar.
- PWA icons are generated from an inline SVG via `scripts/gen-icons.mjs` (uses `sharp`) — it also copies the 512 into `apps/hub/public/app-icons/cookie-jar.png` for the launcher tile. Re-run if the icon changes.

## Current state
Built, not yet deployed. Full flow works locally: Google sign-in landing → multiple named
jars (create / switch via pill bar / rename / delete) → add cookies (title + optional story +
date) → **Show all** list and **Reach in** random-cookie reveal (coral cookie, draw
animation, "reach in again"). Tap a cookie for detail + remove. Sign-out in the header.
Optimistic writes with rollback on error. Registered in the hub (`apps.json` + `cookie` icon
mapped + tile icon copied). Coral accent on the mauve dark base.

**Still to do before it's live:** create the Vercel project (`icefrosst-cookie-jar`, Root
Directory `apps/cookie-jar`, `turbo-ignore`), apply both SQL migrations to project
`qcsyihymmaktkbqfxlkl`, add `cookie_jar` to the PostgREST exposed-schema list, and add the
focus-gate-style auth redirect URL for this app's domain. Production ships from `main`.

## Next
- Apply migrations + expose schema + create Vercel project + auth redirect URL, then test on phone.
- Possible polish: jar reordering, cookie edit (not just add/remove), a "draw history" so reach-in feels less repetitive, haptics on reach-in.
