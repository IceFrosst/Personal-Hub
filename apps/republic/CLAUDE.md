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
- Mostly no backend dependency to run: `lib/api.ts` still stubs `recordApplication`/
  `recordAppointment`/`recordBribe` to localStorage, with Supabase env vars optional
  and, if present, only a best-effort fire-and-forget POST wrapped in try/catch (the
  `applications`/`appointments`/`bribes` tables don't exist yet — see Data model). The
  one exception: `getApplicantNumber` is a real (if narrow) Supabase integration — an
  async RPC call to `republic.next_applicant_number()`, backed by an actual migration
  (`supabase/migrations/0001_applicant_number_sequence.sql`) — see Gotchas.
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
  fiancé interview questions, identity/passport-card labels (including the progress
  card's per-visa sub-step addendum labels — `DOCUMENT_PROGRESS.matterLabel`/
  `.pitchLabel`/`.statementLabel`/`.interviewAnswersLabel`), statistics placeholders,
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
- **Appointment availability is real and fails closed.** `/appointment` calls
  `getAvailableDates()` → the server-only `/api/available-dates` Route Handler → Google
  Calendar `freeBusy` via `lib/googleCalendar.ts`. Candidate dates begin tomorrow and
  each candidate's complete local day is queried/checked using timezone-aware midnight
  boundaries (including DST); any timed/all-day overlap removes the whole day. The
  service-account key stays server-only and no event details are returned. A chosen day
  reveals fixed times on the same page; choosing a time immediately stores the dated
  slot and navigates to `/biometric`, with no confirmation screen. The old seeded
  `lib/slots.ts`/`getAvailableSlots` code is unused fallback/demo reference only.
- Reusable primitives: `PageShell` (mobile-first max-w-md container + paper-slide-in;
  `fullHeight` prop for the no-scroll landing, `showProgress` prop to mount
  `DocumentProgress`), `StampSlam` (the DENIED/APPROVED stamp visual), `Typewriter`
  (line reveal, respects `prefers-reduced-motion` by rendering instantly), `ProgressBar`,
  `Checkbox` (fully custom, see Gotchas), `RequireIdentity` (route guard, see below).
  Per-visa sub-steps live in `components/visa-steps/*` and share `StepShell` (which
  itself renders `<PageShell showProgress>`) — except `TouristStep`, which renders
  nothing at all now (see Current state).
- `lib/passport.ts` — a capped stamp log (localStorage), an append-only local activity
  trail (`addStamp('BIOMETRICS SUBMITTED')` etc., called from most funnel pages). It
  used to also track a per-browser visit count that drove a returning-visitor line, a
  3rd-visit loyalty message, and a passport-stamps-on-file count on the landing page —
  all removed per owner feedback (the landing must not detect or display repeat visits
  at all; see Gotchas). Don't re-add visit tracking here without checking first.
  (Unrelated to the passport-styled `DocumentProgress` card — same real-world metaphor,
  two different features that happen to share the name.)
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

- **A `republic` schema now exists, but only for one narrow purpose: the global
  applicant-number sequence.** `supabase/migrations/0001_applicant_number_sequence.sql`
  creates `republic.applicant_number_seq` and a SECURITY DEFINER RPC,
  `republic.next_applicant_number()`, granted to `anon`/`authenticated` — see the
  dedicated Gotcha below. The `applications`/`appointments`/`bribes` tables from
  `SIDEQUEST_PLAN.md`'s original table list still don't exist (task scope for *that*
  work explicitly excludes migrations/credentials for now). `lib/api.ts` POSTs to the
  **unqualified** table name (`applications`, `appointments`, `bribes`) with a
  `Content-Profile: republic` header naming the schema — PostgREST doesn't accept a
  dot-qualified `schema.table` in the URL path, only unqualified table + profile header,
  for custom (non-`public`) schemas. `response.ok` is checked explicitly (and
  `console.warn`'d in dev on failure) rather than treating a non-2xx response as a
  silent success. All of it is still wrapped in try/catch so a 404 (those tables don't
  exist yet, true today) never breaks the funnel. The **actual source of truth today is
  still localStorage** for these three: bribe count,
  stamp log, and a rolling `republic:applications-log` array.
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
- `supabase/migrations/0006_visitor_intel.sql` adds a nullable `applications.intel` jsonb column (officer-eyes-only visitor intel, `lib/intel.ts`). `supabase/migrations/0007_draft_audit.sql` adds a nullable `applications.draft_id` link and the append-only `republic.draft_events` outbox, including a DB-level `draft_events_intel_keys_check` constraint mirroring `lib/draftAudit.ts`'s `INTEL_FIELDS` client-side whitelist for `intel_collected` events. Browser clients write only anonymous events; only `republic.is_ministry()` authenticated sessions can read them. `lib/draftAudit.ts` validates lifecycle/field/intel whitelists, rejects image/blob/data-URL payloads, preserves each transition up to 4096 queued events, batches normal writes, and sends a single sub-56KB keepalive batch on exit. **Both migrations were applied remotely in strict order (0006 then 0007) on 2026-09-01, before the code deployment.** Live smoke checks confirmed anonymous INSERT succeeds, anonymous SELECT is denied, and raw/base64 payloads fail the DB constraint.
- **No bot defenses** (no Turnstile, no honeypot) — explicitly cut per owner override.
  Don't add them without checking first; it was a deliberate scope cut, not an oversight.

## Gotchas

- **Applicant numbers are now a real global sequential count, not a per-device random
  number.** `lib/api.ts#getApplicantNumber()` is `async` and calls the
  `republic.next_applicant_number()` Supabase RPC (a Postgres sequence,
  `republic.applicant_number_seq`, wrapped in a SECURITY DEFINER function —
  `supabase/migrations/0001_applicant_number_sequence.sql`), but **only once per
  browser/device**: the first resolved value is cached in
  `localStorage['republic:applicant-number-v2']` (versioned so legacy random cached
  values are ignored) and every later call (this session or a
  future one, same device) reads that cache instead of calling the RPC again — so every
  distinct visitor gets a distinct, monotonically increasing number, but nobody burns a
  number just by reloading. RPC calls are POSTs to `rest/v1/rpc/next_applicant_number`
  with a `Content-Profile: republic` header (same schema-header mechanism `tryRest` uses
  for table writes) since the function lives in a custom schema. There is **no
  random/fake fallback**: if the RPC fails for any reason (missing Supabase env vars,
  network error, or the schema not yet exposed to PostgREST per SCHEMA_RULES.md's Data
  API exposure note),
  `getApplicantNumber()` resolves `null` and the landing just keeps showing
  `LANDING.applicantNumberPlaceholder` until a later visit succeeds; it never invents a
  number locally. The response body is parsed defensively (`Number.isFinite` +
  `Number.isInteger` + positivity check) before being trusted. `formatApplicantNumber`
  (in `lib/content.ts`) zero-pads to 4 digits, same as before. **This app has gone back
  and forth on this feature** (fixed "№ 001", then a per-device random number, now a
  real backend-shared sequence per owner feedback) — read the most recent instruction,
  not an older comment you find elsewhere.
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
  `FianceStep` on its single two-option answer, and `TouristStep` renders **nothing at all** and
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
  the typewriter question, YES/NO, officer-mood badge, compact footer) is sized and
  spaced specifically to fit inside
  390×660 (the tightest realistic target — Instagram in-app webview chrome) with real
  margin to spare. If you add anything to the landing (or lengthen `LANDING.title`,
  which is now "DICTATORSHIP OF IGNAS" — longer than the old "REPUBLIC OF IGNAS"),
  re-check the fit — **zero vertical scroll on `/` is a hard requirement**, not a
  nice-to-have. (The longer title was checked against the available card width at build
  time and still fits on one line with margin; redo that check if the title changes
  again.) The landing used to also conditionally render a returning-visitor line, a
  3rd-visit loyalty message, and a passport-stamps-on-file count — all removed per
  owner feedback (the landing must never detect or display anything about repeat
  visits, full stop); see the updated `lib/passport.ts` Convention entry above. That
  removal only freed up more of the no-scroll budget, so no re-check was needed there.
- **Progress and final visa use the same readable document component.**
  `components/VisaDocument.tsx` renders the shared navy double-border, natural-ratio
  photo, true top-corner ISSUED/SERIAL row, remaining two-column fields, addenda, and
  barcode structure. `DocumentProgress` supplies
  compact live/blank values plus one-time reveal flags; `/visa-issued` supplies the
  completed values at a mobile-readable full size and overlays `StampSlam`. Both include
  the appointment and the visa-specific selected/typed addendum (matter, pitch,
  statement, or DATE VISA answer). The final page's hidden canvas exists only for PNG
  download; it mirrors the two-column fields and both addenda at a taller resolution.
  `/visa-issued` intentionally omits the separate sticky progress card because the same
  completed document is already the payoff.
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
  `slug` values (`'tourist'`, `'fiance'`, `'business'`, `'special'`; `'consultation'`
  existed too until the SEEK ADVICE PERMIT path was removed outright — see Current
  state) and everything keyed by them (`VisaType`, route params, `state.visaType`,
  `businessPitch`/`specialStatement`/`fianceAnswers` field names,
  component file names) were **deliberately left unchanged** during the visa rename pass
  — only the user-facing `name`/`tagline`/`lines` changed (e.g. `tourist` → "SIDEQUEST
  VISA"). Renaming the internal keys to match would ripple through ~10 files for zero
  user-visible benefit; don't do it without a specific reason.
- `ApplicationProvider` is mounted once in the root layout and stays mounted for the
  whole client session (Next soft navigation) — its `sessionStorage` hydration effect
  only runs once (see `hydrated`, above).
- `lib/slots.ts` and `getAvailableSlots` are no longer live behavior; they remain only
  as an unused fallback/demo reference. Do not describe seeded weekly scarcity as the
  appointment source. The live source is the fail-closed Google `freeBusy` route above.
- `overflow-x: hidden` is set on `html`/`body` in `app/globals.css` because the stamp
  slam entrance briefly scales an element to `3.2×` — without it that can flash a
  horizontal scrollbar on narrow phones during the animation.

## Current state

**Latest pass — same-device final application restore:** the returning-application card now has a prominent `VIEW FINAL APPLICATION` action. It maps the local `ApplicationRecord` through `lib/applicationState.ts` into a complete, forward-locked read-only state and routes to `/visa-issued`; it restores persisted fields and selfie metadata without raw-photo fetching. The current session's `selfieThumbnailUrl` is carried over only when `lib/applicationState.ts#resolveRestoredThumbnail` confirms the session's `referenceCode` exactly matches the record being restored — any mismatch or missing reference code drops the thumbnail so `/visa-issued` falls back to its "PHOTO ON FILE" placeholder rather than ever risking showing the wrong application's photo. Fresh sessions with a local application do not mint or audit a throwaway draft during provider hydration, and the restore path itself (`applicationContext.tsx#restoreSubmittedApplication`) never mints/records one either — `mapSubmittedApplication` always sets `draftId: null`. Mapper tests cover all visa-specific fields, legacy records, completion locks, and `resolveRestoredThumbnail`'s match/mismatch/missing-reference cases.

**Latest pass — applicant-facing decision synchronization:** migration `0008_application_status_lookup.sql` adds the tightly scoped `republic.lookup_application_status(reference_code, instagram_handle)` SECURITY DEFINER RPC. It validates the generated reference format and normalized Instagram handle, returns only `status`/`decided_at`, revokes PUBLIC execution, and grants execution (not application SELECT) to anon/authenticated; it was applied remotely on 2026-09-01 before deployment and smoke-tested against a real approved row. `lib/api.ts` has a typed, fail-closed RPC helper and `lib/useApplicationStatus.ts` polls every 7 seconds, rechecks on focus/visibility, aborts stale requests, and stops after approved/denied. The landing returning-application card and `/visa-issued` use editable status-specific copy and styling; the latter updates its existing DOM/canvas stamp without changing passport layout. Focused normalization/parser and migration coverage were added.

**Previous latest pass — Strict Mode hydration guard, payload hardening, and migration regression coverage:**
- **ApplicationProvider hydration is Strict Mode replay-safe.** A `useRef`-backed lifecycle claim persists across React's passive-effect replay, so one provider instance can mint only one draft ID and `draft_started` event; a real provider remount receives a fresh ref and hydrates normally. The focused application-state test simulates replay and asserts exactly one initialization/event.
- **Visitor/draft payload guards reject all data URI forms and base64 markers.** Migration `0006_visitor_intel.sql` bounds `applications.intel` to a 12KB JSON object with the exact approved key subset (including `selfieRetakes`) and rejects transport/suspicious selfie/photo/blob keys. Migration `0007_draft_audit.sql` rejects any `data:` or `;base64,` marker while retaining its size and event/intel key checks. Runtime and SQL static regression tests cover octet-stream, text, bare-marker, and blob-like bypass examples. Both migrations are applied remotely; live constraint/RLS smoke checks passed.

**Previous latest pass — landing hydration-race fix, ministry drafts-degrade, officer-eyes-only local log, intel key constraint:**
- **Fixed a real hydration race on `/`.** `app/page.tsx`'s mount effect used to call `beginNewApplication()` (which calls `reset()`, minting a fresh draftId and firing `draft_started`) unconditionally on mount, with no `hydrated` gate. Effects fire child-before-parent in the same commit, so on the very first paint of the whole app this ran *before* `ApplicationProvider`'s own hydration effect (which also mints a draftId + fires `draft_started` when sessionStorage is genuinely empty). The result: the provider's later hydration `setState` could silently clobber `beginNewApplication`'s just-set state (discarding the preserved identity/duty-free restore) and land on a *third*, different draftId than the one `recordIntel` had already captured for the pending `collectIntel()` call — so the officer-eyes-only intel probe for a fresh visitor's very first application could silently never be recorded (`recordIntel`'s `expectedDraftId` guard would reject it as stale). Fixed: the mount effect now does `if (!hydrated) return` and depends on `[hydrated]`, so it only ever runs once, after the provider's hydration effect has fully settled. To still get exactly one `draft_started` per funnel (not two — one from hydration, one from `beginNewApplication`'s `reset()`), a new `isFreshApplicationState(state)` helper (in the new plain, non-JSX `lib/applicationState.ts` — split out specifically so it's unit-testable under Node's `--experimental-strip-types`, which can't transform `applicationContext.tsx`'s JSX; see `test/applicationState.test.mjs`) detects the case where hydration just minted a still-untouched draft, and reuses it via a new shared `activateDraft(draftId)` helper instead of calling `reset()` a second time. Mid-session revisits to `/` with real accumulated state still go through `beginNewApplication`'s normal reset path, unchanged. The pending-review card and SUBMIT ANOTHER button behavior are both unaffected — `beginNewApplication` is still exactly what SUBMIT ANOTHER calls.
- **`/ministry` no longer denies the whole desk when only `draft_events` fails.** `loadRows` used to `setDenied(true)` on ANY query error, including the `draft_events` page loop — but `draft_events` (migration 0007) is a separate, additive, independently-RLS'd feature from `applications` (migration 0004's ministry-only RLS, the actual access gate). If migration 0007 isn't applied yet, or that query fails transiently, the fix now degrades to an empty drafts section (`events = []`) and still renders the fully-functional applications desk; ONLY an error on the `applications` query itself sets `denied`.
- **`recordApplication`'s localStorage log no longer carries `intel` or `draftId`.** `lib/api.ts#recordApplication` still sends the FULL record (intel, draftId, everything) to the DB — that's officer-eyes-only, RLS-protected, ministry-readable-only data, which is exactly where it belongs. But the local copy this function also writes to THIS DEVICE'S OWN `localStorage` (`republic:applications-log`, which drives the landing's own pending-review card via `getLastApplication()`) is the applicant's own browser storage — visitor intel and the anonymous draft-audit link have no business sitting there. Both fields are `delete`d from a shallow copy before the local write; the DB write is untouched.
- **Migration `0007_draft_audit.sql` gained a DB-level whitelist constraint on `intel_collected` event values** (`draft_events_intel_keys_check`): the value must be a JSON object (`jsonb_typeof(value) = 'object'`) whose keys are a subset of the exact same 10-field `INTEL_FIELDS` whitelist `lib/draftAudit.ts#recordDraftIntel` already enforces client-side (`ip`, `country`, `region`, `city`, `ipTimezone`, `deviceTimezone`, `referrer`, `fromInstagram`, `battery`, `connection` — NOT `selfieRetakes`, which is a separate `ApplicationState` field folded into `applications.intel` at submission time by `lib/api.ts#buildApplicationRecord`, never into a `draft_events.intel_collected` row). A plain CHECK constraint can't run a set-returning subquery (`IN (SELECT ...)`), so instead it subtracts every known-good key with the `jsonb - text[]` key-removal operator and requires nothing left over (`value - ARRAY[...]::text[] = '{}'::jsonb`) — no helper function needed. All other event types and the existing size/no-image-payload constraints are untouched. **Migrations 0006 and 0007 are live remotely.**
- **`lib/draftAudit.ts`'s module-level `URL` constant renamed to `SUPABASE_URL`** so it no longer shadows the global `URL` constructor (a latent footgun, not an active bug — nothing in the file constructs a `new URL(...)`, but any future edit that did would have silently resolved to the wrong `URL`).
- **`TouristStep`'s supply-checkbox toggle now uses a functional `setSupplies` update.** The previous `toggleSupply` read `supplies` from the render closure; two checkboxes tapped in quick succession (before React re-rendered between them) could both compute `next` off the same stale array and silently drop one toggle. Deriving `next` from the updater's own `prev` argument (always the latest queued value, even across batched updates) fixes it without adding any new state or a ref.
- **New tests** (`test/draftAudit.test.mjs`, `test/applicationState.test.mjs`, `test/migrationPayloadGuards.test.mjs`): `requestBatch`'s keepalive byte-budget behavior (byte-bounded, stops before exceeding `MAX_REQUEST_BYTES`, leaves the rest queued), `validPayload`'s size rejection at the `MAX_VALUE_BYTES` boundary (indirectly, via `recordDraftFieldChange`), the `MAX_OUTBOX_EVENTS` hard cap, all-data-URI runtime rejection, migration SQL guard coverage, `recordDraftIntel`'s exact-whitelist rejection (accepts the full 10-field set, rejects wholesale on any extra key — doubles as a drift check against the migration 0007 constraint above), `submittedDraftIds` deriving from application rows (not just `submitted` events), and `isFreshApplicationState`'s fresh-vs-touched classification. `requestBatch`, `MAX_OUTBOX_EVENTS`, `MAX_REQUEST_BYTES`, and `MAX_VALUE_BYTES` are now exported from `lib/draftAudit.ts` specifically as read-only test hooks (`flush()` itself is network-gated and a no-op without Supabase env vars, so it can't otherwise be used to observe this behavior in tests) — `enqueue` and the module-level `queue` stay unexported; nothing about the whitelisted `recordDraft*` write surface changed.
- **Deploy ordering completed:** migrations 0006 and 0007 were applied to the remote Supabase project in that order before code deployment. The app can safely assume `applications.intel`, `applications.draft_id`, and `republic.draft_events` exist.

**Previous pass — abandoned-draft audit and revision history:** every new application gets a browser-generated UUID draft ID (never rendered), persisted in sessionStorage and linked on final application rows. `lib/applicationContext.tsx` centrally audits whitelisted applicant transitions and uses explicit per-step completion markers so partial keystrokes hydrate as editable fields. `lib/draftAudit.ts` batches append-only events with previous/new JSON values, lifecycle flushes, a 4096-event cap, and best-effort anonymous PostgREST writes; draft_started, intel_collected, and submitted events are included without ever sending selfie data. Migration `0007_draft_audit.sql` adds the nullable application link, RLS-protected `draft_events`, ministry-only reads, payload checks, and useful indexes. `/ministry` paginates all applications/events in 1000-row ranges, excludes drafts with submitted events even if application linking is delayed, and groups remaining drafts into honest ABANDONED / IN PROGRESS cards with latest partial fields, expandable revision history, and officer-only intel notes. Existing visitor-intel work remains intact.

The full funnel is implemented. DATE VISA is exactly one question with no counter and
exactly two options: “Unclear, but I paid the declaration fee” and “Diplomatic immunity
via charm.” Every visa sub-step navigates directly to `/appointment`. Appointment now
shows Google Calendar-backed completely-free days beginning tomorrow, then fixed times
on the same page; choosing a time immediately stores the dated slot and navigates to
`/biometric` without a confirmation screen. Calendar access is server-only `freeBusy`,
uses the configured shared calendar's actual ID (never service-account `primary`),
checks each candidate's entire local day with DST-safe boundaries, returns no event
details, and fails closed.

The final `/visa-issued` screen uses the same `VisaDocument` structure as the progress
card, sized to remain readable around 390px: natural-ratio photo, true top-corner
ISSUED/SERIAL row, remaining two-column fields, and the collected addenda. Its off-screen downloadable canvas uses
the matching two-column order, includes both addenda, and has extra height. Processing
and DM handoff behavior remain idempotent/non-blocking as documented above.

**Hotfix — /identity ↔ /visa redirect loop:** the appointment-redesign pass (PR #78)
moved the Instagram handle from `/identity` to its own `/handle` page (after
`/appointment`, before `/biometric`) but left `RequireIdentity` demanding name **and**
handle — making `/visa` permanently unreachable (entering a name just bounced
`/identity` ↔ `/visa` forever). Surfaced on the first production deploy of that code.
`RequireIdentity` now requires the name only; `/handle`'s own guard covers the handle.

**Latest pass — Ministry review system, pending-review landing, forward-locked funnel:**
- **`/ministry` (unlisted route)** — the owner's review desk. Google OAuth via
  supabase-js (new dep; client scoped to the `republic` schema); RLS from
  `supabase/migrations/0004_application_status.sql` (applied remotely) lets ONLY the
  ministry email (`republic.is_ministry()`, JWT-email-based) SELECT/UPDATE
  `republic.applications` — any other Google account signs in fine but the first query
  errors → ACCESS DENIED copy. New columns: `status` ('pending'/'approved'/'denied',
  check-constrained, default pending) + `decided_at`. Desk shows pending applications
  with every recorded field and APPROVE/DENY stamps, plus a compact decided list.
  `ignas.wtf/**`, `www.ignas.wtf/**` and `republic-of-ignas.vercel.app/**` were added to
  the Supabase auth `uri_allow_list` for the OAuth redirect. Approval currently has no
  applicant-facing effect (Tier 2 /status page not built — see Next).
- **Landing pending-review card**: if this device already submitted an application
  (`getLastApplication()`, localStorage log — records now carry `submittedAt`), `/`
  shows APPLICATION UNDER REVIEW (reference №, visa, status line, the 1–3 business days
  note) instead of restarting the funnel, with a SUBMIT ANOTHER APPLICATION button that
  runs the old reset flow. NOTE: this deliberately supersedes part of the old "landing
  never detects repeat visits" rule — detecting a SUBMITTED APPLICATION is now required
  behavior (owner request); visit COUNTING remains forbidden.
- **`APPROVED.reviewNote`** ("APPLICATION REVIEW TAKES 1–3 BUSINESS DAYS.") prints under
  the status line on /visa-issued and on the pending-review card.
- **The funnel is forward-locked — nothing already chosen can be changed** (owner rule).
  Back-navigation now forwards: /visa → chosen sub-step; sub-steps forward once answered
  (tourist uses new `sidequestSuppliesDeclared` boolean so "declared zero supplies"
  still locks; special/business/fiance key on statement/pitch/answers-complete);
  /appointment → /handle once a slot is confirmed; /biometric → /screening once a photo
  is submitted (retake before submit still allowed); /screening → /processing once
  IQ/confidence is declared. Only the landing's SUBMIT ANOTHER starts a fresh,
  changeable application.
- Browser-verified: pending card + submit-another, and the lock cascade
  /visa→/appointment→/handle with a mid-funnel session.

**Previous pass — passport OTHER field, bigger pending stamp, split sub-step screens:**
- **Passport field changes**: `PASSPORT №:` label → `IG HANDLE:`; the VALID field is
  gone — its grid slot now shows `OTHER:` with the officer's photo observation
  (`passportPhotoNote`, the per-path BIOMETRIC_NOTE with "NOTED."/trailing period
  stripped, filled only once `selfieCaptured`). `APPROVED.validValue` and
  `STICKER_LABELS.valid` deleted; the special note itself lost its
  "FILED UNDER: CORRECT." tail (now just "SUBJECT APPEARS NERVOUS.").
- **PENDING APPROVAL stamp is 50% bigger** on /visa-issued (DOM `!text-[21px]` etc.;
  PNG scaled 1.5× and re-centered to stay inside the border).
- **Sidequest and Special sub-steps are each TWO screens now** (owner request):
  idea → supply declaration (`SIDEQUEST.suppliesSubmit`), and otherness question
  (selection auto-advances) → sworn statement (+ redaction gag). Refresh/back
  resume rules: persisted otherness skips its screen; supplies/statement re-seed
  post-hydration as before.
- **Testing gotcha (local browser-tools Chrome)**: the persistent profile's default
  zoom is 200%, so `setViewport({width:390})` really lays out at ~195px — emulate
  phones with width 780 (→ 390 CSS px). Verified this pass at true 390: passport,
  stamp, both new screens, and funnel advance all correct.

**Previous pass — path gags + Supabase submission tables:**
- **Per-path biometric observation** (`BIOMETRIC_NOTES` in content.ts, rendered on
  `/biometric` only once a photo exists): fiance "ELEVATED PULSE DETECTED. NOTED.",
  tourist "SUSPECT IS DEHYDRATED. NOTED.", business "POSTURE COULD BE BETTER. NOTED.",
  special "SUBJECT APPEARS NERVOUS. FILED UNDER: CORRECT." (special wasn't specified by
  the owner — added for consistency, flagged as removable).
- **Sidequest supply declaration** (TouristStep): optional customs checkboxes — Snacks ·
  Playlist · Questionable plan · Bail money — stored in new
  `ApplicationState.sidequestSupplies` (canonical order preserved). Checking ALL four
  earns a green rotated `FULLY_EQUIPPED_STAMP` corner stamp on the passport (new
  `VisaDocument cornerStamp` prop; drawn on the PNG canvas too, above the barcode).
- **Special path**: required "HOW OTHER IS YOUR PURPOSE?" selection
  (`SPECIAL.othernessPrompt`/`othernessOptions`, stored in `specialOtherness`, printed
  as an `OTHERNESS:` addendum on both documents + PNG) and a **redaction gag** — on
  submit the statement briefly renders with ~40% of words blacked out under
  "STATEMENT REDACTED FOR YOUR PROTECTION." then auto-advances to /appointment after
  2.6s (auto-advance, not a button, per the standing rule; randomness computed in the
  submit handler, never during render). The full statement still prints on the passport.
- **ApplicationRecord expanded** (additive): supplies, otherness, screeningQuestion,
  screeningAnswer, declaredIq, gender — so a Supabase row captures everything needed to
  look an applicant up by reference code.
- **`supabase/migrations/0002_submission_tables.sql`**: republic.applications/
  appointments/bribes with RLS enabled and INSERT-only anon policies — a deliberate,
  documented deviation from iron rule #4's user_id pattern (anonymous funnel, no auth;
  write-only from the browser, owner reads via dashboard/service role). Unique index on
  applications.reference_code. NOT yet applied to the remote project — see Next.

**Review-fix addendum (same pass, reviewer-driven):**
- Migration 0002 additionally grants anon/authenticated `USAGE` on exactly the three
  identity sequences (looked up via `pg_get_serial_sequence` in a DO block — table
  INSERT alone fails without it in a custom schema); `applicant_number_seq` stays
  RPC-only.
- **Sub-step forms now seed local state AFTER context hydration** (`hydrated` +
  one-shot `seededRef`, `prev ||` merge so pre-hydration typing wins) — initializing
  `useState` from context read pre-hydration `EMPTY_STATE` on refresh and could discard
  persisted values on resubmit. Fixed in TouristStep, SpecialStep, AND BusinessStep
  (same latent bug, root-caused). Verified in-browser: refresh restores idea, checked
  supplies, statement, and otherness selection.
- FULLY EQUIPPED is decided by the shared `isFullyEquipped` membership predicate
  (content.ts), not array length, at all three render sites.

**Previous pass — pending-review stamp + compact in-grid appointment date:**
- **Visa field is now `VISA:` unbolded + short name bold** (`BUSINESS`, `DATE`,
  `SIDEQUEST`, `SPECIAL PURPOSE`) via `formatPassportVisaName`; no repeated VISA word.
- **IQ is `IQ: 124 [face]` on the same row as SEX**, with a smaller borderless face
  (`h-5` full / `h-4` compact; PNG 24px, no stroke).
- **Today's issue date moved into the stamp** (removed from the passport corner). Stamp
  changed from green APPROVED to orange PENDING APPROVAL; `StampSlam` supports
  `color="pending"` + optional `subtext`, and final page passes `issueDate`. PNG draws
  the matching orange top-right stamp with the date. To avoid contradictory copy,
  final heading/status are now APPLICATION SUBMITTED / STATUS: PENDING APPROVAL.
- **Appointment date moved into the main grid below the SEX/IQ row**, out of the dashed
  addenda, as a full-width row labelled DATE. `formatPassportDate` display-formats the stored
  `SUN, 13 SEPT 2026 — AFTERNOON` as `13 Sept, Sun, Afternoon` without changing the
  stored record/DM value.
- **Right field column widened** (`grid-cols-[0.78fr_1.22fr]`; PNG uses the same 39/61
  split) for handles/validity/IQ; left only carries shorter content.

**Previous pass — annotated passport cleanup:**
- Applied the owner's marked-up screenshot literally: **SERIAL № removed from the
  passport**, separate visa subtitle removed, and `VISA TYPE:` label removed. The bare
  selected name (`BUSINESS VISA`, etc.) remains in the old visa-type field position.
  Internal `state.serial` is intentionally retained as a funnel/application invariant,
  just no longer printed; `STICKER_LABELS.serial`/`.visaType` deleted.
- Passport top row now has an intentionally blank left corner and the bare bold issue
  date alone at top-right. `VisaDocument` no longer needs a `visaName` prop.
- **IQ order is `IQ: 124 [face]`** beside SEX (number before image); PNG matches.
- **Photo enlarged again** while keeping natural ratio: compact `h-14` (was h-11), full
  `h-24` (was h-20), PNG 260px tall (was 220). Canvas addenda start below the larger of
  the field area/photo bottom, preventing overlap.
- Browser-checked locally against the provided BUSINESS VISA screenshot layout (issue
  date 01/09/2026, IQ 124).

**Previous pass — passport top metadata + IQ layout:**
- **ISSUED label removed entirely** (`STICKER_LABELS.issued` deleted). Passport metadata
  is now SERIAL № at the true top-left and the bare issue date at the true top-right;
  date uses smaller bold text (`7px` compact / `9px` full; PNG `10px` bold). All three
  renderers match.
- **APPOINTMENT addendum label → DATE** (`DOCUMENT_PROGRESS.appointmentLabel`).
- **IQ face + bare number moved beside SEX in field column 2**, rather than a separate
  dashed addendum. `VisaDocumentField` now supports an optional inline image; progress
  and final DOM fields add the IQ field only when `declaredIq !== null`; the PNG draws
  the loaded face + number in the matching cell. The textual screening answer remains
  its own addendum. DATE VISA still has no IQ field because it skips screening.
- **IQ meme enlarged**: `/screening` uses a near-edge-to-edge `-mx-3` wrapper; image and
  range slider are both exactly `w-full` inside that same wrapper. This supersedes the
  previous 48%-wide plot-axis alignment. Browser-checked locally with a completed
  BUSINESS VISA (IQ 123) and on the screening form.

**Previous pass — camera permission reverted to tap-only:** `/biometric` no longer calls
`getUserMedia` or starts a live camera on page load. The previous auto-front-camera pass
caused an immediate browser permission prompt; owner rejected that. The page is back to
`<input type="file" accept="image/*" capture="user">`: no prompt on entry, and the
phone's front/selfie camera opens only after the applicant presses TAKE PHOTO. DATE VISA
still skips IQ after submission.

**Previous pass — clickable duty-free + final-passport layout correction:**
- **Two duty-free items are now green, available buttons**: Unsolicited life advice and
  Priority boarding on future sidequests. Clicking stores the name in new persisted
  `ApplicationState.dutyFreeItems`, changes the item to "ADDED TO PASSPORT", and prints
  the selections as one `DUTY-FREE:` addendum on the progress card, final DOM passport,
  and downloadable PNG. `ApplicationRecord` also carries optional `dutyFreeItems` /
  `duty_free_items`. `/duty-free` is now a client page; RETURN uses `router.back()` so it
  resumes the funnel instead of navigating to `/` and resetting the selected item; the
  landing reset also explicitly preserves `dutyFreeItems` for shopping initiated from
  its footer.
- **Visa title duplication fixed globally**: `VisaDocument` and the PNG canvas print the
  actual `visa.name` only (`DATE VISA`), not `VISA — ${visa.name}` (`VISA — DATE VISA`).
  `STICKER_LABELS.visaPrefix` deleted.
- **ISSUED / SERIAL really are the passport's top corners now**: the prior pass only
  reordered them inside the narrow grid beside the photo (owner correctly couldn't see
  the intended move). `VisaDocument` now lifts the first two fields into a dedicated
  full-width row directly under the title, left/right anchored; the PNG canvas mirrors
  it at y=122. Remaining fields stay beside the photo.
- **Final-page outer outline removed + passport widened**: `/visa-issued` no longer wraps
  its already-double-bordered `VisaDocument` in another `.paper-card`; a plain `px-3`
  container gives the passport ~20px more usable width than before without going
  edge-to-edge. Browser-checked locally with a completed fake DATE VISA and both
  duty-free selections.
- **Historical/superseded camera permission note**: this pass's auto-starting live
  `getUserMedia` front camera caused a browser prompt on entering `/biometric`; the owner
  rejected it immediately. See the latest pass above — tap-only capture is current.

**Previous pass — big v1 feedback batch:**
- **Landing**: applicant № moved to the card's top-LEFT corner (its old centered spot
  stays as equivalent empty space — a 15px spacer, owner request); the static PRIORITY
  stamp in the top-right is now a tappable PRIORITY ↔ NON-PRIORITY toggle button (pure
  theater, changes nothing downstream; `LANDING.nonPriorityStamp` added); the follow-up
  question font grew ~10% (text-sm → text-[15px]).
