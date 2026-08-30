# Sidequest — gamified Instagram bio link (plan)

> Working name: **`apps/sidequest`** · Domain idea: `quest.ignas.lol` or similar short/funny domain.
> Status: PLANNED — not scaffolded yet.

## The idea

A one-screen, gamified link-in-bio site for Ignas's personal Instagram. The joke that
carries the whole site: **the visitor is an NPC who just approached the main character.**
The entire experience is an RPG encounter.

```
[Visitor taps link in bio]
        │
        ▼
  ENCOUNTER SCREEN
  "You have approached IGNAS."
  "He looks busy. Do you want something from him?"
        │
   ┌────┴─────┐
  [No]      [Yes]
   │           │
   ▼           ▼
GAME OVER    QUEST SELECT
(fun rude    "Choose your quest:"
 send-off)    ├── 🗺  SIDEQUEST   — hang out / waste time together
              ├── 🧠  SEEK COUNSEL — get advice
              └── 💘  ROMANCE ROUTE — go on a date
                    │
                    ▼
              QUEST ACCEPTED screen → funnels to DM / calendar / form
```

## Why it works (awwwards research, Feb 2026)

Patterns stolen from recent Site-of-the-Day winners:

| Site | What we steal |
|---|---|
| **Martin Laxenaire '25** (HM 2025) | Arcade/pixel energy, reward notifications, the "Don't want to play? Too bad!" attitude — exactly our "No" branch |
| **Stas Bondar '25** (SOTD) | Physics-based falling text, playful 404-style rejection animation |
| **Paris by Emily** (SOTD) | "Experience Selector" — hoverable branching quest cards |
| **Gucci: Mystery Unfolds** (SOTD) | Branching dialogue as the core mechanic |
| **Ten Years Away** (SOTD) | Cursor trail / mouse-reactive feel, everything feels alive |

Dominant trends to apply: bold display type (pixel or high-contrast), one loud accent
color on near-black, GSAP-driven text reveals (typewriter for dialogue), custom cursor
on desktop, mask/zoom transitions between "scenes", tiny synth SFX (muted by default).

## Screens

### 1. Encounter (landing)
- RPG dialogue box, bottom of screen, text types out letter-by-letter (skippable on tap
  like every JRPG ever).
- "You have approached **IGNAS**." → beat → "Do you want something from him?"
- Two buttons: **[ Yes ]** **[ No ]**. The No button may or may not dodge the cursor
  once before letting you click it (once only — annoying twice).
- Optional: pixel-art avatar of Ignas idling (2-frame breathing loop).

### 2. "No" branch — GAME OVER
- Screen glitches, dialogue box says something like:
  - "Then why are you here?" → "Blocked. (jk)" → **GAME OVER — YOU GAINED: nothing**
