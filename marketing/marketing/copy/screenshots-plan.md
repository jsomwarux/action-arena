# Action Arena App Store Screenshots Plan

Updated after simulator review on May 28, 2026.

## Capture Data Now Available

I seeded three dedicated fixtures in the linked Supabase project:

- Shot 1 league: `Sunday Card League` (`SUNCAR`) - open Pick Board with one prefilled Straight pick, `20/100 coins`, `1/5 picks`, and no submitted lineup.
- Shot 2 league: `Lineup Builder League` (`LINBUD`) - open Pick Board with a prefilled mixed lineup: 3 Straights, 1 locked Parlay, 1 Teaser, `5/5 picks`, `100 coins`, `0 coins` remaining.
- Shot 3/4 league: `App Store Screenshot League` (`APPSTR`) - settled league with realistic leaderboard and completed winning matchups.
- Current week: `Week 3`
- Leaderboard hero row: `Sunday Syndicate`, `+245 coins`, rank 1
- Other podium rows: `Review Rebels`, `+188 coins`; `Fourth Quarter Club`, `+106 coins`
- Completed matchup if logged in as `jsomwarux@yahoo.com`: matchup `00000000-0000-0000-0000-000000031301`, `Sunday Syndicate` won `+118` to `+32`
- Completed matchup if logged in as `appreview@actionarena.app`: matchup `00000000-0000-0000-0000-000000031302`, `Review Rebels` won `+64` to `+35`

Re-seed any time with:

```sh
npx supabase db query --linked -f scripts/seed-app-store-screenshot-fixtures.sql
```

## Screenshot 1 - Hook

Headline: **Build Your Sunday Card**

Purpose: Make the App Store visitor instantly understand the product: a weekly NFL pick board with virtual coins, league context, and sports-strategy energy.

Best screen: `app/(app)/(tabs)/bet-board.tsx` - Pick Board.

Use this instead of the selected Parlay Builder frame. Your Screenshot 1 proves the selected parlay legs do not fit above the fold, so the Parlay Builder should not be the hook capture. It reads as a setup panel, not the hero feature.

Best state:

- League: `Sunday Card League`.
- Pick type: `Straight`.
- One Straight pick from a later game is already in the lineup so the bottom sheet reads `1` / `Build your weekly card` / `80 coins`.
- Weekly budget card shows `20 coins / 100 coins` and `1/5 picks`.
- First game card is visible with `Dallas Cowboys @ Philadelphia Eagles`, with neither side showing a conflict/error state.
- Lineup sheet collapsed.
- No amount modal, tour overlay, or empty Parlay Builder dominating the bottom.

Step-by-step:

1. Re-seed the fixtures if needed: `npx supabase db query --linked -f scripts/seed-app-store-screenshot-fixtures.sql`.
2. Launch the app and log in as your capture account.
3. Tap `Picks`.
4. In `Active League`, select `Sunday Card League` if it is not already selected.
5. Confirm the `Straight` pick type is selected.
6. Wait for the auto-prefill to settle. The bottom sheet should show `1`, and the weekly budget should show `20 coins / 100 coins`. The prefilled pick is intentionally from a later game so the visible Cowboys/Eagles card stays clean.
7. Keep the Lineup sheet collapsed.
8. Scroll the Pick Board just enough that the first matchup card is fully readable under the budget card. It is okay if the large `Pick Board` page title scrolls offscreen; preserve `Pick Type`, `Active League`, budget, and the complete first game card.
9. Capture after all number animations settle.

Frame note: The ideal frame shows the user has already started building a weekly card. It should not look empty, it should not show `Test H2H League`, and no visible pick button should have a red conflict treatment.

## Screenshot 2 - Mechanic

Headline: **Pick Five. Spend 100.**

Purpose: Show the core loop: build a five-pick lineup, allocate the full 100 virtual coins, and choose one Pick of the Week.

Best screen: `app/(app)/(tabs)/bet-board.tsx` - expanded Lineup bottom sheet.

Use Screenshot 3 as the model, not Screenshot 2. Screenshot 2 is clean, but three straight picks in a column undersells the app. Screenshot 3 is stronger because it shows Straight, Parlay, and the Teaser accent peeking in, which communicates the product's variety in one frame.

Best state:

- League: `Lineup Builder League`.
- Expanded lineup sheet.
- Header shows `5/5 picks · 100 coins` and `Remaining 0 coins`.
- One Straight card is partially visible at the top.
- One locked 2-leg Parlay card is fully visible and framed as the hero interaction.
- Teaser card peeks at the bottom.
- The Parlay is marked Pick of the Week so the gold treatment appears.

Step-by-step:

1. Tap `Picks`.
2. Open the `Active League` picker and select `Lineup Builder League`.
3. Wait for the auto-prefill to settle. The bottom sheet should automatically expand and show `5/5 picks · 100 coins`, `Remaining 0 coins`.
4. Do not submit the card.
5. In the expanded Lineup sheet, scroll slightly until the first Straight card is clipped at the top and the locked `2-leg Parlay` is fully visible.
6. Confirm the Parlay has the gold Pick of the Week treatment and `Tap to Unpick`.
7. Confirm the Teaser card is just peeking at the bottom of the frame.
8. Capture after the gold highlight and number animations settle.

Frame note: This is intentionally the "one Straight + one locked Parlay + Teaser peek" composition. It reads faster than three straight bets and shows the app's range in one frame.

