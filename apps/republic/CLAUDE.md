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
- A Vercel project (`republic-of-ignas`) exists for this app (a `.env.local` with a
  Vercel CLI OIDC token is present, gitignored) — **not yet registered in
  `apps/hub/config/apps.json`**. Confirm production URL/env vars before assuming it's
  live; don't add Supabase credentials without checking first.

## Conventions

- Route-per-screen for shareability (`/`, `/identity`, `/denied`, `/visa`,
  `/visa/[type]`, `/appointment`, `/biometric`, `/processing`, `/visa-issued`,
  `/statistics`, `/duty-free`, `/terms`), but the funnel's *data* lives in one client
  context (`lib/applicationContext.tsx`, `ApplicationProvider` in `app/layout.tsx`) so
  it survives client-side navigation between those routes. Landing (`/`) resets the
  *application* fields on every visit but **preserves identity** (`applicantName` /
  `instagramHandle`) already on file this session — see Gotchas. The selfie is
  deliberately **not** persisted to `sessionStorage` (kept in memory only) to keep
  storage light — a hard refresh mid-funnel loses the photo and any downstream page
  redirects back to `/visa`.
- **All copy/config in `lib/content.ts`** — visa definitions, denial reasons, gag lines,
  fiancé interview questions, identity/document-card labels, statistics placeholders,
  duty-free stock, terms paragraphs, officer moods, the DM handle + deep link, and the
  reference-line format. Don't hardcode copy in components; add it here first.
- **Appointment slots are seeded, not static** (`lib/slots.ts`): a fixed joke-label pool
  per visa type (base + fiancé-only + business-only slots), with 2–3 marked "available"
  by a deterministic PRNG seeded off the ISO week number (+ visa type), so scarcity is
  stable for a whole week and then rotates — not random per page load. `lib/api.ts`
  wraps this as `getAvailableSlots(visaType): Promise<Slot[]>` specifically so a real
  Google Calendar-backed source can replace the body later without touching call sites
  (`app/appointment/page.tsx` only calls the async function).
- Reusable primitives: `PageShell` (mobile-first max-w-md container + paper-slide-in;
  `fullHeight` prop for the no-scroll landing, `showProgress` prop to mount
  `DocumentProgress`), `StampSlam` (the DENIED/APPROVED stamp visual), `Typewriter`
  (line reveal, respects `prefers-reduced-motion` by rendering instantly), `ProgressBar`,
  `Checkbox` (fully custom, see Gotchas), `RequireIdentity` (route guard, see below).
  Per-visa sub-steps live in `components/visa-steps/*` and share `StepShell` (which
  itself renders `<PageShell showProgress>`).
- `lib/passport.ts` — visit count + a capped stamp log (both localStorage), driving the
  returning-visitor line, the 3rd-visit loyalty message, and the passport-stamps count
  shown on the landing page.
- `lib/sound.ts` — WebAudio-generated blips (`playStampThunk`, `playTypewriterClick`,
  `playBeep`), **on by default for everyone, no toggle** (removed — see Current state).
