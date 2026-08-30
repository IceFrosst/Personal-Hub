# Republic of Ignas — gamified Instagram bio link (plan)

> Working name: **`apps/republic`** (or `apps/border-control`) · Domain idea: `republicofignas.com`,
> `visa.ignas.lol`, or similar.
> Status: PLANNED — concept locked (border-control theme), not scaffolded yet.
> Mockups: `docs/mockups/sidequest-border-*.jpg`

## The idea

A one-screen, gamified link-in-bio site for Ignas's personal Instagram, themed as
**immigration/border control for the Republic of Ignas**. The visitor is a traveler
trying to enter; every social interaction is a visa application. Deadpan bureaucracy
is the joke engine — the site takes itself 100% seriously, which is what makes it funny.

```
[Visitor taps link in bio]
        │
        ▼
  ENTRY DECLARATION (landing)
  "REPUBLIC OF IGNAS — BORDER CONTROL"
  "Do you have something to declare?"
        │
   ┌────┴─────┐
  [NO]      [YES]
   │           │
   ▼           ▼
ENTRY DENIED   VISA SELECTION
(red stamp     "Select visa type:"
 slam +         ├── 🗺  TOURIST VISA        — sidequest / spend time together
 appeal         ├── 📋  CONSULTATION PERMIT — seek advice
 button)        ├── 💍  FIANCÉ VISA         — go on a date (HIGH RISK stamp)
                └── 📎  SPECIAL PURPOSE     — "other" / free-text sworn statement
                      │
                      ▼
               PROCESSING… → APPROVED
               (visa sticker + stamp slam)
                      │
                      ▼
               CONSULATE APPOINTMENT (time slot picker)
                      │
                      ▼
               APPOINTMENT TICKET → DM deep link with visa + slot
```

## Screens

### 1. Entry Declaration (landing)
- Off-white paper background, document texture, monospaced/typewriter type.
- Header: coat of arms (cheap gag: a crest featuring e.g. a phone, a fork, a heart),
  "REPUBLIC OF IGNAS", "FORM 1G-NAS — ENTRY DECLARATION".
- Passport-control beep + text stamps in line by line (typewriter reveal).
- Question: **"DO YOU HAVE SOMETHING TO DECLARE?"** → [YES] [NO]
- Details that sell it: form barcode, "PRIORITY" stamp slightly rotated, serial
  number that's actually the visitor counter ("APPLICANT № 001,043").

### 2. "NO" branch — ENTRY DENIED
- Screen shakes, giant red **ENTRY DENIED** stamp slams down (scale-in + ink splatter,
  haptic-feeling spring).
- Typewriter follow-up: "REASON: NOTHING TO DECLARE." / "STATUS: WASTING OFFICER'S TIME."
- Fake case number + date. Red fingerprint smudge.
- After 2s, small link fades in: **"FILE AN APPEAL (wait, actually…)"** → loops to
  visa selection. Everyone gets a second chance; appeals are very on-theme.
- This screen must look perfect in a screenshot — it's the growth loop.

### 3. Visa Selection
- Three document-style cards (visa stickers with serial numbers, barcodes, fee lines).
  Card-flip or slide-in animation; tap tilts them like inspecting a document.
  - 🗺 **TOURIST VISA** — *"Sidequest: spend time together."*
    Duration: one afternoon · Fee: waived · Processing: immediate
  - 📋 **CONSULTATION PERMIT** — *"Seek advice."*
    Processing: 1–3 business moods · Advice quality: not guaranteed
  - 💍 **FIANCÉ VISA** — *"One (1) date with Ignas."*
    Requirements: vibe check · Fee: market price · Red **HIGH RISK** stamp overlapping
  - 📎 **SPECIAL PURPOSE VISA** — *"Purpose of visit: other. Elaborate. This is being
    recorded."* Free-text sworn statement with fake checkbox: "☑ I declare under
    penalty of mild disappointment that the above is true." Random reply variant:
    "YOUR STATEMENT HAS BEEN FORWARDED TO THE MINISTER. (he will read it on the
    toilet)". Secretly the best feature — free-text from randos is where the gold is.
- Selecting one → brief "PROCESSING APPLICATION…" screen with a fake progress bar
  that stutters at 99% (bureaucracy), stamp sound, then:

### 4. APPROVED (per-visa outcome)
- Green **APPROVED** stamp slams onto a rendered visa sticker with the visitor's
  details ("PHOTO: pending", "VALID: until further notice", "CONDITIONS: bring snacks").