- **/denied variants**: NO on the landing pushes `?via=nothing` — no REASON line, just
  the existing wasting-officer's-time STATUS. CLASSIFIED gender shows no REASON either,
  and its STATUS is `DENIAL.statusClassified` ("KINDLY, FUCK OFF.") —
  `CLASSIFIED_DENIAL_REASON` was deleted. The appeal button is plain "FILE AN APPEAL"
  (the "(wait, actually…)" tail removed).
- **Passport field order** is now ISSUED + SERIAL № (top corners), NAME + PASSPORT,
  VISA TYPE + VALID, SEX — in all three renderers (progress card, final DOM, canvas).
- **Sidequest visa has a sub-step again**: "WHAT'S THE IDEA?" textarea (placeholder
  "It better be good"), stored in new `ApplicationState.sidequestIdea`, printed as the
  `IDEA:` addendum, and recorded as optional `idea` on the application record.
- **/biometric starts the FRONT camera live on page load** (`getUserMedia`
  `facingMode:'user'`, mirrored preview + mirrored capture); falls back to the old
  `capture="user"` file input if getUserMedia fails/denied. Capture is an in-page
  canvas grab now — no OS camera app in the happy path.
- **/screening slider is width-matched to the meme's IQ axis** (ml-[24%] w-[48%] — the
  55/145 ticks sit at ~24%/72% of the image) so it never extends past the chart.
