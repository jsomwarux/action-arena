# Action Arena App Store Screenshots Plan

Source context: `marketing/marketing/INTAKE.md`, `marketing/marketing/COMPONENTS.md`, and `marketing/marketing/TOKENS.md`.

Capture principle: make this feel like a fantasy league game with friends, not a sportsbook. Use "pick", "card", "league", "coins", "bragging rights", and "no real money" in overlay copy. Avoid App Store overlay headlines that use "bet", "wager", "sportsbook", "cash", "win money", or "odds boost".

## Part 1 - Narrative Arc

### 1. Hook Screenshot

Headline: **Build Your Sunday Card**

Narrative purpose: Stops the scroll with the core fantasy-prediction gameplay surface: a glowing NFL slate, a weekly virtual-coin budget, and recognizable Straight / Parlay / Teaser strategy without implying real-money gambling.

### 2. Mechanic Screenshot

Headline: **Pick Five. Spend 100.**

Narrative purpose: Explains the main action in one glance: choose weekly picks, allocate the full 100 virtual coins, and name one Pick of the Week before submitting.

### 3. Social / Proof Screenshot

Headline: **Climb Your League**

Narrative purpose: Shows the product is multiplayer and season-long by making friends, ranks, records, and profit movement the center of the frame.

### 4. Reward / Outcome Screenshot

Headline: **Bragging Rights Unlocked**

Narrative purpose: Delivers the emotional payoff: a won matchup, virtual profit, a rank-worthy result, and the celebration effect that makes the weekly loop feel game-like.

### 5. Brand / Compliance Screenshot

Headline: **No Real Money. All Rivalry.**

Narrative purpose: Lands the brand promise and compliance posture clearly: Action Arena is free-to-play fantasy sports competition with virtual coins and no in-app gambling.

## Part 2 - Screen Capture Plan

### Shot 1 - Hook Screenshot

Screen / route: `app/(app)/(tabs)/bet-board.tsx` - Pick Board, current week.

State to capture: Current-week slate loaded with several NFL game cards visible, populated budget tracker, and the Pick Type segmented control near the top. Best frame is Parlay mode because amber carries the strongest visual contrast and the `ParlayBuilder` can show "Stack the Chain", combo value, and selected legs.

Navigation from launch:

1. Log in with the App Review demo account from `docs/app-review-notes.md`.
2. If the disclosure appears, tap `Got It`.
3. From Home, tap `Open Pick Board`, or use the bottom tab for Pick Board.
4. Select `App Review Demo League` if multiple leagues appear.
5. Ensure the Week Navigator is on the open week, currently seeded as Week 4 in the demo notes.
6. Tap `Parlay` in the Pick Type segmented control.
7. Tap two or three non-conflicting values from different games so the Parlay Builder fills in.

Setup needed: Demo user must belong to a league with an open current week and upcoming mock or live NFL lines. For reliable capture, start the app with `EXPO_PUBLIC_USE_MOCK_DATA=true` so mock NFL games are available even if The Odds API is unavailable. Mark the Bet Board tour complete in AsyncStorage before capture, or dismiss it before framing.

Capture timing: Capture after the `StaggeredItem` card entrances and `AnimatedNumber` values settle, roughly 1 second after the last leg is selected. If using the Parlay Builder, capture with at least 2 legs and a non-zero amount so combo value and reward are visible.

Concerns: The in-app screen uses sportsbook-adjacent visual language by necessity, so the App Store overlay headline should stay fantasy-coded. Avoid an overlay that says "bet", "odds", "wager", or "payout". Also watch for the first-run tour overlay, early-access window, empty lines, or "Lines Loading Up" states.

### Shot 2 - Mechanic Screenshot

Screen / route: `app/(app)/(tabs)/bet-board.tsx` - Pick Board with `BetSlipSheet`, `AmountModal`, and `ConfirmationModal`.