- Each visa funnels into a real action:
  - **Tourist Visa** → consulate appointment booking (below) → DM deep link.
  - **Consultation Permit** → one-field official form: "STATE YOUR MATTER, APPLICANT."
    Submissions land in Supabase; Ignas answers in DMs. Bonus: an instant automated
    "preliminary ruling" from a hardcoded list ("Preliminary ruling: you already know
    the answer. Full verdict via DM.").
  - **Fiancé Visa** → **the vibe check interview**: 3 rapid multiple-choice questions
    styled as customs questions ("Purpose of visit?", "Are you carrying any red flags?",
    "Favorite food — answer carefully, this is binding."). Always ends APPROVED
    (rigged) → appointment booking → DM link. Answers stored, so Ignas sees them
    before replying.
  - **Special Purpose Visa** → statement stored → appointment booking → DM link.

### 5. Consulate Appointment (time slot picker)
- After approval, applicant must **schedule an appointment with the Consulate** —
  a calendar styled as a government booking system (deliberately bureaucratic,
  actually smooth).
- Slot labels carry the joke:
  - "09:00 — CANCELLED"
  - "11:30 — reserved for someone more important"
  - "14:00 — AVAILABLE"
  - "17:00 — the officer is tired but present"
  - Fiancé visa specials: "19:00 — dinner hours (recommended)",
    "23:00 — bold choice. noted in your file."
- Some slots are "FULLY BOOKED" from day one (fake scarcity, funnier).
- Confirmation renders an **appointment ticket**: "APPOINTMENT CONFIRMED.
  BRING: yourself, snacks. DO NOT BRING: the vibe you had at entry."
- The DM deep link includes visa type + chosen slot ("Fiancé visa approved,
  appointment requested: Fri 19:00"). Picks stored in Supabase; Ignas confirms or
  declines via DM — he is the entire government.

## Extra features (ranked, cut from bottom)

1. **Applicant counter as lore** — "APPLICANT № 001,043" on the landing form. One
   Supabase counter, makes it feel alive.
2. **Public `/statistics` page** — official government-statistics table: entries
   denied, tourist visas issued, fiancé visa applications, appeals filed. Deadpan
   numbers in a bureaucratic table = screenshot bait.
3. **Passport stamps as session memory** — localStorage passport page; each visit /
   action adds a stamp. Return visitors see "WELCOME BACK. YOUR FILE HAS BEEN FLAGGED."
4. **Random secondary screening** — ~10% of "YES" clicks get pulled aside first:
   "YOU HAVE BEEN SELECTED FOR ADDITIONAL SCREENING" + one absurd question before
   proceeding. Random reward schedule = people re-visit to get it.
5. **Konami/secret** — typing "diplomat" (or 5 taps on the coat of arms) unlocks the
   **DIPLOMATIC PASSPORT**: skips all queues, one favor from Ignas, non-negotiable.
6. **Customs declaration checklist** — on landing, fake declaration checkboxes:
   "Are you carrying: ☐ ulterior motives ☐ snacks ☐ feelings ☐ a business proposal".
   Does nothing except get stored + shown to Ignas in DM context. Checking "feelings"
   auto-recommends the Fiancé visa.
7. **Visa rejection lottery** — ~5% of legit applications get "APPLICATION DENIED.
   REASON: quota. APPEAL? [YES]" → appeal always instantly succeeds: "APPEAL GRANTED.
   THE MINISTRY ADMIRES PERSISTENCE." Fake rejection → win feels great, doubles the joke.
8. **Officer mood indicator** — header widget "CURRENT OFFICER MOOD: ●●○○○ (proceed
   with caution)", rotates by hour; bad-mood hours make the copy slightly ruder.
   Gives people a reason to revisit.
9. **Bribe button** — tiny "💵 offer bribe" button. Click: "BRIBE ACCEPTED. IT CHANGES
   NOTHING. THE MINISTRY THANKS YOU." Increments a public "bribes attempted" stat.
10. **Interpol check** — during processing: "CHECKING INTERPOL DATABASE… CHECKING
    FOLLOWING/FOLLOWERS RATIO… CHECKING IF YOU LIKED HIS LAST POST…" →
    "RESULT: concerning, but admissible."
11. **Duty-free shop** — fake /duty-free page: "Ignas's attention — 15 min — SOLD OUT",
    "one (1) good morning text — restocked weekly". Everything sold out or
    "pay at consulate".
12. **T&C easter egg** — real terms link; paragraph 7: "if you actually read this,
    screenshot it and send it for an instant diplomatic upgrade."
13. **Deportation on idle** — 60s inactive: "APPLICANT DEPORTED DUE TO INACTIVITY" →
    back to landing; DEPORTED stamp added to localStorage passport.
14. **Rotating denial reasons** — the No branch cycles: "vibes insufficient",
    "the officer simply didn't feel like it", etc. Replayable = shareable variety.
15. **Loyalty program** — 3rd visit: "FREQUENT APPLICANT STATUS GRANTED. PERKS: none.
    RECOGNITION: eternal."
6. **Official sounds** — stamp thunk, typewriter keys, passport-control beep. Off by
   default, toggle styled as "☐ I consent to noise".
7. **OG images per route** — sharing `/denied` or `/visa/fiance` gives distinct funny
   link previews (the DENIED stamp as an OG image is elite).
8. **Seasonal decrees** — hardcoded banner rotation: "NOTICE: fiancé visa quota
   reached for February. Applications remain open (exceptions considered)."

## Design system

- **Look**: off-white paper (#f4f0e8) with subtle grain, navy ink (#1a2a4a), stamp red
  (#c0392b), approval green (#2e7d32). Everything looks printed, stamped, or typed.
- **Type**: monospace/typewriter for form fields (e.g. IBM Plex Mono, Special Elite for
  stamps), a condensed grotesque for headers. Distressed stamp lettering via SVG + ink
  texture.
- **Motion**: stamp slams (scale 3→1 + rotate + screen shake), typewriter text,
  paper-slide transitions between screens (documents shuffled on a desk), progress bar
  stutter. GSAP or Motion One; all CSS/SVG — **no WebGL, no canvas**. Tiny bundle.
- **Mobile-first**: built for the Instagram in-app webview. Desktop bonus: cursor
  becomes a stamp; clicking anywhere leaves a faint ink mark.
- **A11y**: `prefers-reduced-motion` = no shake, instant text. Real buttons, semantic
  form markup (it's literally a form theme — a11y comes almost free).

## Why this wins (vs. other concepts explored)

- Deadpan bureaucracy scales to every touchpoint: errors ("FORM MISPLACED. REF: 404"),
  loading ("YOUR APPLICATION IS IN A QUEUE"), even the footer ("© Ministry of Interior,
  Republic of Ignas. Unauthorized fun prohibited.").
- The paper/stamp aesthetic is typography-driven → cheap to build extremely well in
  CSS; no 3D/WebGL needed to look awwwards-tier.
- DENIED/APPROVED stamps are inherently shareable artifacts.
- Rejected alternatives kept for reference: RPG encounter (mockups `sidequest-encounter/
  quest-select`), game show (`sidequest-gameshow`), tarot (`sidequest-tarot`).

## Tech (fits monorepo conventions)

- `apps/republic` — Next.js (App Router) like siblings, static-first; Vercel free tier.
- Supabase (existing shared project): new schema `republic` (additive-only per
  `SCHEMA_RULES.md`) — tables: `applicants` (counter), `applications` (visa picks +
  denials + appeals + declaration checkboxes), `consultations` (advice form),
  `interviews` (fiancé Q&A), `statements` (special-purpose free text),
  `appointments` (visa type + requested slot + status).
- No auth. Anonymous inserts via edge route with basic rate limiting.
- Analytics = the applications table. That IS the `/statistics` page.

## Build order

1. Scaffold `apps/republic`: full static funnel — declaration → denied/appeal →
   visa select → processing → approved, with all copy, stamps, and transitions.
   Ship it; it's already funny with zero backend.
2. Supabase schema + applicant counter + application tally.
3. Appointment booking + consultation form + fiancé interview + special-purpose
   statement + DM deep links + per-route OG images.
4. Extras: passport stamps, secondary screening, rejection lottery, bribe button,
   diplomatic passport, sounds, `/statistics`.

## Copy bank (draft — deadpan is the law)

- Landing: "REPUBLIC OF IGNAS — BORDER CONTROL" / "FORM 1G-NAS" /
  "DO YOU HAVE SOMETHING TO DECLARE?"
- No: "ENTRY DENIED" / "REASON: NOTHING TO DECLARE." / "STATUS: WASTING OFFICER'S TIME."
- Appeal link: "FILE AN APPEAL (wait, actually…)"
- Processing: "PROCESSING APPLICATION… DO NOT REFRESH. THE MINISTRY SEES EVERYTHING."
- Approved: "VISA GRANTED. VALID: until further notice. CONDITIONS: bring snacks."
- Consultation auto-reply: "PRELIMINARY RULING: you already know the answer.
  FULL VERDICT: via DM, 1–3 business moods."
- Fiancé interview intro: "ROUTINE QUESTIONS. ANSWER HONESTLY. DISHONESTY IS CUTE BUT ILLEGAL."
- Idle 20s: "APPLICANT. THE QUEUE IS MOVING. ARE YOU?"
- Footer: "© Ministry of Interior, Republic of Ignas. Unauthorized fun prohibited."
- 404: "FORM MISPLACED. THE MINISTRY APOLOGIZES FOR NOTHING. REF: 404"