- **Duty-free** lost the compliment/playlist/hug items; **/terms** lost §10 (the © line
  — the footer still carries it).

**Previous pass — date-path IQ skip, DATE VISA flavor line, final-page copy trims:**
- **DATE VISA (fiance) skips the IQ self-assessment**: `/biometric` routes fiancé
  applicants straight to `/processing`, and `/screening` itself forwards any fiancé
  session (deep link / back-navigation) the same way. No IQ addendum ever prints for
  them (`declaredIq` stays null).
- **DATE VISA got a flavor line back** — 'Purpose: romance, allegedly' — it was the only
  card without one (previously deliberate: HIGH RISK stamp only; owner reversed that).
- **/visa-issued copy trims**: the CONDITIONS "bring snacks" gag is fully retired
  (subtitle now shows only VALID; `APPROVED.conditions`/`conditionsValue` and the unused
  `STICKER_LABELS.conditions` deleted), and the DM button reads "REPORT TO THE
  AUTHORITIES" instead of "REPORT TO THE MINISTRY".

**Previous pass — passport trims, natural photo ratio, guaranteed sex question, CLASSIFIED trap:**
- **REFERENCE № removed from both documents** (progress card, final DOM document, and the
  downloadable PNG canvas) — the code itself still exists and still drives the DM
  reference line + records; it's just not printed on the passport anymore.
  `STICKER_LABELS.reference` deleted.
