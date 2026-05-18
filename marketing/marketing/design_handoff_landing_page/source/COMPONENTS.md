# Action Arena — Top User-Facing Components

> **Note on project layout:** Action Arena uses Expo Router, so the user-facing "screens" live in `app/` (file-based routes), not `src/screens/`. Reusable building blocks live in `components/`. The list below mixes both — full screens where the entire route is the user experience, and reusable components where the component alone carries marketing weight.

Sorted by Marketing potential descending. **The top 3 are the candidate components for App Store preview video and landing-page hero embedding.**

### WinCelebration
- **Path:** `components/cosmetics/index.tsx` (export `WinCelebration`)
- **Purpose:** Full-screen celebration overlay that fires when a user views a winning matchup — branches by equipped cosmetic into Score Burst (digit punch), Stadium Crowd (rising people), Fireworks (radial sparkle bursts), or a default confetti rain.
- **Marketing potential:** **High** — purpose-built to be the emotional payoff moment of the product; multiple distinct animation variants give 4 hero-ready visual signatures for video and trailer cuts.
- **Has visible numeric data:** Yes (Score Burst variant shows a punchy `+1` scoreboard digit).
- **Has interactive state changes:** Yes (fires on a `fireKey` prop; `visible` toggles dismissal; cosmetic loadout swaps the animation entirely).
- **Standalone usable:** Yes — accepts `cosmetics`, `fireKey`, `visible`, `onComplete` only; no data layer required. Drop-in for Remotion compositions.

### Bet Board (Pick Board) screen
- **Path:** `app/(app)/(tabs)/bet-board.tsx`
- **Purpose:** The weekly pick board where users browse NFL games with live odds and build straight picks, parlays, and teasers into a lineup against their $100 virtual budget.
- **Marketing potential:** **High** — it's the core gameplay surface and the most "sportsbook-shaped" UI in the app, full of team logos, live odds, and bet construction. Best surface for showing the "build your card" loop.
- **Has visible numeric data:** Yes (American odds, spreads, totals, budget remaining, payout previews — many tickable counters).
- **Has interactive state changes:** Yes (tap to add legs, swipe rows, segmented toggles between bet types, lineup growing in real time).
- **Standalone usable:** No — requires authenticated user, league context, odds query, and bet mutation hooks. Would need mocked data for a Remotion render.