- `lib/formProgress.ts` — sessionStorage-backed "which document-card fields have already
  played their reveal animation" set, consumed by `DocumentProgress`. Independent of the
  funnel's own `republic:application` sessionStorage key; cleared alongside it whenever
  landing restarts the funnel (`clearAnimatedFields()` in `app/page.tsx`'s mount effect).
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
  **actual source of truth today is localStorage**: bribe count, visit/stamp log, and a
  rolling `republic:applications-log` array. There is **no applicant counter** — see
  "Applicant № 001" below.
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

- **Applicant № 001, for everyone, always.** `LANDING.applicantNumberLine` is a fixed
  string (`'APPLICANT № 001'`) — there is no `getApplicantNumber`, no `applicantSeq`
  localStorage key, no per-visitor sequencing. The joke is that the Republic has exactly
  one citizen (see `/statistics`'s footnote); don't reintroduce a real counter here
  thinking it's an unfinished placeholder.
- **Identity lives on its own page, not the landing.** `/identity` (government-form
  styled: "APPLICANT IDENTIFICATION", `IDENTITY.nameLabel` says "NAME OF APPLICANT:" —
  **not** "full name" — plus the "PASSPORT №: @handle" field) is reached via YES on `/`
  or the appeal link on `/denied`, and both fields are required before `CONTINUE` moves
  on to `/visa`. The handle is normalized (leading `@` stripped) before being stored in
  `state.instagramHandle` — don't re-add the `@` when storing, only when displaying.
  `/identity` itself redirects straight to `/visa` if both fields are already non-empty
  in context (back-navigation between `/identity` and `/visa`, or arriving via appeal
  after already declaring once this session) — it never re-asks. `/visa` and every
  `/visa/[type]` sub-step are wrapped in `<RequireIdentity>` (`components/RequireIdentity.tsx`),
  which redirects to `/identity` if either field is empty; downstream pages
  (`/appointment`, `/biometric`, `/processing`, `/visa-issued`) are **unchanged** — they
  don't need their own identity check since `visaType` can only become non-null by
  passing through the now-guarded `/visa`.
- **Landing preserves identity across its own reset.** `app/page.tsx`'s mount effect
  captures `applicantName`/`instagramHandle` *before* calling `reset()`, then re-applies
  them after — so returning to `/` mid-session doesn't force re-entering identity (you
  only ever retype it once per browser session, at `/identity`), while every other
  funnel field (visa type, answers, slot, selfie, reference code) genuinely restarts.
  This is why the `/identity`-skip-if-already-present behavior actually gets used, not
  just a defensive no-op.
- **Landing is `<PageShell fullHeight>`, everything else is the default variant.**
  `fullHeight` renders `min-h-[100dvh] flex flex-col justify-center` (no `showProgress`,
  no natural-scroll assumption) instead of the normal `min-h-dvh` + top-anchored flow.
  The landing's own content (crest, header, form-code/applicant-number lines, barcode,
  conditional returning/loyalty/stamp-count lines, the typewriter question, YES/NO,
  officer-mood badge, compact footer) is sized and spaced specifically to fit inside
  390×660 (the tightest realistic target — Instagram in-app webview chrome) with real
  margin to spare; verified by height arithmetic (documented in the PR/session notes),
  not just "looks fine on desktop". If you add anything to the landing, redo that math —
  **zero vertical scroll on `/` is a hard requirement**, not a nice-to-have.