- **Passport photo keeps the capture's original aspect ratio** — no more square crop of
  the human. DOM: fixed height, `w-auto object-contain`, `max-w-[45%]` cap so extreme
  landscape captures can't crowd the field grid; placeholder box keeps a fixed
  portrait-ish width (`photoBlank` size entries). Canvas: fixed 220px height, width from
  the image's own ratio clamped to [150, 300]. (Square frames were themselves a previous
  owner request replacing ovals — this supersedes that: natural ratio now.)
- **IQ is image + number only, everywhere**: `/screening` lost the sub-line, section
  heading, instruction line, and min/100/max scale row (`SCREENING.sub`/`iqHeading`/
  `iqInstruction`/`iqValueSuffix` deleted; `iqAriaLabel` added for the slider's
  screen-reader name); the documents' IQ addendum is now the wojak face + the bare
  number (empty label — `DOCUMENT_PROGRESS.iqLabel` deleted).
- **The sex question can no longer be skipped.** Two changes: `/denied`'s appeal now
  restarts at `/` (the landing questionnaire) instead of `/identity` — going straight to
  /identity skipped declare/follow-up/gender entirely, which is exactly the "I was never
  asked my sex" bug — and `RequireIdentity` now also requires `state.gender`, bouncing
  gender-less sessions to `/` (not `/identity`, which never asks it). The landing
  preserves name/handle across its reset, so an appeal never re-types, only re-answers.