State to capture: Mid-flow or final-review lineup with exactly 5 picks, exactly 100 virtual coins allocated, and one Pick of the Week highlighted. Ideal frame is the expanded lineup bottom sheet showing 5/5 picks, the lock badge, validation passing, and `Review & Submit`. A stronger alternate is the `ConfirmationModal` with `Final Review` and grouped Straight / Parlay / Teaser rows.

Navigation from launch:

1. Open Pick Board.
2. In Straight mode, tap a game value.
3. In the amount modal, choose a quick amount like `20 coins`, then tap `Add to Lineup`.
4. Repeat until the lineup has enough items, mixing Straight plus one Parlay or Teaser if possible.
5. For Parlay: switch to `Parlay`, select 2 different games, enter an amount, and tap `Add Parlay to Lineup`.
6. For Teaser: switch to `Teaser`, keep a point option selected, choose spread or total values from 2 different games, enter an amount, and tap `Add Teaser to Lineup`.
7. Expand the bottom lineup sheet.
8. Tap the star / Pick of the Week control on the most visually distinctive pick.
9. Adjust amounts until the budget is exactly 100 coins.

Setup needed: Use an unsubmitted current-week lineup. If the demo account already has Week 4 submitted, use another seeded capture account or reset / reseed the demo week before capture. The rules require at least 5 picks, exactly 100 coins, max 35 coins per pick, and exactly one Pick of the Week.

Capture timing: Capture either immediately after the Pick of the Week highlight pulse begins, or once the lineup sheet is fully expanded and no modal keyboard is visible. For the confirmation modal, capture after tapping `Review & Submit` and waiting for the modal fade to finish.

Concerns: This is the most setup-sensitive shot. It is easy to accidentally create duplicate side conflicts, exceed the 35-coin max, miss the exact 100-coin allocation, or forget the Pick of the Week. If this becomes too slow in the simulator, use the final-review modal as a mocked composition later in Claude Design with the same app UI.

### Shot 3 - Social / Proof Screenshot

Primary screen / route: `app/(app)/(tabs)/leaderboard.tsx` - Leaderboard.

Alternate screen / route: `app/(app)/(tabs)/leagues/[leagueId].tsx` - League Detail, `standings` or `chat` tab.

State to capture: Populated league leaderboard with at least 6 members if possible, visible podium cards for ranks 1-3, trend badges, and current user row. If the demo league only has two members, use League Detail instead and capture the Standings card plus Invite Code / Schedule context, or capture the Chat tab with shared pick cards and stickers.

Navigation from launch:

1. Log in and land on Home.
2. Tap the `Leaderboard` bottom tab.
3. If multiple league chips appear, select the most populated league.
4. Keep `Season` selected for the clearest season-long proof, or switch to `This Week` if weekly movement looks stronger.
5. Scroll just enough to include the podium and first rows of the table.

Setup needed: A marketable capture league should have more than two members, believable team names, diverse avatars/cosmetics, and standings rows with positive and negative virtual profit. The App Review demo league is enough for review, but may be visually thin for App Store proof if it only has two demo members.

Capture timing: Capture after podium entrance animations settle, about 1 second after the screen loads or after changing the Season / This Week segmented control.

Concerns: Empty or two-person standings undercut the social proof claim. Avoid all-male-coded or joke-only names in screenshots; Priya's persona is sensitive to "men yelling about football" energy. If the live app cannot produce a strong leaderboard, build this shot later as a controlled composition using the Leaderboard UI with seeded rows.

### Shot 4 - Reward / Outcome Screenshot

Primary screen / route: `app/(app)/(tabs)/matchups/[matchupId].tsx` - Matchup Detail with `WinCelebration`.

Alternate screen / route: `app/(app)/shop.tsx` - Arena Locker if a clean celebration cannot be triggered.

State to capture: A completed matchup where the current user won. The frame should show side-by-side players, the user's positive virtual-coin profit, winning / leading visual treatment, settled pick cards, and the `WinCelebration` overlay firing. Best version is a Score Burst, Stadium Crowd, Fireworks, or confetti celebration layered over a visible winning matchup.

Navigation from launch:

