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
  `components/VisaDocument.tsx` renders the shared navy double-border, square photo,
  two-column field grid, addenda, and barcode structure. `DocumentProgress` supplies
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
- `lib/slots.ts` and `getAvailableSlots` are no longer live behavior; they remain only
  as an unused fallback/demo reference. Do not describe seeded weekly scarcity as the
  appointment source. The live source is the fail-closed Google `freeBusy` route above.
- `overflow-x: hidden` is set on `html`/`body` in `app/globals.css` because the stamp
  slam entrance briefly scales an element to `3.2×` — without it that can flash a
  horizontal scrollbar on narrow phones during the animation.

## Current state

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
card, sized to remain readable around 390px: square photo, two-column fields, appointment
addendum, and the selected/typed visa addendum. Its off-screen downloadable canvas uses
the matching two-column order, includes both addenda, and has extra height. Processing
and DM handoff behavior remain idempotent/non-blocking as documented above.

**Latest pass — spottable cash pile + bribe-means-denial + legible officer mood:**
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
  APPOINTMENT addendum) — the consultation matter, business pitch, special-purpose
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

Verified: `npm test` (calendar boundary/overlap/fail-closed coverage), `npm run typecheck`,
`npm run build`, and `npm run lint` all pass clean from this folder.

## Next

- **Calendar integration ready:** Google Calendar API enabled; dedicated service account
  shared with the primary calendar using “See only free/busy (hide details)”; production
  and preview Vercel environments contain `GOOGLE_CALENDAR_ID`,
  `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, and timezone.
  A live freeBusy request succeeded without exposing event details.
- **Existing applicant-number backend blocker:** apply
  `supabase/migrations/0001_applicant_number_sequence.sql`, expose the `republic` schema
  through the Data API/authenticator configuration, and reload PostgREST config/schema.
  Until then the applicant number correctly remains a placeholder.
- A Vercel project (`republic-of-ignas`) exists but the app is not registered in
  `apps/hub/config/apps.json`; confirm its production URL and final hub copy first.
- Provision the remaining additive-only `republic` application/appointment/bribe tables
  before replacing the current best-effort localStorage stubs.
- Consider per-route OG images (`/denied`, `/visa/fiance`) if this becomes the IG bio link.
