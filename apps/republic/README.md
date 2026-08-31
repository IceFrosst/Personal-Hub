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
          → per-visa sub-step (1-field form / fiancé interview — sidequest has none) →
            straight to CONSULATE APPOINTMENT, no confirmation screen in between
          → CONSULATE APPOINTMENT (time-slot picker, real scarcity)
          → IDENTITY VERIFICATION (selfie via file input, final step; route stays /biometric)
          → PROCESSING (progress bar stutters at 99%)
          → VISA ISSUED (canvas-composited visa sticker, download, DM handoff)
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
appointment picker — there's no "continue" confirmation screen in between anymore.

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

## The progress card

`components/DocumentProgress.tsx`, shown via `<PageShell showProgress>`. A faithful DOM
replica of the final `/visa-issued` canvas sticker, shrunk down: a navy double-line
border on paper, a small "DICTATORSHIP OF IGNAS" header, a SQUARE photo box (filled with
the sticker's own placeholder treatment until biometrics are captured, then the
persisted selfie thumbnail) and a barcode-mini strip along the bottom. The two-column
field grid replicates every field the sticker itself has, in the sticker's own order —
NAME + PASSPORT №, VISA TYPE + SERIAL №, REFERENCE № (full-width), ISSUED + VALID, then
CONDITIONS (full-width). Below that grid sit up to two further one-line addenda, each
set off with its own dashed divider (not sticker fields, so deliberately kept outside
the replicated grid): the confirmed APPOINTMENT slot, and — once the chosen visa's
sub-step has actually collected something — its content (the consultation matter, the
business pitch, the special-purpose sworn statement, or the fiancé interview answers,
joined into one compact line). Tourist has no sub-step, so that second addendum never
appears for it; every other addendum/field only renders once its underlying value
exists, never as an empty placeholder row. Unfilled fields render as a blank ruled line;
a field (including the photo and each addendum) animates once, the moment it's first
filled, via a small "field-fill" pop — but only once ever per browser session
(`lib/formProgress.ts` tracks which field keys have already played the animation in
`sessionStorage`, separate from the funnel's own state, so refreshing mid-funnel never
replays it for something that was already on the form). Long values (especially the
fiancé addendum, which joins three answers) are CSS-truncated (`truncate`, plus a
`title` attribute with the full text) rather than sliced in code, so nothing is ever
discarded from context state — only the on-screen rendering is compacted.
`prefers-reduced-motion` collapses the animation to a single instant frame via the same
global rule every other animation in this app uses — no special-casing needed.

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

## Stack

- Next.js 15 (App Router) + TypeScript, mobile-first (built/verified at 390px, and the
  landing specifically at 390×660 down to 390×844 with zero vertical scroll)
- Tailwind CSS with a dedicated paper/stamp design system (see `tailwind.config.ts` and
  `app/globals.css`) — off-white paper, navy ink, stamp red, approval green
- Fonts via `next/font/google`: IBM Plex Mono (body/forms) + Special Elite (stamps)
- All CSS/SVG animation (stamp slam, screen shake, typewriter reveal, paper-slide,
  passport-card field-fill, the hidden-bribe bob/glow/shimmer) — no WebGL, no animation
  library
- Tiny WebAudio-generated blips, on by default for everyone (no toggle) — every call
  site is already inside a click/tap/change handler, which is what a browser's autoplay
  policy actually needs (one prior user gesture on the page); `lib/sound.ts` also
  best-effort `resume()`s the shared `AudioContext` if it started suspended
- Client-side canvas compositing for the visa sticker (photo + APPROVED stamp + serial +
  reference code) — no server round-trip
- Custom checkbox (`components/Checkbox.tsx`): the real `<input type="checkbox">` stays
  functional but invisible (`opacity-0`); the box + check mark are drawn by sibling
  elements, so it never depends on native checkbox rendering or `accent-color` support.
  Use this for any future checkbox — a bare `<input type="checkbox">` combined with this
  app's global `appearance: none` reset is exactly what made the sworn-statement
  checkbox on `/visa/special` invisible in production.
- `lib/api.ts` — typed backend stubs (`recordApplication`, `recordAppointment`,
  `recordBribe`, `getAvailableSlots`, `uploadPhoto`) that always work off localStorage
  and best-effort (try/catch-swallowed) POST to Supabase only if
  `NEXT_PUBLIC_SUPABASE_URL` is set — no `applications`/`appointments`/`bribes` tables
  exist yet, so this is forward-compatible scaffolding, not a live integration.
  `getApplicantNumber`, specifically, is a real (if narrow) integration already: it
  calls the `republic.next_applicant_number()` Supabase RPC (see `supabase/migrations/`)
  to hand out a real global sequential number, at most once per browser/device — see
  "Applicant number" above.
- No bot defenses (no Turnstile, no honeypot) and no server persistence beyond the
  best-effort stub above — this is a client-side joke funnel, not a form product

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
