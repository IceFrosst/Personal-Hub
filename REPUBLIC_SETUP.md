# Republic of Ignas — launch checklist (what Ignas must provide/decide)

> Companion to `SIDEQUEST_PLAN.md`. Code ships without these (stubs/localStorage),
> but full implementation needs every box below.

## 1. Identity & links (blocking for launch)
- [ ] **Exact Instagram handle** — used for the `ig.me/m/<handle>` consulate deep link.
      (Assumed `icefrosst` so far — confirm.)
- [ ] Note: `ig.me` links open the DM thread but **cannot prefill text** reliably.
      Fallback implemented: the site copies "FIANCÉ VISA RIG-4F7K — Fri 19:00" to the
      clipboard and instructs the applicant to paste. Confirm you're OK with this UX.

## 2. Domain & hosting (blocking for launch)
- [ ] **Domain decision**: buy `republicofignas.com` / use a subdomain of a domain you
      own / free `*.vercel.app` for v1. (IG bio links work fine with any of these.)
- [ ] **Vercel project**: create project → point at `IceFrosst/Personal-Hub` →
      Root Directory `apps/republic` → Ignored Build Step `npx turbo-ignore`.
      (I can do this via CLI if you log in: `vercel login`.)

## 3. Supabase (blocking for backend phase)
- [ ] Confirm using the **existing shared Supabase project** (per monorepo convention).
- [ ] Provide env vars (Vercel + `.env.local`):
      - `NEXT_PUBLIC_SUPABASE_URL`
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
      - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- [ ] Approve creating schema `republic` (additive-only per `SCHEMA_RULES.md`):
      tables `applicants`, `applications`, `consultations`, `pitches`, `interviews`,
      `statements`, `appointments`; private Storage bucket `republic-biometrics`
      with 72h auto-purge for unverified photos.

## 4. Bot defense (optional but recommended)
- [ ] **Cloudflare Turnstile** site key + secret key (free — takes 2 min at
      dash.cloudflare.com → Turnstile). Styled as "BIOMETRIC SCAN IN PROGRESS".

## 5. Content decisions (quick answers needed)
- [ ] **Language**: English only, or English + Lithuanian easter eggs?
- [ ] **Appointment slots**: fully fictional times, or loosely match your real
      availability (e.g. evenings + weekends marked AVAILABLE)?
- [ ] **Officer mood schedule**: default rotation by hour OK, or map it to your
      actual schedule (e.g. bad mood before noon)?
- [ ] **Coat of arms**: CSS/SVG crest (fast) or a generated/designed emblem image?
- [ ] **Your display name** on documents: "IGNAS" everywhere, or full name on the
      visa sticker for extra officialness?
- [ ] **Reference code prefix**: `RIG-` (Republic of IGnas) OK?

## 6. Ops (you, ongoing)
- [ ] Update Instagram bio with the link once live.
- [ ] DM workflow: applicants DM their reference code; you look it up on the
      (to-be-built) private `/consulate` lookup page. Decide: simple password-protected
      page OK? Provide a passphrase for it.
- [ ] Decide who "confirms" appointments — you reply in DM manually (recommended v1).

## 7. Nice-to-have later
- [ ] OG share images per route (can generate with next/og — no action needed, just
      approve the look later).
- [ ] Analytics beyond the applications table (probably unnecessary — the DB is the
      analytics).
- [ ] Custom pixel/emblem favicon.
