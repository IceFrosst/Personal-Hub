# Dictatorship of Ignas — app context (`apps/republic`)

> Read the repo-root `CLAUDE.md` and `SCHEMA_RULES.md` first — they govern every app.
> Read `../../SIDEQUEST_PLAN.md` for the original concept/copy bank this app implements
> (written before the "Dictatorship" rebrand — still uses the original working name).
> **Keep `Current state` and `Next` (bottom) up to date — update them after every change to this app.**

Gamified, deadpan-bureaucracy link-in-bio for Ignas's personal Instagram, themed as
immigration/border control for the fictional "Dictatorship of Ignas" (rebranded from
"Republic of Ignas" — the folder/package name `apps/republic` stays as-is, it's just a
slug). Every visitor action (hang out / ask advice / pitch something / ask him out) is a
visa application. The site plays it completely straight, including `/terms`'s claim that
the Dictatorship is also a full democracy.

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
  fiancé interview questions, identity/passport-card labels, statistics placeholders,
  duty-free stock, terms paragraphs, officer moods, the DM handle + deep link, and the
  reference-line format. Don't hardcode copy in components; add it here first. A handful
  of sub-step gag lines (`PRELIMINARY_RULINGS`, `SPECIAL_REPLIES`, `BUSINESS.receivedNote`,
  `FIANCE_RESULT`, `TOURIST_STEP`) are currently unused (they used to power an
  intermediate confirmation screen removed in favor of navigating straight to
  `/appointment` — see Current state) but kept as copy-bank content, not deleted.
- **Visa cards are icon + name + at most one flavor line now** (`VisaDefinition.tagline`/
  `.lines` can be empty — `app/visa/page.tsx` hides them entirely when empty, rather than
  rendering empty quotes or an empty list). Fiancé (`DATE VISA`) has neither, just the
  HIGH RISK stamp. Don't add the tagline/lines back without checking — this was a
  deliberate trim.
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
  itself renders `<PageShell showProgress>`) — except `TouristStep`, which renders
  nothing at all now (see Current state).
- `lib/passport.ts` — visit count + a capped stamp log (both localStorage), driving the
  returning-visitor line, the 3rd-visit loyalty message, and the passport-stamps count
  shown on the landing page. (Unrelated to the passport-styled `DocumentProgress` card —
  same real-world metaphor, two different features that happen to share the name.)
- `lib/sound.ts` — WebAudio-generated blips (`playStampThunk`, `playTypewriterClick`,
  `playBeep`), **on by default for everyone, no toggle**.
