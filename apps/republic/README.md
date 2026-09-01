# Dictatorship of Ignas — Border Control

A gamified, deadpan-bureaucracy link-in-bio site for Ignas's personal Instagram. The
visitor is a traveler applying to enter the fictional "Dictatorship of Ignas"; every
social interaction (hang out, ask advice, pitch a business idea, ask him out) is
reframed as a visa application. The joke only works if the site takes itself 100%
seriously — including the terms page's straight-faced claim that the Dictatorship is
also a full democracy.

Full concept doc: `../../SIDEQUEST_PLAN.md` (root of the monorepo — written before the
rebrand, still uses the original working name).

## The funnel

```
ENTRY DECLARATION (no-scroll landing: "do you have something to declare?")
  NO  → ENTRY DENIED (stamp slam, rotating reason, "file an appeal" loops to /identity)
  YES → APPLICANT IDENTIFICATION (name + Instagram handle — skipped if already on file
        this session) → VISA SELECTION (5 visas)
          → per-visa sub-step (1-field form / fiancé interview, now a single
            question — sidequest has none) → straight to CONSULATE APPOINTMENT,
            no confirmation screen in between
          → CONSULATE APPOINTMENT (pick a real free day from Ignas's Google
            Calendar, then a time — picking a time advances immediately, no
            confirmation screen)
          → IDENTITY VERIFICATION (selfie via file input, final step; route stays /biometric)
          → PROCESSING (progress bar stutters at 99%)
          → VISA ISSUED (completed visa document, PNG download, DM handoff)
```

Every screen also has its own route (`/identity`, `/denied`, `/visa`, `/visa/[type]`,
`/appointment`, `/biometric`, `/processing`, `/visa-issued`, `/statistics`, `/duty-free`,
`/terms`) so screenshots and shares link somewhere sensible, but the funnel *state*
(name, handle, visa choice, answers, slot, selfie, reference code) lives in one React
context so it survives client-side navigation between them. Landing restarts the
*application* on every visit but preserves identity already on file this session (real
border control doesn't re-check your passport every time you walk up to the counter).

A small mini-visa-card progress card is pinned to the top of every page from
`/identity` onward (never the landing, which never scrolls, and never `/visa-issued`,
where the big visa sticker is the payoff and stands alone) — see "The progress card"
below.

## Visas on offer

Each card is now just an icon, a name, and at most one short flavor line (fiancé gets
neither — only the HIGH RISK stamp):

- 🗺 **SIDEQUEST VISA** — Reward: infinite memories
- 📋 **SEEK ADVICE PERMIT** — Advice quality: unknown
- 💍 **DATE VISA** — (HIGH RISK)
- 💼 **BUSINESS VISA** — Purpose: money talk, projects
- 📎 **SPECIAL PURPOSE VISA** — Purpose of visit: other

Selecting one (and completing its sub-step form, if it has one) goes straight to the
appointment picker — there's no "continue" confirmation screen in between anymore. The
fiancé/DATE VISA "interview" is now a single question ("Purpose of visit?", two options)
with no visible question counter — the old 3-question interview (red flags, favorite
food) was cut per owner feedback.

## Identity / "the DM is the passport"

There's no login. `/identity` collects a name + self-reported Instagram handle before
visa selection; the final step of *every* visa is a selfie (composited into the
downloadable visa sticker, which already prints the reference № on the sticker itself), and the last
screen's "PROCEED TO CONSULATE" button opens `https://ig.me/m/ignas_simanavicius` and
best-effort copies a reference line (`VISA TYPE · RIG-XXXX · slot`) to the clipboard —
Instagram's `ig.me` deep links can't pre-fill message text, so the flow is open thread →
paste. There's no permanent on-screen reference-line box (redundant with the sticker); a
small truthful status note appears under the button instead — "copied, paste it in the
DM" on success, or the reference line shown inline in small text with a manual-copy note
on failure. Ignas looks up the reference code to see what was submitted and
confirms/declines by DM.

## The shared visa document design

`components/VisaDocument.tsx` is the shared, presentational (no hooks/context) structural
component for the navy double-border/paper visa document look — header + visa name, a
larger photo at the capture's natural aspect ratio; an unequal two-column grid (NAME +
PASSPORT №, unbolded `VISA:` + bold short name and VALID, SEX + optional smaller
borderless `IQ: number [face]`, then compact appointment DATE below); an orange PENDING APPROVAL stamp
containing today's issue date; optional visa-answer/screening/duty-free addenda with a
dashed-divider treatment, and a barcode strip. It has two
sizes and two callers:

