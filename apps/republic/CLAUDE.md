# Republic of Ignas — app context (`apps/republic`)

> Read the repo-root `CLAUDE.md` and `SCHEMA_RULES.md` first — they govern every app.
> Read `../../SIDEQUEST_PLAN.md` for the full concept/copy bank this app implements.
> **Keep `Current state` and `Next` (bottom) up to date — update them after every change to this app.**

Gamified, deadpan-bureaucracy link-in-bio for Ignas's personal Instagram, themed as
immigration/border control for the fictional "Republic of Ignas". Every visitor action
(hang out / ask advice / pitch something / ask him out) is a visa application.

## Stack

- Next.js 15 (App Router, `next 15.5.18`) + React 19 + TypeScript, `app/` (no `src/`)
- Tailwind 3 with an app-specific paper/stamp design system — **this app intentionally
  does not use the root `CLAUDE.md`'s dark-mode Radix palette**; the whole concept is an
  off-white paper government form (`#f4f0e8` paper, `#1a2a4a` navy, `#c0392b` stamp red,
  `#2e7d32` approval green). This is a deliberate, plan-mandated deviation, not drift.
- Fonts: `next/font/google` — `IBM_Plex_Mono` (`--font-plex-mono`, body/forms) and
  `Special_Elite` (`--font-special-elite`, stamps/headers via `.font-stamp`)
- No backend dependency to run: `lib/api.ts` stubs everything to localStorage; Supabase
  env vars are optional and, if present, only get a best-effort fire-and-forget POST
  wrapped in try/catch (no `republic` schema exists yet — see Data model)
- No animation library — all motion is Tailwind `keyframes`/`animation` + a couple of
  small hand-written effects (`Typewriter`, canvas draw in `visa-issued`)
- ESLint flat config (`eslint.config.mjs`), `next.config.ts` (empty)
- ⚠️ Not yet deployed to Vercel — no project created, not in `apps/hub/config/apps.json`.
  Follow the root `CLAUDE.md` "Full automation — new app checklist" when that happens.

## Conventions

- Route-per-screen for shareability (`/`, `/denied`, `/visa`, `/visa/[type]`,
  `/appointment`, `/biometric`, `/processing`, `/visa-issued`, `/statistics`,
  `/duty-free`, `/terms`), but the funnel's *data* lives in one client context
  (`lib/applicationContext.tsx`, `ApplicationProvider` in `app/layout.tsx`) so it
  survives client-side navigation between those routes. It only resets when `/`
  (the entry declaration) mounts. The selfie is deliberately **not** persisted to
  `sessionStorage` (kept in memory only) to keep storage light — a hard refresh
  mid-funnel loses the photo and any downstream page redirects back to `/visa`.
- **All copy/config in `lib/content.ts`** — visa definitions, denial reasons, gag lines,
  fiancé interview questions, statistics placeholders, duty-free stock, terms paragraphs,
  officer moods, the DM handle + deep link, and the reference-line format. Don't hardcode
  copy in components; add it here first.
- **Appointment slots are seeded, not static** (`lib/slots.ts`): a fixed joke-label pool
  per visa type (base + fiancé-only + business-only slots), with 2–3 marked "available"
  by a deterministic PRNG seeded off the ISO week number (+ visa type), so scarcity is
  stable for a whole week and then rotates — not random per page load. `lib/api.ts`
  wraps this as `getAvailableSlots(visaType): Promise<Slot[]>` specifically so a real
  Google Calendar-backed source can replace the body later without touching call sites
  (`app/appointment/page.tsx` only calls the async function).
- Reusable primitives: `PageShell` (mobile-first max-w-md container + paper-slide-in),
  `StampSlam` (the DENIED/APPROVED stamp visual), `Typewriter` (line reveal, respects
  `prefers-reduced-motion` by rendering instantly), `ProgressBar`. Per-visa sub-steps
  live in `components/visa-steps/*` and share `StepShell`.