- **Selecting CLASSIFIED as gender is a trap** — same mechanic as the bribe:
  `app/page.tsx#answerGender` pushes `/denied?via=classified` (nothing stored) and
  `/denied` prints `CLASSIFIED_DENIAL_REASON`. The `via` query param now dispatches
  between bribe/classified/random reasons.

**Previous pass — SEEK ADVICE PERMIT removed + final document no longer stretched:**
- **The consultation path is gone entirely, not hidden** (owner request): the
  `'consultation'` slug was removed from `VisaType` and `VISAS` (so `/visa` shows four
  cards and `/visa/consultation` 404s via `VALID_SLUGS`), `ConsultationStep.tsx` was
  deleted along with its `CONSULTATION` copy and the unused `PRELIMINARY_RULINGS` bank,
  `consultationMatter` left `ApplicationState`, `visaAddendum`'s consultation case and
  `DOCUMENT_PROGRESS.matterLabel` are gone. `appointmentPeriodsFor`'s `string[] | null`
  signature was kept (consultation was the only null — the appointment page's
  no-time-step branch is currently unreachable but harmless). `lib/api.ts` keeps the
  optional `matter` field in the record/table shape for forward-compat, just never
  populates it. The fake "Consultation permits issued: 129" statistic stays — a permit
  nobody can apply for anymore is in keeping with the Ministry.