- `lib/formProgress.ts` — sessionStorage-backed "which passport-card fields have already
  played their reveal animation" set, consumed by `DocumentProgress`. Independent of the
  funnel's own `republic:application` sessionStorage key; cleared alongside it whenever
  landing restarts the funnel (`clearAnimatedFields()` in `app/page.tsx`'s mount effect).
- `lib/referenceCode.ts` — `RIG-XXXX` codes (ambiguous chars like `0/O/1/I` excluded).
  Left as-is through the rebrand (a code-format detail, not user-facing prose) — read
  loosely as "Registry of Ignas Government" if you like, but nothing depends on that.

## Data model

- **No Supabase schema exists for this app yet** (by design — task scope explicitly
  excluded migrations/credentials). `lib/api.ts` POSTs to the **unqualified** table name
  (`applications`, `appointments`, `bribes`) with a `Content-Profile: republic` header
  naming the schema — PostgREST doesn't accept a dot-qualified `schema.table` in the URL
  path, only unqualified table + profile header, for custom (non-`public`) schemas.
  `response.ok` is checked explicitly (and `console.warn`'d in dev on failure) rather than
  treating a non-2xx response as a silent success. All of it is still wrapped in try/catch
  so a 404 (the schema doesn't exist yet, true today) never breaks the funnel. The
  **actual source of truth today is localStorage**: applicant number, bribe count,
  visit/stamp log, and a rolling `republic:applications-log` array.
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

- **Applicant numbers are per-device, not global.** `lib/api.ts#getApplicantNumber()`
  generates a random number in **47–4999** once and caches it in
  `localStorage['republic:applicant-number']` — stable across visits on the same
  device/browser, different on every other device (no shared counter, no backend). The
  landing renders `LANDING.applicantNumberPlaceholder` until a client effect resolves
  the real value (`app/page.tsx`, same hydration-safe pattern as everything else here —
  never call this during render). `formatApplicantNumber` (in `lib/content.ts`) zero-pads
  to 4 digits. **This app has gone back and forth on this feature** (fixed "№ 001" for a
  while, joke being "you're the only applicant" — now reverted to a per-device random
  number per owner feedback) — don't re-simplify to a fixed value without checking; read
  the most recent instruction, not an older comment you find elsewhere.
- **Identity lives on its own page, not the landing.** `/identity` (government-form
  styled: "APPLICANT IDENTIFICATION", `IDENTITY.nameLabel` says "NAME OF APPLICANT:" —
  **not** "full name" — plus the "PASSPORT №: @handle" field, no subtitle line under the
  heading) is reached via YES on `/` or the appeal link on `/denied`, and both fields are
  required before `CONTINUE` moves on to `/visa`. The handle is normalized (leading `@`
  stripped) before being stored in `state.instagramHandle` — don't re-add the `@` when
  storing, only when displaying. `/identity` itself redirects straight to `/visa` if both
  fields are already non-empty in context (back-navigation between `/identity` and
  `/visa`, or arriving via appeal after already declaring once this session) — it never
  re-asks. `/visa` and every `/visa/[type]` sub-step are wrapped in `<RequireIdentity>`
  (`components/RequireIdentity.tsx`), which redirects to `/identity` if either field is
  empty; downstream pages (`/appointment`, `/biometric`, `/processing`, `/visa-issued`)
  are **unchanged** — they don't need their own identity check since `visaType` can only
  become non-null by passing through the now-guarded `/visa`.
- **No intermediate confirmation screen after a visa sub-step anymore.** Every sub-step
  (`components/visa-steps/*.tsx`) now calls `router.push('/appointment')` directly the
  moment it's done — `ConsultationStep`/`BusinessStep`/`SpecialStep` on form submit,
  `FianceStep` on the 3rd answer, and `TouristStep` renders **nothing at all** and
  `router.replace('/appointment')`s immediately in its mount effect (sidequest has no
  form, so "on completion" means "on selection"). The old "PRELIMINARY RULING" / "vibe
  check passed" / etc. reply screens and their "CONTINUE TO APPOINTMENT" buttons are
  gone; the underlying gag-line content still exists in `lib/content.ts` (see
  Conventions) in case it's wanted again, but nothing currently renders it. If you
  reintroduce any kind of pause here, keep it non-blocking (auto-advance, not a button)
  or confirm with the owner first — this was an explicit "remove the button" request.
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
  margin to spare. If you add anything to the landing (or lengthen `LANDING.title`,
  which is now "DICTATORSHIP OF IGNAS" — longer than the old "REPUBLIC OF IGNAS"),
  re-check the fit — **zero vertical scroll on `/` is a hard requirement**, not a
  nice-to-have. (The longer title was checked against the available card width at build
  time and still fits on one line with margin; redo that check if the title changes
  again.)
- **`DocumentProgress` is a faithful DOM replica of the final `/visa-issued` sticker,
  not the old flat "FORM 1G-NAS" strip or the later single-column passport booklet, and
  it never renders on `/visa-issued` itself.** `PageShell`'s `showProgress` prop mounts
  it; every funnel page from `/identity` through `/processing` passes it, but
  `/visa-issued` deliberately doesn't (the canvas-composited sticker is the payoff and
  stands alone — the progress card is "the same document, being filled in," the sticker
  is its completed form). It shares `STICKER_LABELS` (`lib/content.ts`) directly with the
  canvas draw code as a single source — the republic title, the "VISA — " prefix, and
  the NAME/PASSPORT №/VISA TYPE/SERIAL №/REFERENCE №/ISSUED/VALID/CONDITIONS field labels
  are the *exact same strings* on both, not a parallel copy that could drift. Same navy
  double-line border on paper, same header + subtitle line (subtitle is a blank ruled
  line until a visa is chosen, same as every other blank field), a SQUARE photo box on
  the left (square everywhere now — see the square-photo Gotcha below), and a
  `.barcode-mini` strip (see `app/globals.css`) along the bottom. Fields sit in the
  existing two-column CSS grid next to the photo, in the sticker's own order — NAME +
  PASSPORT №, VISA TYPE + SERIAL №, REFERENCE № full-width (via `Row`'s `span` prop),
  ISSUED + VALID, then CONDITIONS full-width — replicating *every* sticker field, not a
  trimmed subset. SERIAL №/ISSUED/VALID/CONDITIONS never actually have a value while this
  component is mounted (those are only ever computed on `/visa-issued`, which never
  renders this component alongside them), so those four always render as ruled blanks —
  intentional, not missing data. The old DECLARATION/BIOMETRICS/STATUS rows and the
  per-visa sub-step summary were dropped in an earlier pass along with
  `DOCUMENT_PROGRESS_SUBSTEP_LABELS` (now deleted from `lib/content.ts`) — the photo box
  itself already signals biometrics status, and REFERENCE № going from blank to filled
  already signals "done," so a separate STATUS row was redundant. The appointment slot is
  real funnel data known well before issuance, but it is **not** one of the sticker's own
  fields, so it's deliberately kept *outside* the replicated field grid — its own
  dashed-divider line beneath it, not a stand-in for ISSUED. `DOCUMENT_PROGRESS` in
  `lib/content.ts` now only holds `appointmentLabel` — every other label lives on
  `STICKER_LABELS`. The photo box fills with `#cfc8b8` and centers
  `STICKER_LABELS.photoPlaceholder` text (the sticker's own placeholder treatment, not a
  black silhouette) with square corners (no `rounded-*` class at all), and only shows an
  `<img>` when `state.selfieThumbnailUrl` is set — never `selfieDataUrl` (DocumentProgress
  has no business holding the full-res capture) — so it falls back to the placeholder if
  biometrics haven't run yet **or** if thumbnail generation failed, which is the intended
  fallback, not a bug. The photo reveal uses the same one-time `useRevealAnimation` hook
  as the text rows (key `'photo'`); the appointment line uses its own instance of the same
  hook (key `'appointment'`), called unconditionally alongside `photoAnimate` — both
  before the component's `!hydrated` early return, per the Rules of Hooks.
- **`Footer` takes a `compact` prop** (smaller margins/padding/text) used only by the
  landing, to fit the no-scroll budget; every other page still gets the normal footer.
- **Instagram deep link cannot pre-fill DM text, and never blocks on the clipboard.**
  `ig.me/m/<handle>` opens the thread but ignores any query/text params. `/visa-issued`
  has no permanent on-screen reference-line box anymore — the reference № is already
  printed on the visa sticker itself, so a separate always-visible copy of
  `buildReferenceLine` (`lib/content.ts`, format `"<VISA NAME> <RIG-XXXX> — <slot>"`)
  would just be redundant. Instead, the "PROCEED TO CONSULATE" button calls
  `window.open(CONSULATE_DM_URL, ...)` **synchronously, first** — calling it after an
  `await`'d clipboard write breaks the user-gesture chain and some browsers silently
  popup-block it — then attempts `navigator.clipboard.writeText` as a genuinely
  non-blocking side effect (`copyReferenceLine`, also reachable from anywhere else that
  needs it, though currently only `handleProceed` calls it). The status note under the
  button is truthful: `COPY_INSTRUCTION` ("copied — paste it in the DM") only renders on
  an actual resolved write; on a rejected one, `COPY_FAILED_INSTRUCTION` renders
  *alongside the reference line itself* in small inline text (since it's no longer
  shown anywhere else on the page) so the applicant can still copy it manually. The
  handle is `ignas_simanavicius` — the **only** place it should be hardcoded is
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
  and `app/page.tsx` (`getApplicantNumber()`/`getPassport()` are never called during
  render — their results are copied into state inside the mount effect). If you add a
  new random/time-based display value, follow the same pattern — don't call
  `Math.random()`, `new Date()`, `matchMedia`, or a `localStorage`/`sessionStorage` read
  directly in a component body or a lazy `useState` initializer.
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
  defense-in-depth layer.
- **Biometrics/approval survive a refresh without persisting the full-res selfie.**
  `ApplicationState.selfieCaptured` (boolean) and `selfieThumbnailUrl` (a canvas-
  downscaled ~200px JPEG, a few KB — `lib/photo.ts#createThumbnail`, best-effort, wrapped
  in try/catch, resolves `null` on any failure) both persist normally; only the
  full-resolution `selfieDataUrl` is stripped before the sessionStorage write. Every
  read that used to check `selfieDataUrl` for "was a selfie captured" checks
  `selfieCaptured` instead — `/visa-issued`'s guard, its final render guard,
  `app/processing/page.tsx`'s pre-finalization guard, and `DocumentProgress`'s photo box
  (which uses `selfieThumbnailUrl` specifically; there's no separate BIOMETRICS text row
  anymore — see the `DocumentProgress` Gotcha above).
  `/visa-issued`'s canvas draw picks `state.selfieDataUrl ?? state.selfieThumbnailUrl` as
  the image source, and if **both** are absent draws `STICKER_LABELS.photoPlaceholder`
  ("PHOTO ON FILE") straight into the square frame instead of loading an image at all.
- **Photo frames are square everywhere, not oval.** Both the canvas sticker
  (`app/visa-issued/page.tsx`) and `DocumentProgress`'s photo box used to clip to an
  ellipse; per owner feedback the ellipse read as an unwanted "passport photo oval" look
  and was replaced with a plain rectangular clip + stroke at the exact same position/size
  (`photoX`/`photoY`/`photoW`/`photoH` on the sticker are unchanged — only the clip/stroke
  shape changed from `ellipse()` to `rect()`/`strokeRect()`). `DocumentProgress`'s photo
  box went from `rounded-[50%]` to no `rounded-*` class at all (true square corners,
  matching the sticker exactly, not just "barely rounded") for the same reason. The
  **camera capture guide overlay on `/biometric`** (a dashed ellipse over the
  live preview) is a separate, unrelated UI element and was deliberately left alone —
  it's a face-alignment aid during capture, not a photo frame.
- **Never use a bare `<input type="checkbox">` (or `type="radio"`) in this app.** The
  global `input { appearance: none }` reset in `app/globals.css` strips native checkbox
  chrome with nothing to replace it, which is exactly what made the sworn-statement
  checkbox on `/visa/special` invisible in production (it was there, checkable, just
  never drawn). The CSS reset now excludes `[type=checkbox]`/`[type=radio]` as a
  defensive fix, but the real fix is `components/Checkbox.tsx`: the real input stays in
  the DOM (fully functional, focusable, screen-reader-announced) but `opacity-0`; a
  sibling `span`+`svg` draws the navy-bordered box and stamp-red check mark, so it never
  depends on native rendering or `accent-color` support either way. The input and the box
  are **siblings**, not parent/child, so `peer-focus-visible:` can put a visible ring on
  the box from the invisible input's real focus state. Use it for any new checkbox.
- **Canvas text uses `"Courier New", monospace`, not the loaded webfonts.** Getting
  `next/font`'s generated family name into a `<canvas>` `ctx.font` reliably needs
  `document.fonts.ready` + reading the actual generated family string; skipped as
  unnecessary complexity for a typewriter-styled composite — Courier New reads the same
  visually and is available everywhere.
- `VisaDefinition` only carries `slug`/`icon`/`name`/`tagline`/`lines` — the internal
  `slug` values (`'tourist'`, `'consultation'`, `'fiance'`, `'business'`, `'special'`)
  and everything keyed by them (`VisaType`, route params, `state.visaType`,
  `consultationMatter`/`businessPitch`/`specialStatement`/`fianceAnswers` field names,
  component file names) were **deliberately left unchanged** during the visa rename pass
  — only the user-facing `name`/`tagline`/`lines` changed (e.g. `tourist` → "SIDEQUEST
  VISA"). Renaming the internal keys to match would ripple through ~10 files for zero
  user-visible benefit; don't do it without a specific reason.
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

Full client-side funnel, zero backend required: entry declaration (**no-scroll
landing**, just the declare-yes/no question + officer-mood badge + hidden bribe easter
egg + compact footer — no identity fields) → **YES → `/identity`** (name + Instagram
handle, both required, skipped if already on file this session) → **NO → `/denied`**
(stamp slam, rotating reason, appeal loops to `/identity`) → visa selection (5 visas,
now trimmed to icon + name + at most one flavor line each; `/visa` and every
`/visa/[type]` require identity via `RequireIdentity`) → per-visa sub-step (sidequest has
none — selecting it goes straight through; the other four are 1-field forms or the
fiancé 3-question interview, and **all of them now navigate straight to `/appointment`
on completion, with no intermediate confirmation screen**) → consulate appointment
(seeded weekly-scarcity slot picker, visa-specific bonus slots for fiancé/business) →
biometric selfie (`<input type=file accept=image/* capture=user>`, oval guide overlay) →
processing (progress bar stutters at 99%, cycling Interpol-style gag lines, generates
the reference code and writes the **one** finalized application record — a refresh here
before or after that point resumes correctly, never duplicating) → visa issued
(canvas-composited sticker: selfie in a square frame, name + handle, baked-in APPROVED
stamp, serial + reference code; download button; "PROCEED TO CONSULATE" opens the
`ig.me` DM thread immediately and best-effort copies the reference line, showing a
truthful status note under the button (success: short confirmation; failure: the
reference line itself, inline, plus a manual-copy note) — no permanent on-screen
reference-line box, since the sticker already prints the reference №; **no progress
card on this page** — the sticker stands alone).

**Owner feedback round — this pass:**
- **Rebranded "Republic of Ignas" → "Dictatorship of Ignas"** everywhere user-facing:
  `lib/content.ts` (site metadata, landing title, sticker title, footer copyright, terms
  paragraph 1, the visa-sticker download filename fallback), `public/manifest.json`
  (PWA name), README, this file. The democracy joke in `/terms` got funnier: "The
  Dictatorship of Ignas is a full democracy. Ignas has won every election since birth
  with 100% of the vote." Reference code prefix (`RIG-`) and the `apps/republic` folder
  name were deliberately left alone (code-format/slug details, not prose).
- **`DocumentProgress` redesigned as a small passport** (see Gotchas) and no longer shown
  on `/visa-issued`. *(Superseded by a later pass — it's now a compact mini visa card,
  two-column, matching the `/visa-issued` sticker's design language; see the current
  Gotchas entry.)*
- **Visa cards trimmed and renamed**: Tourist → SIDEQUEST VISA ("Reward: infinite
  memories"), Consultation → SEEK ADVICE PERMIT ("Advice quality: unknown"), Fiancé →
  DATE VISA (no descriptive text at all, just the HIGH RISK stamp), Business → BUSINESS
  VISA ("Purpose: money talk, projects"), Special Purpose unchanged in name ("Purpose of
  visit: other"). Internal slugs unchanged (see Gotchas).
- **`/visa`'s subheading and `/identity`'s subtitle line are both gone** — just the
  heading + content on each now.
- **No more intermediate "CONTINUE TO APPOINTMENT" screen** after any visa sub-step —
  see the dedicated Gotchas entry.
- **Applicant number reverted from a fixed "№ 001" back to a real per-device random
  number** (47–4999, `lib/api.ts#getApplicantNumber`) — see the dedicated Gotchas entry
  for why this keeps changing and where to look for the current behavior.

**Design-research polish pass (this pass):**
- **Officer mood indicator redesigned** (`components/OfficerMoodBadge.tsx`): the old
  plain "CURRENT OFFICER MOOD: <dots> <label>" text line is gone, replaced by a compact
  split-flap desk placard — a small rubber-stamped circular "seal" (colored by mood
  tier: `text-approve`/`text-navy`/`text-stamp`, derived by counting `●` in
  `mood.dots`, no new content.ts fields needed), a split-flap text window that does a
  quick 3D flip (`animate-officer-flap`, new keyframe in `tailwind.config.ts`;
  `perspective`/`backface-visibility` live in `app/globals.css` as `.officer-flap-window`/
  `.officer-flap-text` since Tailwind has no utilities for those) on first reveal and on
  every actual mood change, and a small mirrored coffee-cup icon (fill level also driven
  by the same tier) as a glanceable redundancy channel — you can read the mood without
  reading the label. `OFFICER_MOOD_PREFIX` still comes from `lib/content.ts`, just as an
  `sr-only` prefix now instead of always-visible text, to keep the widget compact.
  Same hydration-safe pattern as before (`null` until a client effect resolves it).
- **Four low-risk "stamp/paper detail" + "micro-animation juice" polish picks**, cherry-
  picked from the design research as fast/safe (full list of what was picked vs.
  skipped, and why, lives in the session's acceptance report — the short version):
  (1) a faint, slightly-offset "ghost" second strike on every `StampSlam` (ink
  misregistration, as if the stamp landed a hair off-true — rides along with the
  existing slam animation for free, no separate animation needed);
  (2) `active:scale-[0.97]` tactile press feedback on the highest-traffic buttons
  (landing YES/NO, visa-selection cards, `/identity`'s CONTINUE, `/visa-issued`'s three
  action buttons) — wherever a button previously used `transition-opacity`/
  `transition-colors` it's now `transition-all` so the press scale actually animates
  smoothly alongside the existing hover effect, not just snap;
  (3) a soft inset vignette added to the shared `.paper-card` box-shadow (photocopy/scan
  darkening toward the edges — one extra comma-separated shadow layer, applies
  everywhere for free);
  (4) the `paper-slide-in` entrance animation now rests at `-0.35deg` instead of exactly
  `0deg` (imperceptible individually, subtly less "perfectly aligned" across every
  screen transition). All four are pure CSS/SVG, additive only, and were checked against
  the landing's no-scroll height budget (negligible impact — well within the documented
  slack).

**Latest polish pass (this pass):**
- **`/visa-issued`'s dashed reference-line box removed.** The reference № is already
  printed on the visa sticker itself, so a second always-visible copy of it was
  redundant. "PROCEED TO CONSULATE" still opens the DM synchronously first and
  best-effort copies the reference line, but the result now only ever shows as a small
  truthful status note under the button — a short confirmation on success, or the
  reference line itself (inline, small text) plus a manual-copy note on failure. The
  now-separately-redundant manual "copy" button was removed along with it;
  `REFERENCE_LINE_LABEL`/`COPY_BUTTON_LABEL` were deleted from `lib/content.ts` as
  unused.
- **`DocumentProgress` redesigned again**, from the single-column passport booklet to a
  compact two-column mini visa card matching the `/visa-issued` sticker's own design
  language (navy double-line border on paper, small header, oval photo, two-column field
  grid, thin `.barcode-mini` strip) — noticeably shorter while staying readable at
  390px. `PASSPORT_MRZ_LINE` was deleted from `lib/content.ts` (no MRZ line in the new
  design); `DOCUMENT_PROGRESS.title` changed from "PASSPORT" to "DICTATORSHIP OF IGNAS".
  Same underlying data, hydration guard, and one-time reveal-animation machinery as
  before — untouched. *(Superseded by a later pass — square photo, `STICKER_LABELS` as
  the shared label source, and a trimmed field list; see the current `DocumentProgress`
  Gotcha.)*

**Square photo + faithful-replica progress card pass:**
- **Photo frames are square everywhere** (canvas sticker + `DocumentProgress` photo box)
  — see the dedicated square-photo Gotcha above.
- **`DocumentProgress` rebuilt as a faithful DOM replica of the final canvas sticker**
  rather than just "the same design language" — it now imports `STICKER_LABELS` directly
  as the single source for every label it shares with the sticker, drops the
  DECLARATION/BIOMETRICS/STATUS rows and the per-visa sub-step summary (and the
  `truncate()`/`SUB_STEP_TRUNCATE` helper that supported it), and keeps the same
  two-column grid, one-time reveal animations, and hydration guard as before.
  `lib/content.ts`'s `DOCUMENT_PROGRESS_SUBSTEP_LABELS` was deleted (no remaining
  consumer); `DOCUMENT_PROGRESS` now only holds `appointmentLabel`. *(Superseded by the
  next pass below, which fixed this pass's incomplete field list and photo treatment.)*

**Full sticker-field parity pass (this pass):**
- **`DocumentProgress`'s field grid now replicates every sticker field, not a trimmed
  subset.** A prior pass shipped only NAME/PASSPORT №/VISA TYPE/APPOINTMENT/REFERENCE №,
  substituting APPOINTMENT for the sticker's ISSUED row — code review correctly flagged
  this as neither a faithful replica nor a proper use of the shared `STICKER_LABELS`
  source (SERIAL №/ISSUED/VALID/CONDITIONS labels existed in `STICKER_LABELS` but were
  never rendered). Fixed: the grid now renders all eight sticker fields in the sticker's
  own order (NAME + PASSPORT №, VISA TYPE + SERIAL №, REFERENCE № full-width, ISSUED +
  VALID, CONDITIONS full-width); SERIAL №/ISSUED/VALID/CONDITIONS always render as ruled
  blanks (`Row`'s existing blank state) since this component never renders alongside
  `/visa-issued`, the only place those four are ever computed. APPOINTMENT moved out of
  the field grid entirely into its own dashed-divider line beneath it, since it isn't a
  sticker field and shouldn't be confused with (or substitute for) ISSUED.
- **Photo box now matches the sticker's own placeholder treatment.** Previously
  `bg-black` (a plain silhouette) with `rounded-sm` corners; now `bg-[#cfc8b8]` with
  centered `STICKER_LABELS.photoPlaceholder` text when no thumbnail exists (the exact
  same fallback the canvas sticker draws), and no `rounded-*` class at all (true square
  corners). `Row`'s label color changed from `text-navy/50` to `text-navy`, and the visa
  subtitle line from `text-navy/70` to `text-navy`, to match the sticker's fully-opaque
  navy text rather than a muted DOM-only convention.
- No `lib/content.ts` copy strings changed — `STICKER_LABELS`/`DOCUMENT_PROGRESS` values
  are unchanged; only comments were updated to describe the corrected design, and
  `DocumentProgress.tsx` gained a second `useRevealAnimation('appointment', ...)` call
  (alongside the existing `'photo'` one, both before the `!hydrated` early return, per
  the Rules of Hooks) for the relocated appointment line's reveal animation.

Explicitly not built (per plan's "cut by decree" + owner override): rejection lottery,
diplomatic passport easter egg, customs declaration checklist, deportation-on-idle,
Turnstile/honeypot bot defenses, random secondary screening, seasonal decree banner,
per-route OG images, real Supabase persistence (stubbed only).

Verified: `npm run typecheck`, `npm run build`, and `npm run lint` all pass clean from
this folder (and via `turbo run <task> --filter=./apps/republic` from the repo root).

## Next

- A Vercel project (`republic-of-ignas`) already exists (see Stack) but the app isn't
  registered in `apps/hub/config/apps.json` yet — confirm the production URL and add the
  hub tile + icon mapping once a domain/slug is finalized. Worth deciding then whether
  the hub tile/description should say "Dictatorship" or keep a neutral description.
- Provision the real `republic` Supabase schema (additive-only) matching
  `SIDEQUEST_PLAN.md`'s table list, then swap `lib/api.ts`'s try/catch stub bodies for
  real inserts — signatures should not need to change.
- Consider per-route OG images (`/denied`, `/visa/fiance`) if this ships as the actual IG
  bio link — the plan calls the DENIED stamp OG image "elite" and it's currently unbuilt.
- If `getAvailableSlots` grows a real Google Calendar backend, keep the function
  signature (`visaType → Promise<Slot[]>`) and move the seeded-pool logic in
  `lib/slots.ts` behind a feature flag rather than deleting it (useful fallback/demo mode).
- `DocumentProgress` no longer shows a per-visa sub-step summary (matter/pitch/statement/
  interview) — dropped when the card was rebuilt as a faithful sticker replica (see
  Current state). If that visibility is wanted back, it'd need its own home (e.g. a
  small line under the grid) without regressing the "stays short" requirement that drove
  the rebuild.
- The unused sub-step gag-line copy in `lib/content.ts` (see Conventions) has no home
  right now — if it's wanted back, the likely place is a brief, non-blocking auto-advance
  toast rather than the old button-gated screen (which was explicitly removed).
