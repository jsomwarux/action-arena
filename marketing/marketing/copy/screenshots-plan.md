# Action Arena App Store Screenshots Plan

Updated after simulator review on May 19, 2026.

## Capture Data Now Available

I seeded a dedicated fixture in the linked Supabase project:

- League: `App Store Screenshot League`
- Invite code: `APPSTR`
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

- League: `Test H2H League`, or any open league where you can still build picks.
- Pick type: `Straight`, not `Parlay`.
- Weekly budget visible.
- First game card visible with team matchup and pick buttons.
- Lineup sheet collapsed.
- No amount modal, tour overlay, or empty parlay builder dominating the bottom.

Step-by-step:

1. Launch the simulator and log in.
2. Tap `Picks`.
3. If the selected league is `App Store Screenshot League`, switch the Active League picker back to `Test H2H League` because the screenshot fixture is already settled/submitted.
4. Select `Straight`.
5. Keep Week 2 if that is the open week with available games.
6. Drag the page slightly upward until the first actual game card appears below the budget tracker.
7. Keep the bottom Lineup sheet collapsed.
8. Capture when the screen is settled.

Frame note: The ideal frame has `Pick Board`, `Weekly Budget`, and the top of the first real matchup. Avoid a frame where the visible bottom is mostly `Parlay Builder 0/6 legs`.

## Screenshot 2 - Mechanic

Headline: **Pick Five. Spend 100.**

Purpose: Show the core loop: build a five-pick lineup, allocate the full 100 virtual coins, and choose one Pick of the Week.

Best screen: `app/(app)/(tabs)/bet-board.tsx` - expanded Lineup bottom sheet.

Use Screenshot 3 as the model, not Screenshot 2. Screenshot 2 is clean, but three straight picks in a column undersells the app. Screenshot 3 is stronger because it shows Straight, Parlay, and the Teaser accent peeking in, which communicates the product's variety in one frame.

Best state:

- Expanded lineup sheet.
- Header shows `5/5 picks · 100 coins` and `Remaining 0 coins`.
- One Straight card at the top.
- One 2-leg Parlay card fully visible.
- Teaser card peeking at the bottom.
- One pick marked as Pick of the Week so the gold lock treatment appears.

Step-by-step:

1. Open `Picks`.
2. Select `Test H2H League` or another unsubmitted open league.
3. Add one Straight pick for `20 coins`.
4. Add one 2-leg Parlay for `20 coins`.
5. Add one 2-leg Teaser for `20 coins`.
6. Add two more Straight picks for `20 coins` each.
7. Expand the Lineup sheet.
8. Tap `Mark as Pick of the Week (1.5x)` on the top Straight card or the Parlay card.
9. Scroll the Lineup sheet so the top Straight card and the full Parlay card are visible, with the Teaser card starting at the bottom.
10. Capture after the gold lock highlight settles.

Frame note: If the lock badge makes the first card too tall, put the lock on the Parlay card and frame the Parlay as the hero card. Do not use an all-Straight lineup for the final App Store screenshot unless the mixed lineup becomes visually cramped.

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
6. Capture 300-700 ms after the celebration starts, when particles are visible but the matchup is still readable.

Step-by-step if logged in as `appreview@actionarena.app`:

1. Tap `Leagues`.
2. Open `App Store Screenshot League`.
3. Make sure the Week Navigator is on `Week 3`.
4. Open the current matchup card for `Review Rebels` vs `North End Picks`.
5. Capture the win celebration or settled result.

If the celebration does not fire:

1. Delete the app from the simulator or erase app data to clear the local `action-arena.win-celebration.<matchupId>` flag.
2. Reinstall/reopen the app.
3. Open the same matchup again.

Frame note: A clean settled-result frame is acceptable if the celebration obscures too much. The important read is "I beat my friend and gained virtual coins."

## Screenshot 5 - Brand / Compliance

Headline: **No Real Money. All Rivalry.**

Purpose: Close the carousel by making the compliance promise explicit: free-to-play fantasy sports predictions, virtual coins only, no real-money gambling.

Best raw app screen: `app/(app)/disclosure.tsx` - How Action Arena Works.

Your Screenshot 4 is the screen I meant as the compliance fallback. It is correct for the disclosure requirement, but it is not the strongest brand screenshot by itself because there is no Action Arena wordmark and the top has a lot of empty space.

Best state:

- Disclosure card fully visible.
- Shield icon visible.
- `How Action Arena Works` title visible.
- Body copy readable enough to show "free-to-play", "virtual", "no monetary value", and "No real money".

Step-by-step:

1. Open Settings / About / disclosure entry if available, or trigger the one-time disclosure with a fresh account/session.
2. Stay on the disclosure screen.
3. Capture the settled state.
4. In the App Store composed screenshot, add the external headline `No Real Money. All Rivalry.` and the Action Arena wordmark above or below the phone frame.

Best final-composition option:

- Use the disclosure screen as the phone content.
- Add `Action Arena` wordmark outside the phone in the App Store screenshot layout.
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