- **`VisaDocument size="full"` no longer stretches vertically** — it used to stack each
  label above its value with large row gaps; now both sizes share the exact compact
  arrangement (label + value on one line, `justify-between`, values `truncate` with a
  `title` attribute, photo `h-20`), so `/visa-issued`'s document reads as a scaled-up
  version of the progress card the visitor watched fill in, not a different, taller
  layout. Long addenda (pitch/statement/screening answer) therefore truncate on screen
  — the downloadable PNG canvas still renders them in full, wrapped.

**Previous pass — spottable cash pile + bribe-means-denial + legible officer mood:**
- **The hidden bribe is no longer a 💵 emoji tab.** `components/HiddenBribe.tsx` now
  draws an SVG pile of banknotes (fanned bills + currency strap, muted greens) peeking
  from behind the right screen edge — mostly off-screen (clipped by the global
  `overflow-x: hidden`), quiet slow bob only. The old golden glow + shimmer sweep were
  **deliberately removed** (owner: the user has to *spot* it) — `bribe-glow`/
  `bribe-shimmer` keyframes and `.bribe-shimmer-sweep` CSS are gone; `bribe-peek` is now
  just the subtler `bribe-bob`. Don't re-add attention-grabbing effects to it.
- **The cash pile is mounted globally from `PageShell`** (both variants), not just the
  landing — the applicant can screw up on any page, at any point in the funnel,
  including after approval on `/visa-issued`.
