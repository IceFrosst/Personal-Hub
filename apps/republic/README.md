# Republic of Ignas — Border Control

A gamified, deadpan-bureaucracy link-in-bio site for Ignas's personal Instagram. The
visitor is a traveler applying to enter the fictional "Republic of Ignas"; every social
interaction (hang out, ask advice, pitch a business idea, ask him out) is reframed as a
visa application. The joke only works if the site takes itself 100% seriously.

Full concept doc: `../../SIDEQUEST_PLAN.md` (root of the monorepo).

## The funnel

```
ENTRY DECLARATION (name + "do you have something to declare?")
  NO  → ENTRY DENIED (stamp slam, rotating reason, "file an appeal" loops back)
  YES → VISA SELECTION (5 visas)
          → per-visa sub-step (consultation form / fiancé interview / business
            pitch / sworn statement — tourist skips)
          → CONSULATE APPOINTMENT (time-slot picker, real scarcity)
          → BIOMETRIC VERIFICATION (selfie via file input, final step)
          → PROCESSING (progress bar stutters at 99%)
          → VISA ISSUED (canvas-composited visa sticker, download, DM handoff)
```

Every screen also has its own route (`/denied`, `/visa`, `/visa/[type]`, `/appointment`,
`/biometric`, `/processing`, `/visa-issued`, `/statistics`, `/duty-free`, `/terms`) so
screenshots and shares link somewhere sensible, but the funnel *state* (name, visa
choice, answers, slot, selfie, reference code) lives in one React context so it survives
client-side navigation between them — reset only happens by landing back on `/`.

## Identity / "the DM is the passport"

There's no login. The final step of *every* visa is a selfie (composited into the
downloadable visa sticker), and the last screen's "PROCEED TO CONSULATE" button copies a
reference line (`VISA TYPE · RIG-XXXX · slot`) to the clipboard and opens
`https://ig.me/m/ignas_simanavicius` — Instagram's `ig.me` deep links can't pre-fill
message text, so the flow is copy → open thread → paste, with an on-screen instruction.
Ignas looks up the reference code to see what was submitted and confirms/declines by DM.

## Stack

- Next.js 15 (App Router) + TypeScript, mobile-first (built/verified at 390px)
- Tailwind CSS with a dedicated paper/stamp design system (see `tailwind.config.ts` and
  `app/globals.css`) — off-white paper, navy ink, stamp red, approval green
- Fonts via `next/font/google`: IBM Plex Mono (body/forms) + Special Elite (stamps)
- All CSS/SVG animation (stamp slam, screen shake, typewriter reveal, paper-slide) — no
  WebGL, no animation library
- Tiny WebAudio-generated blips for the "☐ I consent to noise" toggle — no audio assets
- Client-side canvas compositing for the visa sticker (photo + APPROVED stamp + serial +
  reference code) — no server round-trip
- `lib/api.ts` — typed backend stubs (`recordApplication`, `recordAppointment`,
  `recordBribe`, `getApplicantNumber`, `getAvailableSlots`, `uploadPhoto`) that always
  work off localStorage and best-effort (try/catch-swallowed) POST to Supabase only if
  `NEXT_PUBLIC_SUPABASE_URL` is set — no schema/migrations exist yet, so this is
  forward-compatible scaffolding, not a live integration
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
in-app browser.

## All copy lives in one place

`lib/content.ts` — visa definitions, denial reasons, gag lines, interview questions,
statistics placeholders, duty-free stock, terms paragraphs (including the paragraph 7
easter egg), the DM handle/deep link, and the reference-line format. Edit copy there,
not scattered across components.
