# Manual Regression Fixtures

Use these fixtures when you want simulator verification against deterministic
data instead of whatever state the dev database happens to contain.

## Seed

```sh
npm run seed:manual-regressions
```

The seed is idempotent. It replaces only leagues named `QA Manual Regression - *`
and fixture game ids prefixed with `qa_manual_`.

The seed prints the tester account, opponent account, league ids, and invite
codes. In the shared dev database, the tester is normally:

- Email: `appreview@actionarena.app`
- Password: `ActionArenaReview2026!`

## Fixtures

- `QA Manual Regression - Post Submit Editing` (`QAPOST`)
- `QA Manual Regression - Visibility Before Kickoff` (`QAVISB`)
- `QA Manual Regression - Visibility After Kickoff` (`QAVISA`)
- `QA Manual Regression - Pick Board Actions` (`QAPOTW`)
- `QA Manual Regression - Championship Snapshot` (`QACHMP`)

Each league has `settings.global_week_exempt = true` and
`settings.global_week_test_fixture = true`, so global week alignment, kickoff,
and completion tools skip it. They also carry
`settings.manual_regression_fixture = true`; automatic Bet Board odds-slate sync
is skipped for these leagues so their first-kickoff reveal baselines stay
deterministic.

The submitted-card fixtures use complete 5-pick, 100-coin cards with exactly
one Pick of the Week. If the simulator was already open before reseeding, reload
the app after the seed finishes so React Query does not show an old cached card.

## Simulator Checks

1. Start the app:

   ```sh
   npx expo start
   ```

2. Open the iOS simulator from Metro with `i`, or open the app if the simulator
   is already running.

3. Sign in as the tester account printed by the seed.

4. Open `Leagues`. If a fixture does not appear, use `Join League` with the
   invite code listed above.

5. Post-submit editing:
   - Open `QA Manual Regression - Post Submit Editing`.
   - Go to `Pick Board`.
   - Expected: the submitted card shows 5 picks and 100 coins allocated.
   - Find the submitted teaser containing `Seattle Seahawks +1.5`.
   - Expected: editing that multi-leg pick is blocked because one sibling leg
     has already started. The straight `Dallas Cowboys` pick remains the open
     contrast case.

6. Opponent visibility before kickoff:
   - Open `QA Manual Regression - Visibility Before Kickoff`.
   - Open the Week 2 matchup card.
   - Expected: both sides have submitted full 5-pick, 100-coin cards.
   - Expected: your `Dallas Cowboys` pick is visible, the opponent card says
     picks are submitted but hidden until kickoff, and `Philadelphia Eagles`
     does not appear in the opponent pick list.

7. Opponent visibility after kickoff:
   - Open `QA Manual Regression - Visibility After Kickoff`.
   - Open the Week 2 matchup card.
   - Expected: the opponent card is revealed and shows the full opponent card,
     including `Philadelphia Eagles`.

8. Pick Board card actions:
   - Open `QA Manual Regression - Pick Board Actions`.
   - Go to `Pick Board`.
   - Expected: the submitted card shows 5 picks and 100 coins allocated.
   - Expected: Pick of the Week is already locked after first kickoff. The
     inactive pick should not offer a working Pick of the Week swap action.

9. Championship snapshot:
   - Open `QA Manual Regression - Championship Snapshot`.
   - Expected: the season trophy case shows the tester as champion, while
     `Season MVP`/final standings can show the rival as the higher total-profit
     leader. This verifies championship winner and standings leader are no
     longer conflated.
   - Expected: the trophy case includes `Season MVP`, `Best Record`,
     `Parlay King`, `Most Consistent`, and `Biggest Single Bet`, with the
     biggest-bet card showing the bet type, odds, stake, reward, and selection.