- **Offering the bribe DENIES the application.** `BribeButton` still records the attempt
  (device counter + best-effort backend stub, unchanged), shows the updated
  `BRIBE.response` ("… APPLICATION DENIED."), then after ~1.8s pushes
  `/denied?via=bribe`. `/denied` reads `window.location.search` inside its mount effect
  (hydration-safe; avoids `useSearchParams`' Suspense requirement) and prints
  `BRIBE_DENIAL_REASON` instead of a random reason. `formatBribeStatus` was removed from
  `lib/content.ts` (inlined in `BribeButton`). Known edge case: bribing while already on
  `/denied` records the attempt but the already-mounted page's effect doesn't re-run, so
  the printed reason doesn't change — accepted.
- **`OfficerMoodBadge` redesigned for legibility** — the split-flap placard (stamp seal +
  coffee-cup metaphor) read as decoration, not information (owner: "you can't really
  understand some mood"). Now a plain readable placard: visible `OFFICER_MOOD_PREFIX`
  caption (no longer sr-only), a five-pip ink meter, and the mood label in stamp type,
  meter + label both tier-colored (green/navy/red from counting `●` in `mood.dots`, as
  before). `officer-flap` keyframe/animation and `.officer-flap-window`/
  `.officer-flap-text` CSS were removed as unused.

**Historical owner feedback round (superseded details are called out):**
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
- **Historical/superseded:** applicant number briefly reverted from fixed “№ 001” to a
  per-device random number. Current behavior is the backend sequence described above.

**Historical design-research polish pass:**
- **Officer mood indicator redesigned** (`components/OfficerMoodBadge.tsx`) *(the
  split-flap design below is superseded — see the latest pass above; kept as history)*:
  the old
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

**Historical polish pass:**
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

**Historical square-photo + progress-card pass:**
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

**Historical full sticker-field parity pass:**
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

**Historical repeat-visitor removal + real applicant counter + copy cleanup pass:**
- **The repeat-visitor feature is gone from the landing entirely.** No returning-visitor
  line, no 3rd-visit loyalty message, no passport-stamps-on-file count — per owner
  feedback, the landing must never detect or display anything about a visitor's prior
  visits. `lib/passport.ts#registerVisit` and its visit-count tracking were deleted;
  `RETURNING_VISITOR`/`LOYALTY_MESSAGE`/`LANDING.passportStampsLabel` were deleted from
  `lib/content.ts`. The capped stamp *log* (`addStamp`/`getPassport`) was kept — it's
  still a useful local activity trail, it just no longer has anything to do with visit
  counting or landing display.
- **The applicant number is now a real, globally sequential, backend-shared count**
  instead of a per-device random one — see the dedicated Gotcha and Data model entries
  above, and `supabase/migrations/0001_applicant_number_sequence.sql`. `getApplicantNumber`
  is now `async`; `app/page.tsx` awaits it in its mount effect and simply leaves the
  placeholder up if it resolves `null`. The migration was written but deliberately not
  applied to the remote project as part of this change (see Next).
- **"FORM 1G-NAS" is gone from every visible string and stale comment.** The landing's
  form-code line now reads plainly as `ENTRY DECLARATION` (the header above it already
  said `BORDER CONTROL`); the stale "FORM 1G-NAS" comments in `components/PageShell.tsx`
  and `lib/formProgress.ts` (both describing the current `DocumentProgress` card, which
  hasn't been called that since an earlier rebrand pass) were corrected. `CLAUDE.md`'s
  own historical Gotcha note about "the old flat 'FORM 1G-NAS' strip" was left as-is
  — that's accurate history about a past design, not a stale claim about the present.
- **`DocumentProgress` shows the chosen visa's sub-step content again**, as a compact,
  optional one-line addendum below the field grid (same treatment as the existing
  APPOINTMENT addendum) — the business pitch, special-purpose
  sworn statement, or fiancé interview answers (joined into one line), whichever
  applies; tourist has no sub-step and so never shows one. New centralized labels:
  `DOCUMENT_PROGRESS.matterLabel`/`.pitchLabel`/`.statementLabel`/`.interviewAnswersLabel`
  in `lib/content.ts`. Long values are CSS-`truncate`d (plus a `title` attribute with the
  full text) rather than sliced in code, so fiancé's three joined answers are never
  discarded from context state, only visually compacted. Uses the same one-time
  `useRevealAnimation` reveal machinery as every other field (key `'subStepContent'`).
- **"BIOMETRIC VERIFICATION" → "IDENTITY VERIFICATION"** on `/biometric` (heading,
  submit button now "SUBMIT PHOTO", loading state now "SUBMITTING PHOTO…") — the
  content constant was renamed `BIOMETRIC` → `IDENTITY_VERIFICATION` and its one
  consumer (`app/biometric/page.tsx`) updated. The internal `/biometric` route,
  component name, and every `selfie*` field name in `ApplicationState` were
  deliberately left unchanged — an internal/route detail, not user-facing prose.
- **The screenshot-bait purge-notice line — "UNCLAIMED BIOMETRIC DATA IS INCINERATED
  AFTER 72 HOURS. THE MINISTRY DOES NOT KEEP SOUVENIRS." — is deleted everywhere**: the
  `/biometric` page (removed cleanly, not left as empty spacing) and its matching
  `/terms` paragraph (old §6). `TERMS_PARAGRAPHS` was renumbered contiguously (old §7–11
  → new §6–10); `app/terms/page.tsx`'s hardcoded screenshot-easter-egg index moved from
  `i === 6` to `i === 5` to match. The remaining "Biometric data" wording (old §5) was
  reworded to "Identity verification data" to match the renamed verification step.

**Historical code-review fix pass:**
- **`APPOINTMENT.continue` (`/appointment`'s "proceed" button) now says "PROCEED TO
  IDENTITY VERIFICATION"**, not the pre-rebrand "PROCEED TO BIOMETRICS" — this label
  was missed by the earlier BIOMETRIC → IDENTITY VERIFICATION copy pass (see the entry
  above); it's fixed now, no other `APPOINTMENT` fields changed.
- **`lib/api.ts`'s file-header and `tryRest` comments no longer claim the `republic`
  schema doesn't exist or that no credentials/migrations are involved.** Both were
  stale as of the applicant-number migration landing: the schema is real now (just
  narrowly scoped to the sequence/RPC — `applications`/`appointments`/`bribes` still
  don't exist as tables), and the applicant-number RPC path genuinely does need
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` configured to resolve past
  `null`. No behavior changed, only the comments.
- **`supabase/migrations/0001_applicant_number_sequence.sql` now explicitly `revoke`s
  `execute` from `public` before `grant`ing it to `anon`/`authenticated`** — Postgres
  grants `EXECUTE` on newly created functions to `PUBLIC` by default, which would have
  quietly handed every role in the database (not just the two PostgREST actually calls
  as) the ability to call this `SECURITY DEFINER` function. Still not applied to the
  remote project (see Next).
- **Same-tab in-flight dedup added to `lib/api.ts#getApplicantNumber`** (a module-level
  `inFlightApplicantNumberRequest` promise) so React StrictMode's dev-only double mount
  (`app/page.tsx`'s effect calling `getApplicantNumber()` with no ref guard) can no
  longer burn two sequence values for one visitor — the second near-simultaneous call
  now reuses the first's in-flight RPC promise instead of firing its own. Purely a
  same-tab safeguard (cleared once the request settles); the per-browser localStorage
  cache and the fail-closed-to-`null` behavior on RPC failure are both unchanged.

Explicitly not built (per plan's "cut by decree" + owner override): rejection lottery,
diplomatic passport easter egg, customs declaration checklist, deportation-on-idle,
Turnstile/honeypot bot defenses, seasonal decree banner,
per-route OG images, real Supabase persistence for applications/appointments/bribes
(still stubbed to localStorage) — the applicant-number counter is the one narrow
exception, backed by a real migration/RPC; see the dedicated Gotcha above.

Verified: `npm test` (22 tests — calendar boundary/overlap/fail-closed coverage, draft-audit
whitelist/size/cap/batch-budget and all-data-URI behavior, migration SQL guard coverage,
provider hydration-claim and `isFreshApplicationState` classification, and status
normalization/parser coverage), `npm run typecheck`, `npm run build`, and `npm run lint`
all pass clean from this folder (one pre-existing, unrelated
`react-hooks/exhaustive-deps` warning on `/visa-issued`).

## Next

- **Handoff:** same-device final application restore is implemented. Run the production/manual browser check with sessionStorage cleared and a local application log present; confirm VIEW FINAL APPLICATION reaches `/visa-issued`, preserves status polling/download, and back-navigation stays locked. Applicant status synchronization and migration 0008 remain live; the anonymous RPC smoke test returned only `status`/`decided_at` for a real approved row.
- **Applicant-facing status synchronization is now built:** the landing card and `/visa-issued` call the narrow lookup by exact reference code + normalized handle, poll every 7 seconds, recheck after focus/visibility, and stop after a terminal decision. No public application SELECT was added.
- **Owner must smoke-test /ministry sign-in on production** (Google OAuth redirect —
  can't be automated headlessly).
- **✅ Backend is LIVE (both former blockers resolved).** Migrations 0001 + 0002 are
  applied to the remote project; the `republic` schema is exposed (Management API PATCH
  → persisted, then `ALTER ROLE authenticator SET pgrst.db_schemas` +
  `NOTIFY pgrst reload config/schema` to reach the running PostgREST — the PATCH alone
  never propagated). Verified end-to-end: the RPC allocates real numbers (production
  landing shows `APPLICANT № 0002`; № 1 was burned by setup verification), anonymous
  INSERTs land in `applications`/`bribes`, anonymous SELECT is correctly denied
  (write-only), and test rows were deleted afterwards. Submissions are now retrievable:
  look up an applicant's full record by reference code in the Supabase dashboard
  (`republic.applications`). Supabase credentials (access token + ref + anon pair) are
  now global for every pi session on this machine — see `~/.pi/agent/AGENTS.md`
  "Supabase access" and `~/.bashrc`.
- **V1 mobile regression pass:** rerun every visa path at Pixel 8 / Instagram in-app
  viewport and iPhone SE after the rapid passport-layout iterations; verify progress +
  final DOM + downloaded PNG, camera tap-only behavior, date-path IQ skip, duty-free
  selections, denial traps, Calendar fail-closed behavior, and DM handoff.
- **Portfolio decision:** app is live at `ignas.wtf` but still absent from
  `apps/hub/config/apps.json`; add it only if it should also appear in the portfolio hub,
  after choosing final tile copy/icon.
- **Post-v1 optional:** per-route OG images (`/denied`, `/visa/fiance`).