1. Open `Leagues`.
2. Enter `App Review Demo League`.
3. On League Detail, use the Week Navigator to choose a settled past week where the demo user won.
4. Tap the current user's matchup card.
5. If needed, clear the local celebration flag for that matchup so the celebration replays: `action-arena.win-celebration.<matchupId>`.
6. Reopen the matchup detail screen.

Setup needed: The selected matchup must have `winner_id` equal to the logged-in user. The user should have equipped a visually strong win celebration cosmetic in the Arena Locker, or else the default confetti still works. If no seeded win exists, create or seed one rather than showing a loss, since this slot is the reward shot.

Capture timing: Capture during the celebration peak, roughly 300-700 ms after the overlay appears, while particles / scoreboard digits are most visible but before they obscure all underlying matchup context. For a static alternative, capture the settled screen after the overlay completes with positive virtual profit and the winner treatment visible.

Concerns: The celebration only auto-fires once per matchup per local flag. It will not show if the user lost, if the matchup is pending, or if the local flag says it has already been seen. Also avoid a frame where confetti hides all data; the shot still needs to read as "I beat my friend", not just generic celebration.

### Shot 5 - Brand / Compliance Screenshot

Primary screen / route: `app/onboarding.tsx` - Onboarding, first slide.

Compliance alternate: `app/(app)/disclosure.tsx` - How Action Arena Works disclosure.

State to capture: Onboarding slide 1 with the Action Arena wordmark visible, dark navy background, electric-green accent, and the body copy "Compete with friends. No real money. Just bragging rights." The App Store overlay should carry the compliance headline and a short disclosure line.

Navigation from launch:

1. Use a fresh simulator install or clear the onboarding AsyncStorage flag `action-arena.onboarding-complete`.
2. Launch the app.
3. Stay on onboarding slide 1.
4. If using the disclosure alternate, log in, open the one-time disclosure, or navigate to the disclosure route from settings if exposed.

Setup needed: Fresh local app state for onboarding. For the disclosure alternate, use a user who has not acknowledged the disclosure, or open it from Settings / About if the route is exposed there. No special league data is needed.

Capture timing: Capture after the onboarding card animation settles, with the wordmark, first slide, and CTA visible. For the disclosure screen, capture the settled state with the shield icon, title, and body legible.

Concerns: This slot maps imperfectly to a pure in-app screen. Onboarding has brand plus short "no real money" copy, but it also includes `Skip` and `Create Account` UI that may not be ideal for a final App Store image. The disclosure screen has excellent compliance language, but no wordmark. Best App Store result may be a Claude Design composition using the ArenaLogo from `components/ui/arena-logo.tsx`, the disclosure language from `constants/disclosure.ts`, and a subtle phone mockup of onboarding or the Pick Board.

## Capture Preflight

- Use iOS simulator as the source of truth; this app is iOS-first and has no web version.
- Prefer a tall modern iPhone simulator such as iPhone 15 Pro Max / 16 Pro Max so App Store text overlays have room.
- Confirm the demo account from `docs/app-review-notes.md` works before the capture block.
- Use mock NFL data for deterministic Pick Board frames when possible: `EXPO_PUBLIC_USE_MOCK_DATA=true`.
- Clear or set local flags intentionally: onboarding complete, Bet Board tour complete, and matchup celebration seen flags can change what appears.
- Keep overlay copy compliant: "free-to-play", "virtual coins", "sports picks", "prediction league", "friends", "bragging rights".
- Avoid screenshots with placeholder errors, empty states, loading skeletons, API failures, early-access lockouts, or "Season Pass required" as the central message.

## If Screens Map Poorly

- If the Leaderboard is underpopulated, use League Detail standings/chat as the social shot, or create a seeded capture league with 6-10 members.
- If the WinCelebration will not replay, use a settled Matchup Detail screen as the reward shot and add celebration treatment in Claude Design.
- If the brand/compliance screen feels too utilitarian, build the fifth shot as a designed composition rather than a raw simulator screenshot. Keep the compliance line direct: "Free to play. Virtual coins only. No real money."