- **`components/DocumentProgress.tsx`** (`size="compact"`) — the small sticky progress
  card shown via `<PageShell showProgress>` on every page from `/identity` through
  `/processing`. It owns hydration guarding and a one-time "field-fill" reveal animation
  per field (`lib/formProgress.ts` tracks which field keys already played it in
  `sessionStorage`, so a refresh mid-funnel never replays it), and renders blank ruled
  lines for anything not filled in yet — SERIAL №/ISSUED/VALID/CONDITIONS as soon as a
  visa is picked, REFERENCE № only once `/processing` generates it. Below the grid it
  shows up to two addenda (not sticker fields): the confirmed APPOINTMENT slot, and —
  once the chosen visa's sub-step actually collected something — the consultation
  matter / business pitch / sworn statement / fiancé answer, whichever applies.
- **`app/visa-issued/page.tsx`** (`size="full"`) — the final, on-screen document once a
  visa is actually issued: larger and readable at ~390px, every field complete (no
  blanks), the same appointment + visa-answer addenda, the applicant's photo, and an APPROVED stamp overlaid via
  `StampSlam`. This is now real DOM, not a canvas render — crisp at any zoom/DPI, and
  guaranteed to share the exact same structure as the progress card since both render
  through `VisaDocument`.

A separate off-screen `<canvas>` on `/visa-issued` exists ONLY to produce the downloadable
PNG (`DOWNLOAD VISA`) — it's tall enough for the same appointment and visa-answer
addenda and uses the same two-column field order as `VisaDocument` (previously a single
vertical text list), so the downloaded image matches the on-screen design as closely as
a canvas practically can; it is never itself visible on the page.
`prefers-reduced-motion` collapses the progress card's reveal animation to a single
instant frame via the same global rule every other animation in this app uses.

## Applicant number

The landing page shows a real, globally sequential applicant number, shared by every
visitor — not a per-device random number. `lib/api.ts#getApplicantNumber` calls the
`republic.next_applicant_number()` Supabase RPC (a Postgres sequence wrapped in a
SECURITY DEFINER function; see `supabase/migrations/0001_applicant_number_sequence.sql`)
**at most once per browser/device**: the very first resolved value is cached in
`localStorage` and zero-padded to 4 digits for display, and every later visit on the
same device reads that cache instead of calling the RPC again. If the RPC call fails (no
Supabase env vars configured, network error, or the schema isn't exposed to PostgREST
yet), the app does **not** fabricate a number — it just keeps showing
`LANDING.applicantNumberPlaceholder` until a later attempt succeeds. The value starts
`null` and is only ever resolved from a client effect (hydration-safe, since this page
is statically prerendered).

## Consulate appointment availability (Google Calendar)

