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
- Bottom sheets share `components/Sheet.tsx` (dim **blurred** backdrop, grab handle, `rounded-t-3xl`, Escape-to-close, safe-area padded). The 7-colour picker is `components/ColorSwatches.tsx` (single `justify-between` row — never wraps an orphan swatch), shared by `NewJarSheet` + `JarMenuSheet`.
- All DB access via `.schema('cookie_jar').from('jars' | 'cookies')`.

## Data model
- New **`cookie_jar`** schema. `supabase/migrations/`:
  - `0001_cookie_jar_schema.sql` — `jars (id, user_id, name, created_at)` and `cookies (id, user_id, jar_id→jars, title, description, earned_on, created_at)`. RLS enabled, owner-only policies (`user_id = auth.uid()`). `on delete cascade` from jar → cookies and from `auth.users`.
  - `0002_grant_cookie_jar_api_access.sql` — grants + **reminder that `cookie_jar` must be in PostgREST's exposed-schema list** (`db_schema = 'public,graphql_public,hub,focus_gate,cookie_jar'`), or API reads 404.
  - `0003_add_jar_color.sql` — adds `jars.color text not null default 'coral'` (the jar accent). Additive; applied to `qcsyihymmaktkbqfxlkl`.
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
a shelf. `JarVisual` draws **the jar from the app logo** (same geometry as
`scripts/gen-icons.mjs` / `CookieJarLogo`: lid + darker band, rounded-square glass with the
chunky outline and highlight streak) — flat icon style, per Ignas's pick after a 5-shape
bake-off. Tight `viewBox` ("126 100 260 320") so the jar fills its box. It's **transparent**
(floats on the page); glass + lid are **tinted by the jar's `color`** (`JAR_COLORS` in
`lib/jar.ts`; `darken`/`hexToRgba` do the shading; `lighten` is currently unused). Edge spacers
let the first/last jar reach dead-centre.

The **home screen is deliberately minimal**: just the jar shelf, the centred jar's **name
directly below it**, dots, a one-line gesture hint, and **the single `+` button** (add a cookie).
No count / reach-in / settings buttons on the main screen. Gestures on the centred jar
(`JarShelf` pointer handlers — ~450 ms long-press, 12 px move tolerance so a swipe never fires a
tap): **short tap → reach in** (an empty jar instead opens add-cookie); **long-press → jar
settings**. Tapping a side jar centres it. Fresh account shows just a dashed **+**.

**Reach in** = random-cookie reveal (`cookie-draw` pop, "reach in again", avoids immediate
repeats). **Jar settings** (`JarMenuSheet`, opened by long-press) holds **Show all cookies** (→
the list view: back + name + ⚙; tap a cookie for detail + remove), **rename**, a **colour
picker** (7 swatches), and **delete**. **New jar** (`NewJarSheet`) also picks a colour; creating
centres the new jar (shelf keyed on `jars.length` so it remounts to `focusId`). Per-jar counts
loaded up front (one `cookies(jar_id)` query, tallied client-side); the centred jar's cookies
load on swipe. Optimistic writes with rollback. Coral base accent; per-jar colour for the glass.
Registered in the hub (`apps.json` + `cookie` icon + tile image).

`JarSwitcher.tsx` is dead code (no longer imported) — kept, safe to delete.

Infra **done**: migrations `0001`/`0002` applied to `qcsyihymmaktkbqfxlkl`; `cookie_jar` added
to the PostgREST exposed-schema list (`public,graphql_public,hub,focus_gate,cookie_jar`); auth
redirect URLs added for `icefrosst-cookie-jar.vercel.app` + a preview wildcard; Vercel project
`icefrosst-cookie-jar` created (Root Directory `apps/cookie-jar`, `turbo-ignore`, prod branch
`main`, Supabase env vars injected). Not yet verified on a real device.

## Next
- **Test on a phone** — the tap-vs-swipe-vs-long-press gesture split is the main thing to feel-check (verified via static renders only); also recolour a jar, reach in, add/show-all.
- Possible polish: jar reordering, cookie **edit**, draw history, haptics on reach-in + long-press, momentum tuning; tint the reach-in modal/add sheet to the jar colour too.
- `JarSwitcher.tsx` is dead code — delete when convenient.
