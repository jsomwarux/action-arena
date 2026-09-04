# Action Arena — App Store Screenshots Plan (5-Shot Carousel)

> **Regenerated 2026-06-03.** Supersedes the May 28 "after simulator review" draft.
> Sources: `marketing/marketing/INTAKE.md`, `COMPONENTS.md`, `TOKENS.md`.
> Captures audited: **repo-root `screenshots/`** (9 PNGs, dated Jun 2) — see Part 2 for the location note.

## Read this first

- **Capture location:** Your raw captures are **not** at `marketing/assets/screenshots/raw/` — that directory does not exist. They are at the repo root in **`screenshots/`** (9 PNGs). I audited those.
- **Prior plan replaced:** A `screenshots-plan.md` from May 28 lived here; this file replaces it. The old fixture names (`Sunday Card League`, `Lineup Builder League`, `App Store Screenshot League`) no longer match the captures, which use `Primetime Players` and `Sunday Night Pick Club`. The May 28 seed script (`scripts/seed-app-store-screenshot-fixtures.sql`) may be stale — confirm before re-seeding.
- **Good news:** **All 5 slots already have a usable capture.** The gaps are cohesion/polish (league + week consistency, status bar), not missing shots.
- **Do not ship:** `season_pass.png` and `season_pass_iap.png` — both show a `Loading` placeholder in the hero and are paywall screens. Excluded from the set (rationale in Part 2).

## Copy framework applied to every headline

Per the Marketing Playbook Appendix B direct-response framework and INTAKE.md compliance:

- **Font:** Bebas Neue, all-caps, condensed (broadcast feel). Headlines are 3–8 words and written to read well set in caps.
- **Voice:** the "smart friend who figured something out" — conversational, insider, a little trash-talk.
- **Specificity over abstraction:** concrete nouns and numbers (`100 coins`, `five picks`, `your league`) over vague claims (`compete with friends`).
- **Standalone test:** every headline is written so a reader who sees *only the headline* still gets the value prop. A one-line "Standalone read" is given for each.
- **Banned — hype:** revolutionary, game-changing, next-level, ultimate.
- **Banned — gambling (INTAKE 5.3):** bet, wager, sportsbook, odds — and the claim words win money, cash out, payout, odds boost. Product UI may show `Parlay`/`Teaser`/`Reward`/American-odds numbers (it's gameplay), but **no overlay headline references them.**

---

# PART 1 — Narrative Arc

**The story in one line:** *This is the prediction league your group chat runs every Sunday (1) → here's the five-pick card you build (2) → here's where you rank against your friends (3) → here's you beating them and owning the week (4) → and the only thing on the line is who's best in your league, all season (5).*

The arc is deliberately **social-first, compliance-last**: it leads with the friend-group hook (the one thing sportsbooks can't claim) and closes on Slot 5, where the in-phone disclosure capture (not the overlay headline) carries the compliance content, so the "$100 budget / +coins / Parlay" numbers a reviewer sees in shots 1–4 are already re-framed as a fantasy game by the time they land on shot 5.

---

### Slot 1 — Hook · "What is this, and why stop scrolling"

- **Component:** Bet Board (Pick Board) screen — `app/(app)/(tabs)/bet-board.tsx` *(COMPONENTS.md #2, High — "core gameplay surface… best surface for showing the build-your-card loop")*
- **Capture:** `screenshots/pick_board.png`
- **Headline (primary):** **NFL PICKS WITH YOUR GROUP CHAT**
  - Alt A (commissioner/Marcus frame): **RUN A PRIVATE NFL PICK LEAGUE**
  - Alt B (ritual/curiosity): **YOUR GROUP CHAT'S NEW SUNDAY RITUAL**
- **Standalone read:** a reader sees only this and knows it's *NFL predictions you play with your friends* — the exact differentiator vs. a solo sportsbook.
- **Why it's the hook:** the Pick Board is the densest "this is the product" frame — pick-type toggles (Straight / Parlay / Teaser), an active-league chip, the `20 / 100 coins` budget, and a real game card. The TOKENS semantic palette (amber=Parlay, cyan=Teaser, electric-green=active) does the "fantasy game, not sportsbook" arguing for free. Lead on the **social** angle in the overlay so the numbers underneath read as *game*, not *book*.

### Slot 2 — Mechanic · "What you actually do"

- **Component:** Bet Board (Pick Board) screen, expanded Lineup sheet state — `app/(app)/(tabs)/bet-board.tsx` *(COMPONENTS.md #2, High)*. Supporting: **AnimatedNumber** — `components/ui/animated-number.tsx` (the coins/Reward tickers).
- **Capture:** `screenshots/lineup.png`
- **Headline (primary):** **STRAIGHT. PARLAY. TEASER. LOCK.**
  - Alt A: **$100. FOUR PICK TYPES. ONE LOCK.**
  - Alt B: **FOUR PICK TYPES. ONE WEEKLY BUDGET.**
- **Headline rationale:** Straight, Parlay, and Teaser are the three pick-type toggles on the Bet Board (`bet-board.tsx`); Lock is the Lock-of-the-Week 1.5× multiplier each member assigns to exactly one pick (shown in the lineup as "Pick of the Week 1.5×"). Together they are the four core terms of pick vocabulary a player meets on day one (INTAKE.md "Key features"). Pure mechanic, no fabricated specifics — the line is a literal label of the on-screen vocabulary `lineup.png` already shows, which pairs it tightly with the capture. Bebas Neue period-rhythm executes at App Store thumbnail size and teaches the in-app vocabulary users hit on download. *(Precise mechanic: three pick types **plus** the Lock multiplier — consistent with the Slot 2 audit below; Alt A/B compress this to "four pick types" for headline punch.)*
- **Standalone read:** Passes. A reader who sees only **STRAIGHT. PARLAY. TEASER. LOCK.** gets that this is a *strategic, multi-format picks game* — four distinct ways to play a pick, not a one-tap guess — which is INTAKE.md's "sportsbook-style strategy, no gambling" differentiator stated as pure mechanic. The coins-not-dollars compliance content is intentionally carried later by the in-phone capture (the Slot 5 disclosure screen + the `100 coins` chip), per the social-first, compliance-last arc.
- **Why it's the mechanic shot:** the assembled lineup shows Straight + a **gold Pick-of-the-Week Parlay** (the 1.5× Lock) + a Teaser peeking in — three pick types and the signature multiplier in one frame. It reads faster and sells more range than a column of straight picks. `5/5 picks · 100 coins · Remaining 0` shows the budget fully deployed = strategy, not luck.

### Slot 3 — Social / Proof · "Your friends, ranked"

- **Component:** Leaderboard screen — `app/(app)/(tabs)/leaderboard.tsx` *(COMPONENTS.md, Medium — "the I'm #1 in my league bragging-rights screenshot")*. Alternative: League Detail (League HQ) — `app/(app)/(tabs)/leagues/[leagueId].tsx`.
- **Capture:** `screenshots/leaderboard.png` *(alt: `screenshots/matchup.png`, which is actually the League HQ screen — see Part 2)*
- **Headline (primary):** **SETTLE WHO'S BEST IN YOUR LEAGUE**
  - Alt A: **FIRST PLACE IS A GROUP-CHAT FLEX**
  - Alt B: **CLIMB THE LADDER EVERY SUNDAY**
- **Standalone read:** the reader gets that this is a *multiplayer, season-long ranking among your friends* — the perpetual "who actually knows ball" argument, settled.
- **Why it's the proof shot:** real names and records (`Review Rebels 3-0 · Jordan Ellis`, `Maya Thompson`, `Chris Walker`), a podium, the `You` badge on first place, and ↑/↓ weekly movement. Virtual profit is shown as coins (`+193`, `+178`, `+108`), which keeps it bragging-rights, not money. This is the screen that answers Marcus's "will my friends actually play?" objection.

### Slot 4 — Reward / Outcome · "You won, now brag"

- **Component:** **WinCelebration** — `components/cosmetics/index.tsx` *(COMPONENTS.md #1, High — "purpose-built emotional payoff")* firing on the **Matchup Detail screen** — `app/(app)/(tabs)/matchups/[matchupId].tsx` *(COMPONENTS.md #3, High — "pairs the most emotional moment with side-by-side numeric drama")*.
- **Capture:** `screenshots/matchup_result.png`
- **Headline (primary):** **WIN THE WEEK. REMIND THEM FOREVER.**
  - Alt A: **BEAT YOUR FRIEND, TAKE THE WEEK**
  - Alt B: **THE WIN THAT ENDS THE ARGUMENT**
- **Standalone read:** the reader gets the payoff — *you beat your friend this week and you'll never let them forget it.* Pure bragging-rights, zero money language.
- **Why it's the outcome shot:** this is the single highest-value asset in the app — the `YOU WON` gold pill, confetti mid-fire, and the head-to-head `+56` vs `+47` "won by 9 coins" profit swing side by side. electric-green for the win, coral-red for the opponent's loss (TOKENS), all in coins. This is also the frame the App Store **preview video** should climax on.

### Slot 5 — Brand / Compliance · "All rivalry, on the record"

- **Component:** Disclosure screen ("How Action Arena Works") — `app/(app)/disclosure.tsx`. *(Not in COMPONENTS.md's marketable list — it's the compliance surface, and it carries the **Action Arena wordmark**.)* Brand chrome from TOKENS (electric-green wordmark, shield, gold accents).
- **Capture (locked):** `screenshots/disclosure.png` — raw capture of the in-app disclosure screen (`disclosure.tsx`), locking this surface per the earlier audit recommendation. *(To be captured; supersedes the Jun-2 `how_it_works.png`, which is the same screen under the prior filename.)*
- **Headline (primary):** **YOUR LEAGUE. YOUR LOCKS. YOUR BRAGGING RIGHTS.**
  - Alt A: **ALL RIVALRY. ALL SEASON.**
  - Alt B: **JUST COINS, PICKS, AND BRAGGING RIGHTS**
- **Composition (Step 3.2 marketing composition · Claude Design):** Minimal — the disclosure screen self-brands, so the marketing comp only adds:
  - The **YOUR LEAGUE. YOUR LOCKS. YOUR BRAGGING RIGHTS.** headline overlay.
  - The gold radial-gradient background per the playbook spec.
  - **No synthetic wordmark, tagline, or footer.** The in-phone capture already supplies the **ACTION ARENA** wordmark (white "ACTION" over green "ARENA", with the green "FREE · FANTASY · PICKS" eyebrow), the shield-check, the "no monetary value / No real money / no redemption" disclosure body, and the `VIRTUAL COINS` · `NO CASH OUT` chips — layering a second wordmark or tagline would double the branding.
- **Standalone read:** the headline delivers the brand promise (your league, your locks, your bragging rights), while the in-phone disclosure capture underneath defuses the #1 objection for Priya and Tyler: *this is competitive, but it is not gambling.*
- **Why it closes the arc:** Apple 5.3 review and the gambling-averse personas both need the not-gambling reassurance available in the read, and the Slot 5 in-phone disclosure capture supplies it. Ending the carousel on that capture retroactively re-codes the coins/Parlay/odds-numbers in shots 1–4 as a fantasy game. This capture also fixes the old plan's complaint (the previous disclosure frame "had no wordmark and empty space at top") — this one has the wordmark and is well composed.

---

### Slot map (quick reference)

| # | Slot | Screen / Component (COMPONENTS.md) | Capture | Primary headline |
|---|------|-----------------------------------|---------|------------------|
| 1 | Hook | Bet Board / Pick Board — `bet-board.tsx` (#2) | `pick_board.png` | NFL PICKS WITH YOUR GROUP CHAT |
| 2 | Mechanic | Bet Board, Lineup sheet — `bet-board.tsx` (#2) | `lineup.png` | STRAIGHT. PARLAY. TEASER. LOCK. |
| 3 | Social/Proof | Leaderboard — `leaderboard.tsx` | `leaderboard.png` | SETTLE WHO'S BEST IN YOUR LEAGUE |
| 4 | Reward/Outcome | WinCelebration on Matchup Detail — `matchups/[id].tsx` (#1+#3) | `matchup_result.png` | WIN THE WEEK. REMIND THEM FOREVER. |
| 5 | Brand/Compliance | Disclosure — `disclosure.tsx` (self-branded) | `disclosure.png` | YOUR LEAGUE. YOUR LOCKS. YOUR BRAGGING RIGHTS. |

---

# PART 2 — Capture Audit

## Where the captures actually live

The path in the brief, `marketing/assets/screenshots/raw/`, **does not exist** (neither does `marketing/marketing/assets/screenshots/`; `marketing/marketing/assets/` contains only `og-image.png`). The 9 raw captures are in the **repo root: `screenshots/`**, dated Jun 2 2026. Recommend you either move them to `marketing/marketing/assets/screenshots/raw/` to match the intended structure, or update the brief's path. (Note the marketing folder is itself double-nested: `marketing/marketing/…`.)

## Inventory — `screenshots/` (9 PNGs)

| File | Screen it shows | Maps to slot |
|------|-----------------|--------------|
| `pick_board.png` | Pick Board, Straight selected, 1 pick in card | **Slot 1** |
| `lineup.png` | Expanded Lineup sheet, 5/5 picks, gold Pick-of-Week Parlay | **Slot 2** |
| `leaderboard.png` | Season leaderboard, podium, `You` at rank 1 | **Slot 3** |
| `matchup_result.png` | Matchup Detail, `YOU WON`, confetti, profit swing | **Slot 4** |
| `how_it_works.png` | Disclosure / "How Action Arena Works" + wordmark | **Slot 5** — re-capture as `disclosure.png` |
| `matchup.png` | **League HQ** (League Detail), this-week matchup + awards | Slot 3 alt / season-arc B-roll |
| `arena_shop.png` | Arena Locker cosmetics shop | B-roll only |
| `season_pass.png` | Season Pass IAP (full-res) | **Exclude** |
| `season_pass_iap.png` | Season Pass IAP (framed/scaled, same screen) | **Exclude** |

## Per-slot: match / gap / concerns

### Slot 1 — Hook → `pick_board.png`
- **Match:** Strong. Clean Pick Board with the budget card, pick-type toggles, and a readable `New England Patriots @ Seattle Seahawks` card. No empty states, no error/conflict treatment, no tour overlay.
- **Gap:** None blocking. Cohesion only — this shot is league `Primetime Players`, **Week 5**, while shots 3–4 are `Sunday Night Pick Club`, **Week 3**. For a one-story carousel, re-capture in the same league + week as the rest (see cross-cutting note).
- **Concerns:**
  - The visible line shows the **`WINNER` tab with American moneyline numbers (`+170 / -205`)** — the most sportsbook-coded element in the whole set. It's acceptable as product UI (labeled `WINNER`, not "moneyline/odds"), and the Slot-5 disclosure re-frames it. **Mitigation if you want to soften it:** capture the **`SPREAD`** tab instead (`+3.5`-style), which reads more "prediction" than "book." Either way, the headline must never mention odds/the numbers.
  - Otherwise review-clean: no placeholder data, good contrast.

### Slot 2 — Mechanic → `lineup.png`
- **Match:** Strong and exactly the intended "Straight + gold Pick-of-Week Parlay + Teaser peek" composition. `5/5 picks · 100 coins · Remaining 0` reads as full strategic deployment.
- **Gap:** None. (Same league/week cohesion note as Slot 1 — confirm this lineup is in the carousel's canonical league.)
- **Concerns:**
  - American-odds numbers again (`-110`, `+196`, `-125`, `-155`) — same product-UI ruling as Slot 1. `Reward` (not "payout") and `coins` are the right de-gambled words; keep them.
  - `Tap to Unpick` / `Mark as Pick of the Week` are clean. No placeholders. Good contrast.

### Slot 3 — Social/Proof → `leaderboard.png`
- **Match:** Strong. Podium + table + records + `You` badge + ↑/↓ movement, realistic names, profit in coins.
- **Gap:** None. Optional: capture so at least the first full table row under the podium is visible (it is, here) — keep that.
- **Concerns:** Clean. No gambling vocabulary, no placeholder names, good contrast. Only nit: ensure the `You` badge is present (it is) — that personalization is what makes the bragging-rights read land.

### Slot 4 — Reward/Outcome → `matchup_result.png`
- **Match:** Strong — `YOU WON`, confetti firing, side-by-side `+56` vs `+47`, "won by 9 coins." This is the WinCelebration (#1 component) on Matchup Detail (#3).
- **Gap:** None. If the confetti ever obscures the score, a clean settled frame is an acceptable fallback (the important read is "I beat my friend and gained virtual coins").
- **Concerns:**
  - Confetti slightly busies the frame but the matchup stays readable — fine. Capture at the 300–700ms particle peak.
  - `WON` / `LOST` pills are competition outcomes, not money — compliant. Good contrast.

### Slot 5 — Brand/Compliance → `disclosure.png` (locked; re-capture of the `how_it_works.png` screen)
- **Match:** Strong and review-ready. Wordmark present, shield, the full Apple-5.3 disclosure ("free-to-play fantasy sports prediction game… virtual… no monetary value… no redemption features or links to real-money sports operators… prizes arranged outside Action Arena"), plus `VIRTUAL COINS` · `NO CASH OUT` pills.
- **Gap:** None for content. Composition only: headline overlay + gold radial-gradient background (see Part 1 Slot 5). No synthetic wordmark/tagline/footer — the screen self-brands.
- **Concerns:**
  - The body paragraph is small — at App Store thumbnail scale it won't be read; rely on the overlay headline + pills + wordmark to carry the message (the paragraph is "proof," not "read").
  - The green `GOT IT` button is a dismissal CTA — keep it or crop it in composition; harmless either way.

## Cross-cutting concerns (apply to the whole set)

1. **League + week cohesion.** Shot 1 = `Primetime Players` / Week 5; shots 3–4 = `Sunday Night Pick Club` / Week 3. Pick one canonical league and one week and re-capture shots 1–2 to match, so the five cards read as a single continuous story. *(Polish, not a review blocker.)*
2. **American-odds optics.** `+170/-205/-110/+196` appear in shots 1–2. Compliant as product UI, but it's the closest the set gets to "book." The Slot-5 disclosure is the load-bearing mitigation — keep it in the set. Optional softening: use the `SPREAD` view for the hook.
3. **Status bar / Apple convention.** Core five were captured at `3:51`; the Season Pass shots at `9:43` with a Do-Not-Disturb moon + 95% battery. For submission, normalize all status bars: clean time (Apple's convention is `9:41`), full battery, full signal, no DND icon.
4. **Fixture drift vs. seed script.** The captures' league names don't match `scripts/seed-app-store-screenshot-fixtures.sql` (May 28) or the old plan. Confirm which seeding produced the Jun 2 captures before re-running, or you'll re-seed the wrong fixtures. Capture accounts referenced previously: `jsomwarux@yahoo.com` and `appreview@actionarena.app` (the latter is the App Review login).
5. **`Loading` placeholder in IAP shots.** `season_pass.png` / `season_pass_iap.png` show `Loading` where the StoreKit price/launch status belongs (the `BUY PASS · $9.99` button has resolved, but the hero card hasn't) — a broken-looking placeholder. Do not ship as-is.

## Unused captures

- **`matchup.png` (League HQ / League Detail):** Genuinely good — badges (`HEAD-TO-HEAD · PRIVATE · NFL`), this-week matchup card, and Week-3 Awards (Top Performer / Cold Streak / Pick of the Week). Use as an **alternate Slot 3** (if you prefer "your league home" over "the ladder") or as a **6th shot / B-roll** showing the season arc. Filename is slightly misleading — it's the league screen, not the matchup detail.
- **`arena_shop.png` (Arena Locker):** Good cosmetics B-roll ("what am I playing for" — answers Tyler's objection), but COMPONENTS rates it "strong B-roll, weak hero," so keep it out of the core 5. **Concern if promoted:** the `ARENA COINS` balance reads **`0`** (empty-wallet look) and `GET COINS` routes to IAP — re-capture with a non-zero balance and crop the upsell.
- **`season_pass.png` / `season_pass_iap.png` (Season Pass IAP):** **Exclude from the core 5.** Reasons: (a) the `Loading` placeholder above; (b) it's a paywall/IAP screen, which undercuts INTAKE's "no gameplay gated behind payment" message and is a weak primary App Store screenshot; (c) Apple generally discourages paywall-as-hero. *Useful intel though:* these confirm the Season Pass is now a one-time **`$9.99` All-Access** purchase (resolves the INTAKE "confirm Season Pass price" TODO; matches the recent "Rename season pass product ID to all access" commit). They also show a `Reviewer or promo code` redeem field — handy for App Review, just not a marketing shot.

## Re-capture checklist (prioritized)

- **P0 — none.** Every slot has a shippable capture; you can composite the carousel today.
- **P1 — cohesion:** re-capture `pick_board.png` and `lineup.png` inside the carousel's canonical league + week (match shots 3–4) so the five cards tell one story.
- **P1 — submission polish:** normalize status bars across all five (clean `9:41`, full battery/signal, no DND moon).
- **P2 — optics:** optional `SPREAD`-tab version of the hook to soften the moneyline read.
- **If/when you want a 6th or a monetization shot:** re-capture Season Pass **after** the StoreKit price resolves (no `Loading`), and Arena Locker with a non-zero coin balance.

## Copy rules (carry into compositing)

- **Use:** pick, card, lineup, league, coins, rivalry, bragging rights, Sunday, group chat.
- **Avoid in overlay text:** bet, wager, sportsbook, odds, cash, win money, payout, cash out, odds boost.
- **Product UI is exempt:** `Parlay`, `Teaser`, `Reward`, and the American-odds numbers are fine *inside the phone* (it's gameplay) — just never echo them in an overlay headline.