## Screenshot 3 - Social / Proof

Headline: **Climb Your League**

Purpose: Prove this is multiplayer and season-long: friends, rankings, records, movement, and realistic virtual profit.

Best screen: `app/(app)/(tabs)/leaderboard.tsx` - Leaderboard.

Best state:

- League: `App Store Screenshot League`.
- Segmented control: `Season`.
- Podium visible.
- `Sunday Syndicate` at rank 1 with `+245`.
- `Review Rebels` and `Fourth Quarter Club` visible as rank 2 and rank 3.
- At least the first row of the full leaderboard table visible below podium if possible.

Step-by-step:

1. Pull to refresh, or fully restart the app after seeding.
2. Tap `Leaders`.
3. If the league chip is not already `App Store Screenshot League`, tap that league chip.
4. Select `Season`.
5. Wait about 1 second for podium and number animations.
6. Capture with the podium centered and the table header/first row still visible.

If logged in as `jsomwarux@yahoo.com`, `Sunday Syndicate` should also show the `You` badge on the first-place podium. That is the optimal capture.

## Screenshot 4 - Reward / Outcome

Headline: **Bragging Rights Unlocked**

Purpose: Show the payoff: your picks settled, your weekly matchup won, and the app celebrating the result.

Best screen: `app/(app)/(tabs)/matchups/[matchupId].tsx` - completed Matchup Detail.

Best state:

- League: `App Store Screenshot League`.
- Week: `Week 3`.
- Current user won.
- Top matchup score area visible.
- User side has positive virtual profit.
- Celebration overlay is firing, or the settled result is visible immediately after it.

Step-by-step if logged in as `jsomwarux@yahoo.com`:

1. Tap `Leagues`.
2. Open `App Store Screenshot League`.
3. Make sure the Week Navigator is on `Week 3`.
4. Open the current matchup card for `Sunday Syndicate` vs `Fourth Quarter Club`.
5. The win celebration should auto-fire the first time the matchup opens.
6. If it already fired before, tap the gold `You Won` pill to replay it.
7. Capture 300-700 ms after the celebration starts, when particles are visible but the matchup is still readable.

Step-by-step if logged in as `appreview@actionarena.app`:

1. Tap `Leagues`.
2. Open `App Store Screenshot League`.
3. Make sure the Week Navigator is on `Week 3`.
4. Open the current matchup card for `Review Rebels` vs `North End Picks`.
5. If the celebration already fired before, tap the gold `You Won` pill to replay it.
6. Capture the win celebration or settled result.

If the celebration does not fire:

1. Tap the gold `You Won` pill at the top of Matchup Detail.
2. Wait for the overlay to begin.
3. Capture during the 300-700 ms peak.
4. If the pill does not replay it, delete the app from the simulator or erase app data to clear the local `action-arena.win-celebration.<matchupId>` flag, then reopen the same matchup.

Frame note: A clean settled-result frame is acceptable if the celebration obscures too much. The important read is "I beat my friend and gained virtual coins."

## Screenshot 5 - Brand / Compliance

Headline: **No Real Money. All Rivalry.**

Purpose: Close the carousel by making the compliance promise explicit: free-to-play fantasy sports predictions, virtual coins only, no real-money gambling.

Best raw app screen: `app/(app)/disclosure.tsx` - How Action Arena Works.

Your Screenshot 4 is the screen I meant as the compliance fallback. It is correct for the disclosure requirement, but it is not the strongest brand screenshot by itself because there is no Action Arena wordmark and the top has a lot of empty space.

Best state:

- Disclosure card fully visible.
- Action Arena wordmark visible inside the phone frame.
- Shield icon visible.
- Card headline: `Free To Play. No Real Money.`
- Body copy readable enough to show "free-to-play", "virtual", "no monetary value", and "No real money".
- Pills visible: `Virtual Coins` and `No Cash Out`.

Step-by-step:

1. Open the disclosure screen from Settings / About. If it is not linked there, navigate to the app route `/disclosure?source=settings` in the simulator dev flow.
2. Stay on the disclosure screen. Do not tap `Got It`.
3. Confirm the card shows the Action Arena wordmark, shield icon, `Free To Play. No Real Money.`, the shorter disclosure paragraph, and the two compliance pills.
4. Capture the settled state.
5. In the App Store composed screenshot, use the external headline `No Real Money. All Rivalry.`.

Best final-composition option:

- Use the disclosure screen as the phone content.
- Add a short compliance line outside the phone: `Free to play. Virtual coins only. No real money.`

## Final Recommended 5-Shot Order

1. `Build Your Sunday Card` - Pick Board with real game cards, not empty Parlay Builder.
2. `Pick Five. Spend 100.` - mixed Lineup sheet using Screenshot 3 style.
3. `Climb Your League` - seeded `App Store Screenshot League` leaderboard.
4. `Bragging Rights Unlocked` - seeded completed winning matchup.
5. `No Real Money. All Rivalry.` - disclosure screen plus brand treatment.

## Copy Rules

- Use `pick`, `card`, `lineup`, `league`, `coins`, `rivalry`, `bragging rights`.
- Avoid `bet`, `wager`, `sportsbook`, `cash`, `win money`, `payout`, and `odds boost` in App Store overlay text.
- In screenshots where the app itself says `Parlay`, `Teaser`, or `Reward`, that is acceptable because it is product UI, but the marketing headline should stay fantasy-league coded.
