# Action Arena

## What This Is
A social sports prediction app. Fantasy football league structure + sports betting strategy. Players join leagues, get $100/week fake budget, compete on profit through straight bets, parlays, and teasers. No real money is ever wagered.

## Platform
This is a native mobile app. Target iOS first.
Build and test against iOS simulator as the primary development
environment. Expo builds to both platforms from the same codebase.
No web version — mobile only for now.

## Repository Expectations
- After any change, run `npx expo start` to verify the app compiles.
- Run existing test suites before considering any task complete.
- Use TypeScript strict mode. No `any` types unless absolutely unavoidable.
- All Supabase queries should go through custom hooks using TanStack Query for caching, loading states, and error handling.
- Commit messages should be descriptive: "Add parlay builder with real-time odds calculation" not "update bet board".

## Tech Stack
- **Framework:** React Native + Expo (latest stable SDK)
- **Navigation:** Expo Router (file-based routing)
- **Backend:** Supabase (Postgres DB, Auth, Realtime subscriptions, Edge Functions)
- **Odds Data:** The Odds API (https://the-odds-api.com) — h2h, spreads, and totals markets
- **Styling:** NativeWind (Tailwind for React Native)
- **Animations:** React Native Reanimated
- **Environment Variables:**
  - EXPO_PUBLIC_SUPABASE_URL
  - EXPO_PUBLIC_SUPABASE_ANON_KEY
  - EXPO_PUBLIC_ODDS_API_KEY

## Database Schema

### users
- id (uuid, PK)
- email, display_name, avatar_url
- is_premium (boolean, default false)
- push_token (string, nullable)
- created_at

### leagues
- id (uuid, PK)
- name, description
- commissioner_id (FK users)
- type: 'h2h' | 'cumulative'
  - h2h: head-to-head matchups each week, win/loss/tie records, playoffs, championship
  - cumulative: no matchups, total profit over the season, highest total wins
- visibility: 'public' | 'private'
- invite_code (unique, 6 chars)
- max_members (default 10)
- sport: 'nfl' | 'nba' | 'mlb' (launch with NFL only)
- season_year (int)
- current_week (int)
- status: 'drafting' | 'active' | 'playoffs' | 'complete'
- settings (jsonb — for premium custom overrides of budget/bet rules)
- created_at

### league_members
- id (uuid, PK)
- league_id (FK leagues)
- user_id (FK users)
- team_name (string — their display name within this league)
- joined_at

### weekly_matchups (H2H leagues only)
- id (uuid, PK)
- league_id (FK leagues)
- week_number (int)
- home_user_id (FK users)
- away_user_id (FK users)
- home_profit (decimal, nullable — filled after settlement)
- away_profit (decimal, nullable)
- winner_id (FK users, nullable)
- is_playoff (boolean)
- is_championship (boolean)

### bets
- id (uuid, PK)
- user_id (FK users)
- league_id (FK leagues)
- week_number (int)
- bet_type: 'straight' | 'parlay' | 'teaser'
- amount (decimal — allocation from budget)
- odds (int — American odds; for straights from the leg, for teasers from lookup table, for parlays calculated from combined legs)
- potential_payout (decimal — calculated at placement)
- result: 'pending' | 'win' | 'loss' | 'push'
- profit (decimal, nullable — filled after settlement)
- teaser_points (decimal, nullable — 6, 6.5, or 7; only for teasers)
- is_lock (boolean, default false — exactly one Lock of the Week per player/week)
- created_at

### bet_legs
- id (uuid, PK)
- bet_id (FK bets)
- game_id (string — from Odds API)
- market: 'moneyline' | 'spread' | 'over_under'
- selection (string — team name, Over, Under, etc.)
- original_line (decimal, nullable — the base spread or total before any teaser adjustment)
- adjusted_line (decimal, nullable — the line after teaser points applied; equals original_line for straights and parlays)
- leg_odds (int — American odds for this individual leg)
- result: 'pending' | 'win' | 'loss' | 'push'
- game_start_time (timestamp)
- locked (boolean — true after this specific game starts)

### standings
- id (uuid, PK)
- league_id (FK leagues)
- user_id (FK users)
- week_number (int)
- wins, losses, ties (int — H2H only)
- weekly_profit (decimal)
- total_profit (decimal — running cumulative)
- rank (int)

### seasons
- id (uuid, PK)
- league_id (FK leagues)
- season_year (int)
- champion_user_id (FK users, nullable)
- final_standings (jsonb — permanent standings snapshot at season completion)
- awards (jsonb — permanent end-of-season awards snapshot)
- completed_at

## Bet Types

### Straight Bets
A single selection on one game. Markets: moneyline, spread, or over/under.
Stored as 1 bet row + 1 bet_leg row.

### Parlays
Multiple selections combined into one bet. All legs must win or the entire bet loses.
- Min 2 legs, max 6 legs.
- No two legs from the same game (no same-game parlays).
- Markets allowed: moneyline, spread, over/under — any mix across different games.
- **Payout math:** Convert each leg's American odds to decimal. Multiply all decimals together. That product is the combined decimal odds. Payout = amount × combined decimal odds.
- **Push handling:** If a leg pushes, it drops out and the parlay recalculates with remaining legs. If only 1 leg remains after pushes, it becomes a straight bet at that leg's odds. If all legs push, entire bet pushes.
- **Payout cap: $500.** If calculated payout exceeds $500, it is capped at $500.
- Stored as 1 bet row + N bet_leg rows.

### Teasers
A special parlay where the player buys extra points on spreads and/or totals. All legs must win. NFL only.
- Min 2 legs, max 4 legs.
- Only spread and over/under markets (no moneylines in teasers).
- No two legs from the same game.
- Teaser sizes: 6, 6.5, or 7 points. All legs in one teaser use the same point adjustment.
- Point adjustments are always in the bettor's favor:
  - Spread favorites: line moves down (e.g., -7.5 → -1.5 with 6-pt teaser)
  - Spread underdogs: line moves up (e.g., +3.5 → +9.5 with 6-pt teaser)
  - Over: total moves down (e.g., Over 45.5 → Over 39.5 with 6-pt teaser)
  - Under: total moves up (e.g., Under 45.5 → Under 51.5 with 6-pt teaser)
- **Payout uses a fixed odds lookup table (American odds):**

  | Legs | 6 pts  | 6.5 pts | 7 pts  |
  |------|--------|---------|--------|
  | 2    | -110   | -120    | -130   |
  | 3    | +150   | +130    | +110   |
  | 4    | +250   | +200    | +160   |

- **Push handling:** If a leg pushes, it drops out. Payout recalculates using the reduced leg count from the table. If it drops below 2 legs, entire teaser pushes (profit = $0).
- Stored as 1 bet row (with teaser_points filled) + N bet_leg rows (with original_line and adjusted_line).

## Odds Conversion
- American to decimal: positive odds → (odds / 100) + 1, negative odds → (100 / abs(odds)) + 1
- Decimal to American: decimal >= 2.0 → (decimal - 1) × 100, decimal < 2.0 → -100 / (decimal - 1)

## Core Business Rules
- Weekly budget: $100 (configurable per league for premium users)
- Minimum bets per week: 5 (each straight bet, parlay, or teaser counts as 1 bet)
- Maximum single bet: $35 (applies to straights, parlays, and teasers equally)
- Maximum parlay payout: $500 cap
- Must allocate entire $100 budget exactly — no leftover, no overage
- Each player must designate exactly one bet per week as their "Lock of the Week"
- The Lock bet receives a 1.5x multiplier on profit and loss (wins pay 1.5x, losses cost 1.5x)
- Bets cannot be submitted without exactly one Lock designation
- Bets lock at the leg level — each leg locks when its specific game starts
- For parlays/teasers: if any leg hasn't locked yet, the entire multi-leg bet can still be edited or cancelled. Once all legs are locked, the bet is fully locked.
- Cannot place multiple bets on the same side of the same game within the same league. One selection per game per league, across all bet types.
- Profit calculation:
  - Win: profit = payout - amount (where payout = amount × decimalOdds, capped at $500 for parlays)
  - Loss: profit = -amount
  - Push: profit = $0
- H2H matchup winner = higher weekly profit (ties possible)
- NFL season structure: 14 regular weeks + 3 playoff weeks
- Playoff seeding based on regular season standings
- All bets within a league are public — league members can see each other's picks

## Design System
- **Theme:** Dark mode primary. Deep navy/charcoal background (#0A0E1A), not pure black.
- **Accent colors:**
  - Electric green (#00FF87) — profits, wins, positive actions, active tab
  - Coral red (#FF4757) — losses, negative states, destructive actions
  - Gold (#FFD700) — achievements, trophies, rankings, best bet highlight
  - Amber/orange (#FFA502) — parlay bet type accent
  - Cyan/blue (#18DCFF) — teaser bet type accent
- **Typography:** Bold condensed headings (sports broadcast feel). Clean sans-serif body text.
- **Cards:** Subtle glassmorphism — slight blur backdrop, 1px semi-transparent border, rounded corners.
- **Spacing:** Generous padding throughout. Nothing cramped. Let the UI breathe.
- **Motion:** Spring animations on interactions. Animated number counters. Staggered card entrances. Confetti on big wins.
- **Haptics:** Light tap on selections, medium on confirmations, success pattern on wins.
- **Empty states:** Every screen that could be empty gets a helpful illustration/message and a clear CTA.
- **Loading states:** Skeleton loaders everywhere. Never show a blank screen while data loads.
- **Bet type visual language:** Straight bets use the default green/red scheme. Parlays always carry the amber accent (badges, borders, backgrounds). Teasers always carry the cyan accent. This color coding should be consistent across every screen — bet board, bet slip, bet history, matchup detail, profile stats.