- **`Footer` takes a `compact` prop** (smaller margins/padding/text) used only by the
  landing, to fit the no-scroll budget; every other page still gets the normal footer.
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
  className), `DocumentProgress` (returns `null` until `hydrated`, exactly like every
  route guard — never renders a field's filled/blank state from context before then),
  and `app/page.tsx` (`getPassport()` is never called during render — its result is
  copied into `stampCount` state inside the mount effect). If you add a new random/
  time-based display value, follow the same pattern — don't call `Math.random()`,
  `new Date()`, `matchMedia`, or a `localStorage`/`sessionStorage` read directly in a
  component body or a lazy `useState` initializer.
- **Route-guard redirects are gated on `ApplicationProvider`'s `hydrated` flag**
  (`/appointment`, `/biometric`, `/processing`, `/visa-issued`, `/identity`, and
  `RequireIdentity` all do `if (!hydrated) return` before checking any funnel state, and
  render `null` while `!hydrated`). Context hydration (reading `sessionStorage`) happens
  in its own effect and isn't guaranteed to have run before a page's own mount effect
  fires — checking funnel state before `hydrated` is true reads the momentary empty
  default and would bounce a valid, refreshed-mid-funnel session to the wrong step
  before the real persisted state loads.
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
- **Biometrics/approval survive a refresh without persisting the full-res selfie.**
  `ApplicationState.selfieCaptured` (boolean) and `selfieThumbnailUrl` (a canvas-
  downscaled ~200px JPEG, a few KB — `lib/photo.ts#createThumbnail`, best-effort, wrapped
  in try/catch, resolves `null` on any failure) both persist normally; only the
  full-resolution `selfieDataUrl` is stripped before the sessionStorage write (see
  above). `app/biometric/page.tsx` sets all three together on submit. Every downstream
  read that used to check `selfieDataUrl` for "was a selfie captured" now checks
  `selfieCaptured` instead — `/visa-issued`'s guard, its final render guard, and
  `DocumentProgress`'s BIOMETRICS row. `/visa-issued`'s canvas draw picks
  `state.selfieDataUrl ?? state.selfieThumbnailUrl` as the image source, and if **both**
  are absent (thumbnail generation failed and the tab was refreshed) draws
  `STICKER_LABELS.photoPlaceholder` ("PHOTO ON FILE") straight into the oval frame
  instead of loading an image at all — the rest of the sticker (name, passport, visa
  type, serial, reference code, APPROVED stamp), the reference line, download, and the
  DM handoff are all unaffected by which of the three photo states applies.
  `app/processing/page.tsx`'s existing `if (state.referenceCode) { replace to
  /visa-issued }` check already runs *before* it ever looks at `selfieDataUrl`, so a
  refresh on `/processing` after the application is already finalized was (and remains)
  correctly forwarded without regenerating a code or duplicating a record — don't
  reorder those two checks.
- **Never use a bare `<input type="checkbox">` (or `type="radio"`) in this app.** The
  global `input { appearance: none }` reset in `app/globals.css` strips native checkbox
  chrome with nothing to replace it, which is exactly what made the sworn-statement
  checkbox on `/visa/special` invisible in production (it was there, checkable, just
  never drawn). The CSS reset now excludes `[type=checkbox]`/`[type=radio]` as a
  defensive fix, but the real fix is `components/Checkbox.tsx`: the real input stays in
  the DOM (fully functional, focusable, screen-reader-announced) but `opacity-0`; a
  sibling `span`+`svg` draws the navy-bordered box and stamp-red check mark, so it never
  depends on native rendering or `accent-color` support either way. Use it for any new
  checkbox instead of a bare input.
- **Canvas text uses `"Courier New", monospace`, not the loaded webfonts.** Getting
  `next/font`'s generated family name into a `<canvas>` `ctx.font` reliably needs
  `document.fonts.ready` + reading the actual generated family string; skipped as
  unnecessary complexity for a typewriter-styled composite — Courier New reads the same
  visually and is available everywhere.
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

Full client-side funnel, zero backend required: entry declaration (**no-scroll landing**,
just the declare-yes/no question + officer-mood badge + hidden bribe easter egg + compact
footer — no identity fields, no visible sound toggle) → **YES → `/identity`**
(name + Instagram handle, both required, skipped if already on file this session) →
**NO → `/denied`** (stamp slam, rotating reason, appeal loops to `/identity`) → visa
selection (5 visas, fiancé has a HIGH RISK tag; `/visa` and every `/visa/[type]` now
require identity via `RequireIdentity`) → per-visa sub-step (tourist skips;
consultation/business/special are 1-field forms with a random canned reply; fiancé is a
3-question always-passes vibe check) → consulate appointment (seeded weekly-scarcity slot
picker, visa-specific bonus slots for fiancé/business) → biometric selfie (`<input
type=file accept=image/* capture=user>`, oval guide overlay) → processing (progress bar
stutters at 99%, cycling Interpol-style gag lines, generates the reference code and
writes the **one** finalized application record) → visa issued (canvas-composited
sticker: selfie in an oval frame, name + handle, baked-in APPROVED stamp, serial +
reference code; download button; reference line always visible on screen; "PROCEED TO
CONSULATE" opens the `ig.me` DM thread immediately and best-effort copies the reference
line with a truthful success/failure message, plus a manual copy button).

**New this pass:**
- **No-scroll landing** (`<PageShell fullHeight>`): compact spacing throughout, fits
  390×660 with margin to spare. Officer-mood badge is the only widget still in normal
  flow; sound toggle and visible bribe button are both gone (see below).
- **`/identity`** is a new route (government-form styled, "NAME OF APPLICANT:" —
  explicitly not "full name" — + the passport/handle field), reached after YES or the
  denied/appeal loop, skips itself if identity is already in context. `/visa` and
  `/visa/[type]` are gated behind it via `RequireIdentity`.
- **Hidden bribe easter egg** (`components/HiddenBribe.tsx`, shown on landing): a 💵 tab
  pinned `fixed`, parked away from the YES/NO buttons, mostly off the right edge with a
  slow bob + golden glow (`animate-bribe-peek`, two combined keyframes in
  `tailwind.config.ts`) **plus a moving highlight sweep** (`.bribe-shimmer-sweep` in
  `app/globals.css`, a diagonal gradient animated via `background-position` —
  `animate-bribe-shimmer`, its own keyframe/animation pair — layered on an absolutely
  positioned overlay `span` inside the button, which needs `relative overflow-hidden` so
  the sweep clips to the circle). Tapping slides it fully on-screen and swaps in the
  existing `BribeButton` (same component, same copy, same device counter — single
  source of truth). Reduced motion is handled by the app's existing global rule (collapses
  bob, glow, *and* the shimmer to one static frame), no special-casing needed.
- **Democracy jokes**: `/terms` paragraph 10 ("full democracy... 100% of the vote"),
  `/statistics` footnote ("one (1) citizen and he is doing his best") — both in
  `lib/content.ts` (`TERMS_PARAGRAPHS`, `STATISTICS_FOOTNOTE`).
- **Sound toggle removed.** `components/SoundToggle.tsx` deleted; `lib/sound.ts` no
  longer gates `beep()` behind a persisted preference — sound is on by default for
  everyone, and every call site is already inside a user-gesture handler (click/tap/
  change), which is what actually satisfies autoplay policy. `getCtx()` best-effort
  `resume()`s the shared `AudioContext` if it started suspended.
- **Applicant № 001 for everyone.** `getApplicantNumber` and its localStorage sequence
  key are gone from `lib/api.ts`; the landing renders the fixed `LANDING.applicantNumberLine`.
- **Invisible-checkbox bug fixed.** `components/Checkbox.tsx` is a new fully custom
  checkbox (real input kept functional but invisible; box + check mark drawn by sibling
  elements) used by `SpecialStep`'s sworn-statement declaration — the only checkbox in
  the app (audited; no radios exist anywhere). The global CSS `appearance: none` reset
  now excludes checkboxes/radios defensively too. The real `<input>` and the decorative
  box are **siblings**, not parent/child, specifically so `peer-focus-visible:` can put a
  visible ring on the box from the invisible input's real focus state — keyboard focus
  only, not mouse clicks (a parent/child structure can't use `peer-*` at all).
- **Persistent document card** (`components/DocumentProgress.tsx`, `<PageShell
  showProgress>`): a sticky-top "FORM 1G-NAS" strip on every funnel page from
  `/identity` onward (never on the landing). Rows: DECLARATION (checked as soon as you
  reach `/identity`) → NAME + PASSPORT № → VISA TYPE → the active visa's sub-step
  answer, truncated (hidden for tourist, which has none) → APPOINTMENT slot →
  BIOMETRICS → STATUS (only appears once actually approved). Blank fields render as a
  ruled line; a field's value pops in once, the first time it's filled, via
  `animate-field-fill` — gated by `lib/formProgress.ts`'s sessionStorage set so a
  mid-funnel refresh never replays an animation for something already on the form.
  Reduced motion collapses it to instant via the app's existing global rule.

**Review fixes this pass:**
- Biometrics/approval state (and the visa sticker's photo) now survive a refresh on
  `/visa-issued` without persisting the full-resolution selfie — see the new
  `selfieCaptured`/`selfieThumbnailUrl` Gotchas entry above.
- The hidden bribe tab's collapsed state has a real moving shimmer sweep in addition to
  the bob + glow.
- `Checkbox.tsx` now shows a visible ring on keyboard (`focus-visible`) focus, since the
  real input is invisible and previously gave no focus indicator at all.

Explicitly not built (per plan's "cut by decree" + owner override): rejection lottery,
diplomatic passport easter egg, customs declaration checklist, deportation-on-idle,
Turnstile/honeypot bot defenses, random secondary screening, seasonal decree banner,
per-route OG images, real Supabase persistence (stubbed only).

Verified: `npm run typecheck`, `npm run build`, and `npm run lint` all pass clean from
this folder (and via `turbo run <task> --filter=./apps/republic` from the repo root).

## Next

- A Vercel project (`republic-of-ignas`) already exists (see Stack) but the app isn't
  registered in `apps/hub/config/apps.json` yet — confirm the production URL and add the
  hub tile + icon mapping once a domain/slug is finalized.
- Provision the real `republic` Supabase schema (additive-only) matching
  `SIDEQUEST_PLAN.md`'s table list, then swap `lib/api.ts`'s try/catch stub bodies for
  real inserts — signatures should not need to change.
- Consider per-route OG images (`/denied`, `/visa/fiance`) if this ships as the actual IG
  bio link — the plan calls the DENIED stamp OG image "elite" and it's currently unbuilt.
- If `getAvailableSlots` grows a real Google Calendar backend, keep the function
  signature (`visaType → Promise<Slot[]>`) and move the seeded-pool logic in
  `lib/slots.ts` behind a feature flag rather than deleting it (useful fallback/demo mode).
- The document card currently truncates free-text sub-step answers at a fixed 26 chars
  (`DocumentProgress.tsx`); revisit if a future visa's answer format needs different
  handling (e.g. showing the fiancé interview's actual answers instead of just
  "ANSWERED").