- `lib/passport.ts` — visit count + a capped stamp log (both localStorage), driving the
  returning-visitor line, the 3rd-visit loyalty message, and the passport-stamps count
  shown on the landing page.
- `lib/sound.ts` — WebAudio-generated blips (`playStampThunk`, `playTypewriterClick`,
  `playBeep`), gated by the `☐ I consent to noise` toggle (localStorage). No audio
  assets exist or are needed.
- `lib/referenceCode.ts` — `RIG-XXXX` codes (ambiguous chars like `0/O/1/I` excluded).

## Data model

- **No Supabase schema exists for this app yet** (by design — task scope explicitly
  excluded migrations/credentials). `lib/api.ts` POSTs to the **unqualified** table name
  (`applications`, `appointments`, `bribes`) with a `Content-Profile: republic` header
  naming the schema — PostgREST doesn't accept a dot-qualified `schema.table` in the URL
  path, only unqualified table + profile header, for custom (non-`public`) schemas.
  `response.ok` is checked explicitly (and `console.warn`'d in dev on failure) rather than
  treating a non-2xx response as a silent success. All of it is still wrapped in try/catch
  so a 404 (the schema doesn't exist yet, true today) never breaks the funnel. The
  **actual source of truth today is localStorage**: applicant counter, bribe count,
  visit/stamp log, sound preference, and a rolling `republic:applications-log` array.
- **One application record per completed funnel.** `lib/api.ts#buildApplicationRecord(state, referenceCode)`
  assembles the single `ApplicationRecord` from context state — name, Instagram handle,
  visa type, whichever sub-step field applies (`matter`/`pitch`/`statement`/`interviewAnswers`),
  the chosen slot, the reference code, and selfie *metadata* (`selfieCaptured` +
  `selfieSizeBytes` — **never the raw image**, to keep the log/network payload small).
  It's built and `recordApplication`'d exactly once, from `app/processing/page.tsx`, right
  after the reference code is generated — see Gotchas for the idempotency mechanism.
  `recordAppointment` is called from the same spot (not from `/appointment` at booking
  time) specifically so it's never written without the reference code that links it to
  the application.
- If/when a real `republic` schema is added (see `SIDEQUEST_PLAN.md`'s table list:
  `applicants`, `applications`, `consultations`, `pitches`, `interviews`, `statements`,
  `appointments`), keep `lib/api.ts`'s function signatures the same — only the internals
  change — so call sites don't need to move.
- **No bot defenses** (no Turnstile, no honeypot) — explicitly cut per owner override.
  Don't add them without checking first; it was a deliberate scope cut, not an oversight.

## Gotchas

- **Instagram deep link cannot pre-fill DM text, and never blocks on the clipboard.**
  `ig.me/m/<handle>` opens the thread but ignores any query/text params, so
  `/visa-issued` always shows the reference line (`buildReferenceLine` in
  `lib/content.ts`, format `"<VISA NAME> <RIG-XXXX> — <slot>"`) **permanently on
  screen** (never only after a copy attempt), plus a manual "copy" button. The
  "PROCEED TO CONSULATE" button calls `window.open(CONSULATE_DM_URL, ...)`
  **synchronously, first** — calling it after an `await`'d clipboard write breaks the
  user-gesture chain and some browsers silently popup-block it — then attempts
  `navigator.clipboard.writeText` as a genuinely non-blocking side effect. The status
  message is truthful: `COPY_INSTRUCTION` only renders on an actual resolved write,
  `COPY_FAILED_INSTRUCTION` on a rejected one; it never claims success it didn't have.
  The handle is `ignas_simanavicius` — the **only** place it should be hardcoded is
  `CONSULATE_HANDLE`/`CONSULATE_DM_URL` in `lib/content.ts`.
- **Hydration-unsafe values must never be read/computed during render** (this app is
  statically prerendered — the server render is frozen at build time forever, so
  anything time/random/locale/localStorage/matchMedia-dependent computed inline or in a
  bare `useState(() => ...)` initializer *will* differ between that frozen HTML and the
  client's hydration pass). The fix pattern used throughout: state starts at an SSR-safe
  default (`0`, `null`, `false`, matching what the server produced) and is only ever
  populated inside a `useEffect` (client-only, runs after hydration). See
  `OfficerMoodBadge` (mood renders `null` until mounted), `Typewriter` (`shown` always
  starts at `0`), `app/denied/page.tsx` (reason/case number/date start `null`; `shake`
  starts `false` and is only ever set from inside the effect, never computed inline in a
  className), and `app/page.tsx` (`getPassport()` is never called during render — its
  result is copied into `stampCount` state inside the mount effect). If you add a new
  random/time-based display value, follow the same pattern — don't call `Math.random()`,
  `new Date()`, `matchMedia`, or a `localStorage` read directly in a component body or a
  lazy `useState` initializer.
- **Route-guard redirects are gated on `ApplicationProvider`'s `hydrated` flag**
  (`/appointment`, `/biometric`, `/processing`, `/visa-issued` all do `if (!hydrated)
  return` before checking any funnel state, and render `null` while `!hydrated`).
  Context hydration (reading `sessionStorage`) happens in its own effect and isn't
  guaranteed to have run before a page's own mount effect fires — checking funnel state
  before `hydrated` is true reads the momentary empty default and would bounce a valid,
  refreshed-mid-funnel session back to `/visa` before the real persisted state loads.
- **Application finalization is idempotent by design, not by luck.**
  `app/processing/page.tsx` generates the reference code and calls
  `recordApplication`/`recordAppointment` from exactly one place (`finalize()`), guarded
  two ways: a `useRef` flag that survives React's dev/StrictMode
  mount→cleanup→mount double-invoke *within the same mount* (refs aren't reset by that,
  only by an actual unmount), and a `state.referenceCode` check at the top of the effect
  that short-circuits straight to `/visa-issued` on a genuine remount (e.g. browser back
  to `/processing` after already finishing) instead of regenerating a second code/record.
  `recordApplication` also de-dupes by `referenceCode` in the localStorage log as a third,
  defense-in-depth layer. Known residual edge case: navigating back past `/visa-issued`
  to `/appointment` and picking a *different* slot after finalization won't create a
  second record (idempotency holds), but the sticker/reference line shown afterward would
  reflect the new slot while the already-written record reflects the old one — this is an
  inherent tradeoff of allowing free back-navigation in a client-only funnel, not a
  regression; locking state post-finalization would need its own design decision.
- **Canvas text uses `"Courier New", monospace`, not the loaded webfonts.** Getting
  `next/font`'s generated family name into a `<canvas>` `ctx.font` reliably needs
  `document.fonts.ready` + reading the actual generated family string; skipped as
  unnecessary complexity for a typewriter-styled composite — Courier New reads the same
  visually and is available everywhere.
- **Identity is two required fields on `/`: name AND Instagram handle** (`LANDING.nameLabel`
  / `LANDING.handleLabel`, format "PASSPORT №: @handle"), both gating the YES/NO buttons.
  The handle is normalized (leading `@` stripped) before being stored in
  `state.instagramHandle` — don't re-add the `@` when storing, only when displaying. Both
  fields are threaded through the whole funnel into `ApplicationRecord` (via
  `buildApplicationRecord`) and onto the visa sticker (`STICKER_LABELS.passport`).
- `VisaDefinition` only carries `slug`/`icon`/`name`/`tagline`/`lines` — the `fee`,
  `processing`, and `hasSubStep` fields were removed as dead config (nothing read them;
  `lines` already carries the fee/processing copy shown on the selection cards, and each
  visa's actual sub-step is a hardcoded switch in `app/visa/[type]/page.tsx`, not driven
  by a flag). If a new visa needs conditional sub-step behavior beyond that switch, don't
  resurrect `hasSubStep` — make the switch itself the source of truth.
- `ApplicationProvider` is mounted once in the root layout and stays mounted for the
  whole client session (Next soft navigation) — its `sessionStorage` hydration effect
  only runs once (see `hydrated`, above).
- `getAvailableSlots`/slot scarcity is **deterministic per ISO week**, not per session —
  reloading doesn't reshuffle which slots are open; only a new week does. If a "reshuffle
  every visit" behavior is ever wanted instead, that's a `lib/slots.ts` change (seed
  includes a session/day component instead of just the week).
- `overflow-x: hidden` is set on `html`/`body` in `app/globals.css` because the stamp
  slam entrance briefly scales an element to `3.2×` — without it that can flash a
  horizontal scrollbar on narrow phones during the animation.

## Current state

Full client-side funnel is built and working end-to-end, zero backend required:
entry declaration (**name + Instagram handle, both required**, then declare yes/no) →
denied (stamp slam, rotating reason, appeal loops to visa selection) → visa selection
(5 visas, fiancé has a HIGH RISK tag) → per-visa sub-step (tourist skips;
consultation/business/special are 1-field forms with a random canned reply; fiancé is a
3-question always-passes vibe check — sub-steps only write to context now, they don't
call the API) → consulate appointment (seeded weekly-scarcity slot picker, visa-specific
bonus slots for fiancé/business) → biometric selfie (`<input type=file accept=image/*
capture=user>`, oval guide overlay) → processing (progress bar stutters at 99%, cycling
Interpol-style gag lines, generates the reference code and writes the **one** finalized
application record) → visa issued (canvas-composited sticker: selfie in an oval frame,
name + handle, baked-in APPROVED stamp, serial + reference code, name, visa type;
download button; reference line always visible on screen; "PROCEED TO CONSULATE" opens
the `ig.me` DM thread immediately and best-effort copies the reference line with a
truthful success/failure message, plus a manual copy button).

All copy that used to be inline in page/component JSX now lives in `lib/content.ts`
(landing form labels, visa-step shared copy, appointment/biometric/processing copy,
sticker labels, the slot-label pool) — nothing user-facing should be hardcoded in a
component going forward. All hydration-unsafe reads (random/time/locale/localStorage/
matchMedia during render) were moved behind client effects; see Gotchas.

Extras implemented: applicant counter (localStorage placeholder), officer mood badge
(rotates hourly), bribe button (device-local count), localStorage passport stamps +
returning-visitor line + 3rd-visit loyalty message, `/statistics` (bureaucratic table,
placeholder numbers, no fiancé counts, device-local bribe count folded in), `/duty-free`,
`/terms` (paragraph 7 easter egg), `not-found.tsx` (404), 20s idle nudge toast, sound
toggle with WebAudio blips.

Explicitly not built (per plan's "cut by decree" + owner override): rejection lottery,
diplomatic passport easter egg, customs declaration checklist, deportation-on-idle,
Turnstile/honeypot bot defenses, random secondary screening, seasonal decree banner,
per-route OG images, real Supabase persistence (stubbed only).

Verified: `npm run typecheck`, `npm run build`, and `npm run lint` all pass clean from
this folder (and via `turbo run <task> --filter=./apps/republic` from the repo root).
Not yet registered with Vercel or `apps/hub/config/apps.json`.

## Next

- Provision the real `republic` Supabase schema (additive-only) matching
  `SIDEQUEST_PLAN.md`'s table list, then swap `lib/api.ts`'s try/catch stub bodies for
  real inserts — signatures should not need to change.
- Create the Vercel project (Root Directory `apps/republic`) and register the app in
  `apps/hub/config/apps.json` once a domain/slug is decided.
- Consider per-route OG images (`/denied`, `/visa/fiance`) if this ships as the actual IG
  bio link — the plan calls the DENIED stamp OG image "elite" and it's currently unbuilt.
- If `getAvailableSlots` grows a real Google Calendar backend, keep the function
  signature (`visaType → Promise<Slot[]>`) and move the seeded-pool logic in
  `lib/slots.ts` behind a feature flag rather than deleting it (useful fallback/demo mode).