`/appointment` shows real free days from the shared Google Calendar configured by its actual Calendar ID, then a
fixed set of times once a day is picked. `app/api/available-dates/route.ts` (a server-only
Route Handler) calls `lib/googleCalendar.ts`, which authenticates as a Google service
account (JWT signed with Node's built-in `crypto`, no `googleapis` SDK) and queries the
Calendar **freeBusy** API — busy/free intervals only, never event titles or other
details, and never writes anything. Candidates begin tomorrow. The query spans every
candidate's complete local day, and a day is only returned as “free” if it has zero busy
time at all (any overlapping timed or all-day event blocks the whole day) within a
bounded 30-day window; local-midnight boundaries remain correct across DST. The route
caches its response for ~60s. Any missing env var,
auth failure, or malformed response fails closed to an empty date list — the appointment
page then shows "no appointments available," never a fabricated bookable day.

Requires three server-only credentials (see `.env.example` for the full manual setup —
enabling the Calendar API, creating the service account, sharing the actual target calendar
with it using least-privilege “See only free/busy (hide details)” permission, and copying
that calendar's ID — never `primary`, which means the service account's own calendar):
`GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. `GOOGLE_CALENDAR_TIME_ZONE` is optional and defaults
to `Europe/Vilnius`. None are `NEXT_PUBLIC_`-prefixed or sent to the browser. Picking a time immediately
stores an unambiguous `"<DATE> — <TIME>"` string in `state.slot` and navigates straight
to `/biometric` — no confirmation screen, matching the rest of the funnel.

## Stack

- Next.js 15 (App Router) + TypeScript, mobile-first (built/verified at 390px, and the
  landing specifically at 390×660 down to 390×844 with zero vertical scroll)
- Tailwind CSS with a dedicated paper/stamp design system (see `tailwind.config.ts` and
  `app/globals.css`) — off-white paper, navy ink, stamp red, approval green
- Fonts via `next/font/google`: IBM Plex Mono (body/forms) + Special Elite (stamps)
- All CSS/SVG animation (stamp slam, screen shake, typewriter reveal, paper-slide,
  passport-card field-fill, the hidden cash pile's quiet bob) — no WebGL, no animation
  library
- Tiny WebAudio-generated blips, on by default for everyone (no toggle) — every call
  site is already inside a click/tap/change handler, which is what a browser's autoplay
  policy actually needs (one prior user gesture on the page); `lib/sound.ts` also
  best-effort `resume()`s the shared `AudioContext` if it started suspended
- The final `/visa-issued` document (and the mid-funnel progress card) are real DOM,
  rendered via the shared `components/VisaDocument.tsx` — see "The shared visa document
  design" above. A separate off-screen `<canvas>` composites the downloadable PNG only
  (photo + APPROVED stamp + serial + reference code) — no server round-trip
- Custom checkbox (`components/Checkbox.tsx`): the real `<input type="checkbox">` stays
  functional but invisible (`opacity-0`); the box + check mark are drawn by sibling
  elements, so it never depends on native checkbox rendering or `accent-color` support.
  Use this for any future checkbox — a bare `<input type="checkbox">` combined with this
  app's global `appearance: none` reset is exactly what made the sworn-statement
  checkbox on `/visa/special` invisible in production.
- `lib/api.ts` — typed backend stubs (`recordApplication`, `recordAppointment`,
  `recordBribe`, `uploadPhoto`) that always work off localStorage and best-effort
  (try/catch-swallowed) POST to Supabase only if `NEXT_PUBLIC_SUPABASE_URL` is set — no
  `applications`/`appointments`/`bribes` tables exist yet, so this is forward-compatible
  scaffolding, not a live integration. `getApplicantNumber`, specifically, is a real (if
  narrow) integration already: it calls the `republic.next_applicant_number()` Supabase
  RPC (see `supabase/migrations/`) to hand out a real global sequential number, at most
  once per browser/device — see "Applicant number" above. `getAvailableDates`, also real,
  fetches `/api/available-dates` — see "Consulate appointment availability" above. The
  old joke `getAvailableSlots`/`lib/slots.ts` pool is unused now, kept only as a
  fallback/demo-mode reference.
- No bot defenses (no Turnstile, no honeypot) and no server persistence beyond the
  best-effort stub above (application/bribe records) — this is a client-side joke funnel,
  not a form product. The Google Calendar integration (above) is the one exception: it's
  a real, read-only, server-only API call, not a stub.

## Develop

From the repo root (recommended, uses the shared workspace install):

```bash
npm install
npm run dev -- --filter=./apps/republic
```

Or from this folder directly:

```bash
npm install
npm run dev
```

Then open http://localhost:3000 and resize to ~390px width (iPhone SE-ish) to check the
mobile layout — that's the target viewport since most traffic comes from the Instagram
in-app browser. Check the landing specifically at 390×660 (Instagram webview chrome) and
390×844 (a tall modern phone) — it must never scroll at either.

## All copy lives in one place

`lib/content.ts` — visa definitions, denial reasons, gag lines, interview questions,
identity/passport-card labels (including the progress card's per-visa sub-step addendum
labels), statistics placeholders (including the "one citizen" footnote), duty-free
stock, terms paragraphs (including the paragraph 6 screenshot easter egg and the
democracy clause), the DM handle/deep link, and the reference-line format. Edit copy
there, not scattered across components. A few sub-step gag lines (preliminary rulings,
the sworn-statement replies, the fiancé "vibe check passed" message, the old tourist
notice) are still defined there but currently unused — they used to power an
intermediate confirmation screen after each sub-step that's since been removed in favor
of navigating straight to `/appointment`; kept as copy-bank content rather than deleted.