- Falling-letters physics animation (Stas Bondar style).
- After 2s a tiny "…wait, actually?" button fades in → loops back to quest select
  (everyone gets a second chance; also it's funnier).
- Shareable: the game-over screen should look good in a screenshot. That's the growth
  loop — people post it to their story.

### 3. Quest Select
- Three quest cards (character-select / quest-board energy), hover/tap tilts them,
  each with rarity tag and fake stats:
  - 🗺 **SIDEQUEST** — *"Spend time with Ignas."* Difficulty: ★☆☆ · Reward: memories, possibly food
  - 🧠 **SEEK COUNSEL** — *"Ask the oracle."* Difficulty: ★★☆ · Reward: advice of questionable quality
  - 💘 **ROMANCE ROUTE** — *"Roll for charisma."* Difficulty: ★★★ · Reward: ???
- Picking one plays a "QUEST ACCEPTED" banner + confetti/particles + SFX.

### 4. Quest Accepted (per-quest outcome)
Each quest ends in a real action so the site isn't just a joke:
- **Sidequest** → "Your quest log has been updated" → deep-link to IG DM with a
  pre-filled vibe ("I accepted the sidequest") or a date-picker.
- **Seek counsel** → a one-field form: "State your problem, adventurer." Submissions
  land in Supabase; Ignas answers in DMs. Optionally show a random fortune-cookie
  answer first ("The oracle is thinking… meanwhile: touch grass").
- **Romance route** → charisma check: fake d20 dice-roll animation. Any roll ≥ 1
  "passes" (rigged, that's the joke) → "You passed the vibe check" → DM link or a
  mini application form (favorite food, star sign, red flags — 3 questions max).

## Extra features (ranked, cut from bottom)

1. **Visitor counter as lore** — "You are adventurer #1,043 to approach Ignas." (one
   Supabase counter, trivially cheap, makes it feel alive)
2. **Quest stats page** (`/stats`) — public tally: how many chose No, sidequest,
   advice, date. Screenshot-bait: "94 people chose the romance route."
3. **Konami code / secret quest** — ↑↑↓↓←→←→BA unlocks a hidden 4th quest
   ("??? — Ignas owes you one favor. Non-negotiable terms."). Awwwards-core.
4. **Daily quest modifier** — banner: "2x XP weekend: date quest rewards doubled."
   Rotates from a hardcoded list by day-of-year. Zero backend.
5. **Idle dialogue** — 20s of inactivity: "…are you going to say something or just
   stand there?" (classic NPC behavior)
6. **Achievements toast** — "Achievement unlocked: Actually read the whole page."
7. **Sound toggle** — tiny retro SFX (typewriter blips, quest-accept jingle). Off by
   default, toggle in corner. Huge vibe multiplier for the people who turn it on.
8. **OG image per branch** — sharing `/gameover` or `/quest/romance` gives distinct
   funny link previews.

## Design direction

- **Format**: mobile-first and mobile-perfect — ~95% of traffic comes from the IG
  in-app browser. Desktop gets bonus toys (custom cursor, tilt), mobile gets taps
  and haptic-feeling springs. Test in the actual Instagram webview early.
- **Look**: near-black background, one loud accent (acid green or hot red), big pixel
  display font (e.g. "Press Start 2P" or a chunkier custom pixel font) + clean sans
  for body. CRT scanline/noise overlay at ~4% opacity.
- **Motion**: GSAP (or Motion One) — typewriter text, dialogue-box spring-in, card
  tilt, screen-shake on Game Over, dice roll. No WebGL needed; keep it < 200KB JS so
  it opens instantly inside Instagram's webview.
- **A11y/sanity**: `prefers-reduced-motion` fallback (instant text, no shake), real
  buttons, works with JS-light for the core funnel.

## Tech (fits monorepo conventions)

- `apps/sidequest` — Next.js (App Router) like siblings, static-first; Vercel free tier.
- Supabase (existing shared project): new schema `sidequest` (additive-only per
  `SCHEMA_RULES.md`) — tables: `visits` (counter), `quest_picks` (choice tally),
  `counsel_requests` (advice form), `romance_applications` (optional).
- No auth. Anonymous inserts via RLS-safe RPC or edge route with basic rate limiting.
- Analytics = the quest_picks table itself. That IS the product's stats page.

## Build order

1. Scaffold `apps/sidequest`, static encounter → yes/no → quest select → accepted
   screens with all copy and transitions (no backend). Ship this — it's already funny.
2. Supabase schema + visit counter + quest tally.
3. Advice form + DM deep links + OG images per route.
4. Extras: konami code, achievements, sound, stats page.

## Copy bank (draft, keep the tone)

- Landing: "You have approached IGNAS." / "He looks busy." / "Do you want something from him?"
- No: "Then why are you here?" → "GAME OVER" → "YOU GAINED: nothing"
- No-button hover (desktop, once): button dodges + "nice try"
- Quest accepted: "QUEST ACCEPTED. Ignas has been notified. He will respond within 1–3 business moods."
- Romance dice roll: "Rolling for charisma…" → "Natural 20. Suspicious, but okay."
- Idle: "…you can't just stand there, this isn't a museum."
