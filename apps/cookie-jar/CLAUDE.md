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
  - `0003_add_jar_color.sql` — adds `jars.color text not null default 'coral'` (the jar accent). Additive; applied to `qcsyihymmaktkbqfxlkl`.
  - `0004_add_last_drawn_at.sql` — adds `cookies.last_drawn_at timestamptz` (nullable; when the cookie was last drawn by reach-in). Additive; applied to `qcsyihymmaktkbqfxlkl`.
  - `0005_narrow_grants.sql` — revokes `anon`'s table/sequence grants on `cookie_jar` (schema usage stays). Defense-in-depth; the app always queries as `authenticated`. Applied to `qcsyihymmaktkbqfxlkl`.
- **Weighted draws:** reach-in sorts the jar's cookies by `last_drawn_at` ascending (never-drawn nulls first), takes the first `ceil(n/2)`, picks uniformly among those — least-recently-drawn bias. The drawn row's `last_drawn_at` is updated to now (failures ignored — it's bias metadata, not user data).
- Additive-only (`SCHEMA_RULES.md`); never drop/rename.

## Gotchas
- **Exposed-schema list**: like `focus_gate`, the `cookie_jar` schema must be added to the Supabase project's PostgREST exposed schemas (project config / Management API `PATCH …/config/postgrest`), not just granted — otherwise every query 404s. Set when the migration is applied.
- Title is the only required cookie field; `description`/`earned_on` are nullable — components must handle null.
- `reachIn` picks client-side from already-loaded cookies — filtered to the active jar's `jar_id` (right after a swipe `cookies` can still hold the previous jar) and biased toward least-recently-drawn (see Data model). Avoids immediately repeating the cookie already on screen (when the jar has >1); the only per-draw DB write is the fire-and-forget `last_drawn_at` update.
- Active jar is remembered in `localStorage` (`cookie-jar:active`); falls back to the first jar.
- PWA icons are generated from an inline SVG via `scripts/gen-icons.mjs` (uses `sharp`) — it also copies the 512 into `apps/hub/public/app-icons/cookie-jar.png` for the launcher tile. Re-run if the icon changes.

## Current state
Built and wired for deploy. Full flow:
Google sign-in landing → **jar shelf** home: a coverflow carousel (`components/JarShelf.tsx`)
you swipe through — the centered jar is big (`components/JarVisual.tsx`, one ball per cookie,
balls shrink to fit, gravity-settled via `lib/jar.ts`), neighbours rotate away like bottles on
a shelf. `JarVisual` draws a **3D cylinder** (elliptical rim + lid cap, curved base, horizontal
cylinder shading, ground shadow) so it still reads as a solid object when `rotateY`-ed — not a
flat card. It's **transparent** (floats on the page — no background card/glow); the glass + lid
are **tinted by the jar's `color`** (`JAR_COLORS` in `lib/jar.ts`; `darken`/`lighten`/`hexToRgba`
do the shading). Edge spacers
let the first/last jar reach dead-centre. The shelf reports the centered index; **the main
screen shows that jar's name + count + action row right there**: **Reach in** (tinted to the
jar colour), **+** (add cookie), **⚙** (jar settings), plus **Show all cookies** + dots.
Fresh account shows just a dashed **+** to create the first jar.

**Reach in** = weighted random-cookie reveal (`cookie-draw` pop, "reach in again", avoids
immediate repeats, least-recently-drawn bias via `last_drawn_at` — see Data model; the button
is disabled while the jar's cookies are loading so a swipe can't draw from the wrong jar).
**Tap the jar / Show all** → the cookie **list** view (back + name + ⚙; tap a cookie
for detail + remove). **Jar settings** (`JarMenuSheet`) = rename, **colour picker** (7 swatches),
delete. **New jar** (`NewJarSheet`) also picks a colour; creating centres the new jar on the
shelf (shelf keyed on `jars.length` so it remounts to `focusId`). Per-jar counts loaded up
front (one `cookies(jar_id)` query, tallied client-side); the centred jar's cookies load on
swipe (load errors keep the previous rows/counts instead of zeroing them). Optimistic writes
with rollback — cookie delete **and** jar rename/recolor/delete all snapshot-and-restore on
error. The add-cookie / new-jar sheets stay open on a failed insert (quiet in-sheet error) so
typed input is never lost; `Sheet` locks body scroll while open. Service worker is
`cookie-jar-v2`: activate prunes old caches, skips `/api/` + `/auth/` + Supabase/Google, only
caches `res.ok` same-origin GETs, offline fallback returns `Response.error()` on a cache miss.
Middleware matcher excludes `manifest.json`/`sw.js`/`icons/` so PWA asset fetches skip the
auth round-trip. Coral base accent on the mauve dark theme; per-jar
colour for the glass. Registered in the hub (`apps.json` + `cookie` icon + tile image).

`JarSwitcher.tsx` is dead code (no longer imported) — kept, safe to delete.

Infra **done**: migrations `0001`–`0005` applied to `qcsyihymmaktkbqfxlkl`; `cookie_jar` added
to the PostgREST exposed-schema list (`public,graphql_public,hub,focus_gate,cookie_jar`); auth
redirect URLs added for `icefrosst-cookie-jar.vercel.app` + a preview wildcard; Vercel project
`icefrosst-cookie-jar` created (Root Directory `apps/cookie-jar`, `turbo-ignore`, prod branch
`main`, Supabase env vars injected). Not yet verified on a real device.

## Next
- **Test on a phone** — shelf swipe/centering, recolour a jar, reach in, add/show-all. Coverflow + colours verified via static Playwright renders, not live touch.
- Possible polish: jar reordering, cookie **edit**, draw history, haptics on reach-in/swipe-snap, momentum tuning on the shelf; tint the reach-in modal/add sheet to the jar colour too.
- `JarSwitcher.tsx` is dead code — delete when convenient.
