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
Built and wired for deploy. Full flow:
Google sign-in landing → **jar shelf** home: a coverflow carousel (`components/JarShelf.tsx`)
you swipe through — the centered jar is big (`components/JarVisual.tsx`, one ball per cookie,
balls shrink to fit, gravity-settled via `lib/jar.ts`), neighbours rotate away like bottles on
a shelf; jar name + cookie count + dots below. Fresh account shows just a dashed **+** to
create the first jar. **Tap the centered jar to open it** → detail view (back chevron + name +
menu): **Reach in** random-cookie reveal (coral cookie, `cookie-draw` pop, "reach in again",
avoids immediate repeats), **Add a cookie**, and the **All cookies** list (tap for detail +
remove). Create / rename / delete jars; creating opens the new jar to fill it. Per-jar cookie
counts loaded up front (one `cookies(jar_id)` query, tallied client-side). Optimistic writes
with rollback. Tactile `active:scale` feedback. Coral accent on the mauve dark base. Registered
in the hub (`apps.json` + `cookie` icon + tile image). Icon/logo = the jar of coloured balls.

Infra **done**: migrations `0001`/`0002` applied to `qcsyihymmaktkbqfxlkl`; `cookie_jar` added
to the PostgREST exposed-schema list (`public,graphql_public,hub,focus_gate,cookie_jar`); auth
redirect URLs added for `icefrosst-cookie-jar.vercel.app` + a preview wildcard; Vercel project
`icefrosst-cookie-jar` created (Root Directory `apps/cookie-jar`, `turbo-ignore`, prod branch
`main`, Supabase env vars injected). Not yet verified on a real device.

## Next
- **Test on a phone** — the shelf swipe/coverflow + open, create a jar, add cookies (watch balls fill), reach in. Coverflow transforms were verified via static Playwright renders, not live touch.
- `JarShelf` is unused-component `JarSwitcher`'s replacement — `JarSwitcher.tsx` is now dead code (kept, not imported); remove if desired.
- Possible polish: jar reordering, cookie **edit**, draw history, haptics on reach-in/swipe-snap, momentum tuning on the shelf.