### Matchup Detail screen
- **Path:** `app/(app)/(tabs)/matchups/[matchupId].tsx`
- **Purpose:** Head-to-head matchup view showing both players' weekly lineups, leg-by-leg results, live and final scores, virtual profit, and the win celebration overlay.
- **Marketing potential:** **High** — this is where the WinCelebration fires; pairs the most emotional moment with side-by-side numeric drama (your profit vs. friend's profit). Strong "victory moment" frame for a trailer.
- **Has visible numeric data:** Yes (per-leg results, virtual profit totals, live game scores, payout math).
- **Has interactive state changes:** Yes (post-submit edit modal, expanding bet detail rows, celebration trigger).
- **Standalone usable:** No — requires authenticated user, matchup ID, and several Supabase queries (bets, legs, live scores, cosmetics by user).

### Cosmetics Shop (Arena Locker) screen
- **Path:** `app/(app)/shop.tsx`
- **Purpose:** Browse and equip cosmetic loadout items across 6 categories (team logos, trophy skins, lock effects, win celebrations, chat stickers, profile frames) using Arena Coins.
- **Marketing potential:** **Medium** — visually rich (every card animates its own preview art), differentiates the app from generic fantasy apps, but secondary to gameplay screens. Strong B-roll, weak hero.
- **Has visible numeric data:** Yes (coin balance counter, item costs, "X/Y owned" badge per category).
- **Has interactive state changes:** Yes (category tabs swap the grid, purchase + equip flows with sparkle animation on purchase, equipped state visual swap).
- **Standalone usable:** No (requires cosmetics + season-pass queries) — but the individual cosmetic previews inside (`CosmeticPreview`) are standalone-usable.

### CosmeticPreview (per-item animated art)
- **Path:** `components/cosmetics/index.tsx` (export `CosmeticPreview`)
- **Purpose:** Renders the looping animated preview art for a single cosmetic item, with a different visual treatment per category (pulsing team-logo crest, spinning trophy, glowing lock effect, fireworks-style win celebration, etc.).
- **Marketing potential:** **Medium** — each variant is self-contained motion-design eye candy and would tile beautifully in a grid B-roll shot. Limited as a hero on its own (small surface area), but compelling at scale.
- **Has visible numeric data:** No.
- **Has interactive state changes:** No (auto-loops on mount).
- **Standalone usable:** Yes — accepts `category`, `itemId`, `size` only. Resolves item metadata internally from `constants/cosmetics.ts`. Drop-in.

### League Detail screen
- **Path:** `app/(app)/(tabs)/leagues/[leagueId].tsx`
- **Purpose:** Standings table, current-week matchups, playoff bracket, season awards, league chat entry — the league "home base" surface.
- **Marketing potential:** **Medium** — communicates the "play with your friends" social loop and the season-arc payoff (standings climbing, playoff bracket, trophy). Strong narrative shot, weaker as a still.
- **Has visible numeric data:** Yes (records, weekly profit, total profit, ranks, week numbers).
- **Has interactive state changes:** Yes (week navigator, segmented toggle between standings / matchups / awards).
- **Standalone usable:** No (league context, member list, standings, matchups queries).

### Leaderboard screen
- **Path:** `app/(app)/(tabs)/leaderboard.tsx`
- **Purpose:** Cross-league ranking surface showing top players by profit, win rate, or weekly performance.
- **Marketing potential:** **Medium** — the "I'm #1 in my league" bragging-rights screenshot, but visually closer to a table than a hero shot.
- **Has visible numeric data:** Yes (rank position, profit totals, win/loss records).
- **Has interactive state changes:** Yes (filter/sort toggles, period selector).
- **Standalone usable:** No (requires leaderboard query + auth).

### Confetti
- **Path:** `components/ui/confetti.tsx`
- **Purpose:** Standalone screen-wide confetti burst with two palette variants (standard green/gold, parlay amber/cyan); used as the default win effect when no celebration cosmetic is equipped.
- **Marketing potential:** **Medium** — universally readable "victory" signifier, but generic enough that it doesn't carry brand identity by itself. Useful as a transition or accent element in a trailer.
- **Has visible numeric data:** No.
- **Has interactive state changes:** Yes (fires on `fireKey`, dismisses on `onComplete`).
- **Standalone usable:** Yes — props are `visible`, `fireKey`, `variant`, `onComplete`. Drop-in for any composition.

### AnimatedNumber
- **Path:** `components/ui/animated-number.tsx`
- **Purpose:** Animated tween between numeric values for coin balances, profit totals, payouts, and scoreboard digits — the "watch the number tick up" primitive.
- **Marketing potential:** **Medium** — exactly the kind of micro-interaction marketing videos focus on, but on its own it's a single line of text. Pairs well with other components rather than carrying a frame alone.
- **Has visible numeric data:** Yes (it *is* the numeric data).
- **Has interactive state changes:** Yes (animates on every `value` prop change).
- **Standalone usable:** Yes — same API as React Native `<Text>` plus a `value` prop. Drop-in.

### Profile screen
- **Path:** `app/(app)/(tabs)/profile.tsx` (renders `components/profile/profile-content.tsx`)
- **Purpose:** Per-user dashboard with season stats, cosmetic loadout preview (avatar + frame + trophy + lock effect), pick history, and settings entry.
- **Marketing potential:** **Low** — important for product completeness but reads as "settings + stats" rather than "moment of delight." Useful for screenshot 3-of-5 ("track your season") in App Store carousels.
- **Has visible numeric data:** Yes (career profit, weekly profit, win rate, bets placed, ranks).
- **Has interactive state changes:** Yes (history list scroll, cosmetic loadout taps).
- **Standalone usable:** No (auth + multiple stat queries + cosmetics resolution).
