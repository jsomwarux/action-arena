# Action Arena Web Client — Adversarial QA Report

**Scope:** `webapp/` desktop web client
**Authority for business rules:** `AGENTS.md`
**Test plan walked:** `docs/testing/action-arena-test-plan-v2.quick-reference.md`
**Date:** 2026-09-04
**Method:** independent verification. Nothing in this repo was modified except this file.

---

> ## Resolution status — updated 2026-09-04, after the fix pass
>
> Every **MUST FIX** and every **SHOULD FIX** finding below is now resolved. Each one carries a
> `**RESOLVED**` block naming the change and, where the finding was proven by executing the shipped
> module, the same probe re-run against the fixed module.
>
> **M5 and M6 were decisions, not code fixes**, exactly as this report insisted. Both were put to
> the repository owner and both were resolved in favour of the shipped product: `AGENTS.md` was
> corrected to describe what the database actually enforces. No client rule was loosened, and no
> client was made stricter than Postgres.
>
> **E1 is unchanged** — `fetch-odds` is still not deployed to the shared dev project. It is an
> environment fact, not a `webapp/src` defect, and it is not something a code change can fix.
>
> **Verification re-run after the fix pass:**
>
> | Command | Exit code | Result |
> |---|---|---|
> | `npx tsc --noEmit` (in `webapp/`) | **0** | no output |
> | `npm run build` (in `webapp/`) | **0** | `✓ 2184 modules transformed`, `✓ built in 1.50s` |
> | `grep -rnE "react-native\|expo-\|@expo\|EXPO_PUBLIC" webapp/src` | **1** | zero matches |
> | `npx tsc --noEmit` (repo root, mobile sources) | — | 0 errors in `app/`, `components/`, `hooks/`, `lib/`, `constants/`, `providers/` |
>
> The 1.05 MB single-chunk warning is **gone**: the largest chunk is now 493.59 kB (142.98 kB
> gzip), under Rollup's 500 kB advisory. See **S12**.
>
> **Where mobile shared a defect** (M1, M2, M3, M4, S4, S8, S11), mobile was fixed in the same
> change, as this report required. `lib/format.ts`, `lib/pick-labels.ts`, `lib/bet-outcome.ts` and
> `constants/rules.ts` remain **byte-identical** across `webapp/src/` and the repo root (`diff`
> exit 0), so V1 and V2 still hold.
>
> **What remains unverified:** the same two areas this report flagged — settlement states (test
> plan 11–14, 18, 21–22) and the Pick Board's game grid (**E1**). Additionally, the fix pass could
> not sign in to the running app (no credentials, and entering a password is out of scope for the
> agent), so the signed-in screens were verified by executing the shipped modules in the browser
> and by measuring the real compiled CSS, not by clicking through them.

Accounts exercised: `tester` (`6280d679…`, card = 3 straights + 1 parlay + 1 teaser) and
`Sunday Strategist` (`cd51ec3f…`, commissioner, card = 5 straights), in **WEB TEST LEAGUE**
(`1bff9316…`, H2H, Week 2 of a generated 14-week schedule + 3 playoff rounds).
A Season Pass was redeemed on `tester` with code `ACTION-S1-VIP` (supplied by the requester)
to reach the unlocked analytics and shop states.

Where a finding is a faithful port of mobile behaviour, that is stated explicitly. A fixer must
not "fix" the web client into disagreeing with `public.submit_bets` or with mobile.

---

## 1. Build and toolchain — CLEAN

| Command | Exit code | Output |
|---|---|---|
| `npx tsc --noEmit` (in `webapp/`) | **0** | no output |
| `npm run build` (in `webapp/`) | **0** | `✓ 2175 modules transformed`, `✓ built in 1.67s` |

`npm run build` runs `tsc --noEmit && vite build`, so the type check ran twice, both clean.
One non-blocking warning: `dist/assets/index-BxpIdiUl.js` is **1,054.38 kB** (287.87 kB gzip),
over Rollup's 500 kB advisory. Whole app is one chunk — no route-level code splitting. Noted
under SHOULD FIX.

## 2. Platform leakage — CLEAN

```
grep -rnE "react-native|expo-|@expo|EXPO_PUBLIC" webapp/src   →  exit 1, zero matches
```

Widened to all of `webapp/` (excluding `node_modules`, `dist`), exactly one hit, and it is a
comment, not code:

- `webapp/.env.example:6` — `# equivalents are the EXPO_PUBLIC_* keys in the repo root .env.`

The `__DEV__` global that ported `lib/` files reference is supplied by `vite.config.ts` `define`
and declared in `src/types/globals.d.ts`, rather than by editing each ported file. That is the
right call and it type-checks. **No React Native or Expo surface leaked into the web bundle.**

---

# MUST FIX

## M1 — The exact-$100 rule is computed in binary floating point, and rejects legal cards

**File:** `webapp/src/components/picks/pick-board-model.ts:729`, enforced at `:756-764`

```ts
729:  const totalAllocated = slipBets.reduce((sum, bet) => sum + bet.amount, 0);
...
756:  if (totalAllocated < WEEKLY_BUDGET) {
757:    errors.push(
758:      `Allocate ${formatCurrency(WEEKLY_BUDGET - totalAllocated)} more of your weekly budget.`,
759:    );
760:  }
762:  if (totalAllocated > WEEKLY_BUDGET) {
763:    errors.push(`You are ${formatCurrency(totalAllocated - WEEKLY_BUDGET)} over the weekly budget.`);
764:  }
```

`bet.amount` is a JS `number`. The database compares `sum((value ->> 'amount')::numeric) <> 100`
in Postgres `numeric`, which is exact decimal. The two disagree.

Coin amounts are freely decimal: `LineupRail.tsx:118-126` renders `inputMode="decimal"`
`type="number"`, and `getPickAmountError` (`pick-board-model.ts:704-718`) only rejects `<= 0`
and `> 35`.

**Proven against the shipped module**, not a reimplementation — `getValidationState` was imported
from the running dev server and called directly:

```
amounts:            [0.1, 0.1, 30.2, 34.8, 34.8]
decimal sum:        100          ← submit_bets accepts this
JS float sum:       99.999999999999985789
errors:             ["Allocate 0 coins more of your weekly budget."]
```

**What is wrong:** a card that allocates exactly $100 is refused by the client. Submit is hard
gated on this — `LineupRail.tsx:726` `const ready = validation.errors.length === 0 && …`,
`:875 disabled={!ready}` — so the player cannot submit at all. The error message is also
unactionable: it tells them to allocate **0 coins more**. There is no way out of the state
except guessing which pick to nudge.

Six such 5-pick cards were found by brute force over 0.10-increment amounts; the space is
much larger for 0.01 increments.

**Correct per AGENTS.md** ("Must allocate entire $100 budget exactly — no leftover, no
overage"): compare in integer cents, e.g. sum `Math.round(bet.amount * 100)` and compare
against `WEEKLY_BUDGET * 100`. That is exactly the DB's semantics.

**Direction:** client **stricter** than the database — blocks a legal pick.
**Mobile parity:** mobile has the identical float `reduce` at `app/(app)/(tabs)/bet-board.tsx:853`.
Fix both, or the same card fails on one platform and passes on the other.

> **RESOLVED.** The budget rule now sums in integer cents, which is exactly the DB's `numeric`
> semantics. `pick-board-model.ts` exports `WEEKLY_BUDGET_CENTS`, `toCents`, `getAllocatedCents`
> and `isFullyAllocated`, and every budget comparison on the board goes through them:
> `getValidationState` (the submit gate), `BudgetMeter`'s "Fully Allocated" state and its
> Remaining figure, the LineupRail footer, and the submit review dialog's "Allocated" line.
> A budget delta now formats to two decimals when it is not a whole coin, so the unactionable
> "Allocate 0 coins more" is gone.
>
> Mobile got the identical fix at `app/(app)/(tabs)/bet-board.tsx` — `getValidationState` and
> `BudgetTracker`'s `fullyAllocated`.
>
> **Same probe, re-run against the fixed module** (imported from the running dev server, as
> above):
>
> ```
> amounts:            [0.1, 0.1, 30.2, 34.8, 34.8]
> JS float sum:       99.999999999999985789     ← unchanged, and now unused
> allocatedCents:     10000
> WEEKLY_BUDGET_CENTS: 10000
> isFullyAllocated:   true
> errors:             []                        ← was ["Allocate 0 coins more of your weekly budget."]
> ```
>
> Also fixes the reachability half of **S10**: the coin field advertised `min={1} step={1}`, which
> is what made a sub-coin remainder easy to land on. It is now `min={0.01} step={0.01}`, matching
> the rule both the client and `submit_bets` actually enforce, and the field normalises to the
> stored two-decimal value on blur.

---

## M2 — A Season Pass holder can never buy a cosmetic, and every Equip button they press is rejected by the database

**File:** `webapp/src/components/shop/ShopItemCard.tsx:134`

```tsx
130:          {lockedExclusive ? (
133:            <Button disabled title="Pass Required" variant="secondary" />
134:          ) : owned || canUseSeasonPassItem ? (
138:              onClick={() => onEquip(item)}
139:              title={equipped ? 'Equipped' : 'Equip'}
...
146:              title={`Buy · ${item.cost}`}
```

`canUseSeasonPassItem` is a **global** "does this user hold a pass" boolean, not a per-item test:

```tsx
webapp/src/pages/Shop.tsx:174:  const canUseSeasonPassItem = Boolean(seasonPassQuery.data);
```

So once a pass exists, `owned || canUseSeasonPassItem` is true for **every item in the
catalogue**, and the `Buy · N` branch at `:146` becomes unreachable.

The correct per-item expression already exists **two lines away in the same file**, used for
the ownership counter:

```tsx
webapp/src/pages/Shop.tsx:175-177:
  const ownedCountForCategory = items.filter(
    (item) => ownedByItemId[item.id] || (item.seasonLabel && canUseSeasonPassItem),
  ).length;
```

**Observed on `tester` after redeeming the pass.** The Team Logos grid rendered its header as
`2/25 OWNED` — which is right — while 24 of 25 buttons read `Equip` and exactly one read
`Equipped`. Not a single `Buy`. The count and the button in the same card grid contradict
each other.

`tester`'s actual `user_cosmetics` rows (2 team logos):

```
logo_gridiron_wolf   equipped
s1_logo_founder      not equipped   ← the pass-exclusive grant
```

**The database rejects what the button offers.** Calling the equip RPC for a non-owned,
non-exclusive item the UI presented as equippable:

```
supabase.rpc('equip_cosmetic', { p_item_id: 'logo_blitz_fox' })
  → error P0001: "Purchase this cosmetic before equipping it"
```

(Verified in the same call that no `user_cosmetics` rows changed — the probe left no residue.)

**What is wrong:** this is the exact failure the audit brief describes — a client rule looser
than the database, surfacing as a rejection the user cannot explain. Worse, it is a dead end:
the Buy button they would need to satisfy the error is not rendered anywhere on the screen.
It also silently removes all cosmetic spending — the entire Arena Coins sink — from every
pass holder.

**Correct per AGENTS.md** ("Season Pass gates only premium extras: exclusive cosmetics…";
Arena Coins remain the purchase currency for the rest): line 134's condition must be
`owned || (item.seasonLabel && canUseSeasonPassItem)` — the expression already proven correct
at `Shop.tsx:176`.

**Mobile parity:** identical defect at `app/(app)/shop.tsx:241` with the same global flag at
`:425`. Fix both.

> **RESOLVED**, exactly as prescribed. Each card now derives a per-item
> `coveredByPass = Boolean(item.seasonLabel) && canUseSeasonPassItem` and the button branch reads
> `owned || coveredByPass`. Applied in all three places the defect lived:
> `components/shop/ShopItemCard.tsx`, `components/shop/CosmeticDetailModal.tsx` (a fourth copy
> this report did not reach), and mobile's `app/(app)/shop.tsx`.
>
> **Re-run against the real catalogue**, with `tester`'s actual rows (`logo_gridiron_wolf` owned,
> `s1_logo_founder` granted by the pass) and a redeemed pass:
>
> ```
> Team Logos, 25 items:   Equip 2, Buy 23        ← was: Equip 24, Equipped 1, Buy 0
> header "OWNED" count:   2
> equip count == header:  true                   ← the card grid and its own header now agree
> logo_blitz_fox:         "Buy"                  ← the item equip_cosmetic rejected with
>                                                   "Purchase this cosmetic before equipping it"
> ```
>
> The Arena Coins sink is restored for pass holders, and no button is offered that the database
> will refuse.

---

## M3 — A player who did not submit is reported to their opponent as "Cards reveal at first game kickoff"

**Files:** `webapp/src/components/matchups/matchup-sections.tsx:490-499`,
`webapp/src/components/matchups/bet-card.tsx:96-98` and `:163-186`

```tsx
matchup-sections.tsx:
490:  const hidden = !isUser && !visibility.isVisible;
491:  const notSubmittedRevealed = !isUser && visibility.isVisible && !visibility.isSubmitted;
492:  const statusLabel = hidden
493:    ? visibility.isSubmitted
494:      ? 'Submitted'
495:      : 'Not submitted'
...
499:  const hiddenMessage = hidden ? revealMessage(visibility.revealAt) : null;
```

Line 499 builds the reveal notice from `hidden` alone, ignoring `visibility.isSubmitted`, which
line 493 just consulted. `HiddenPicksPlaceholder` receives `submitted` but only swaps the *icon*
with it, never the copy:

```tsx
bet-card.tsx:
 96:  export function revealMessage(revealAt: string | null) {
 97:    return { body: 'Cards reveal at first game kickoff', time: formatRevealTime(revealAt) };
 98:  }
...
170:    const message = revealMessage(revealAt);
171:    const Icon = submitted ? Lock : Hourglass;   ← only the icon reacts to `submitted`
179:      <p …>{message.body}</p>                    ← copy is unconditional
```

The server already answers this question precisely, and the client throws the answer away.
`get_matchup_detail` returns a `hiddenReason` discriminant that is **declared and never read
anywhere in the web app**:

```ts
webapp/src/hooks/use-matchups.ts:26:
  hiddenReason: 'own_card' | 'revealed' | 'hidden_until_kickoff' | 'not_submitted' | 'no_user';
```

```
grep -rn "not_submitted|hidden_until_kickoff|own_card" webapp/src
  → webapp/src/hooks/use-matchups.ts:26   (the type declaration, and nothing else)
```

**Proven against real rows.** Calling `get_matchup_detail` for the Week 1 matchup as `tester`:

```json
"home": { "hiddenReason": "not_submitted",       "isSubmitted": false, "isVisible": false, "revealAt": null }
"away": { "hiddenReason": "own_card",            "isSubmitted": false, "isVisible": true,  "revealAt": null }
```

and for Week 2, showing the gate itself working correctly:

```json
"away": { "hiddenReason": "hidden_until_kickoff", "isSubmitted": true,  "isVisible": false, "revealAt": "2026-09-10T00:20:00+00:00" }
"home": { "hiddenReason": "own_card",             "isSubmitted": true,  "isVisible": true }
```

What Week 1 actually renders — the opponent column is internally contradictory, and the two
players' identical situations are described in two different ways:

```
OPPONENT CARD  Sunday Strategist   NOT SUBMITTED
   Cards reveal at first game kickoff
   REVEALS AT FIRST GAME KICKOFF
   Cards reveal at first game kickoff
   REVEALS AT FIRST GAME KICKOFF
YOUR CARD      tester              0 PICKS
   You haven't submitted any picks yet.
```

**What is wrong:** three defects in one component.
1. A player who filed nothing is described as having something that will be revealed. There is
   nothing to reveal, now or ever — Week 1 is already settled (recorded as a TIE).
2. `revealAt` is `null` for that week, so `formatRevealTime` falls back to the timeless
   `'Reveals at first game kickoff'` (`bet-card.tsx:81-84`) — a kickoff that has already passed.
3. The same sentence is rendered three times in one column (once in the Pick of the Week
   Showdown, twice in the opponent card).

**Correct:** switch on `hiddenReason`. `'not_submitted'` must render `DidNotSubmitPlaceholder`
— **which already exists**, unused on this path, at `bet-card.tsx:188-199` — matching the
"Did not submit" treatment the viewer's own side already gets. Only `'hidden_until_kickoff'`
should produce a reveal notice.

**Mobile parity:** same defect. `app/(app)/(tabs)/matchups/[matchupId].tsx:905-906` derives
`showHomeDidNotSubmit` from `isVisible && !isSubmitted`, so the hidden-and-not-submitted case
falls through to the reveal placeholder there too. `hiddenReason` is unread on mobile as well
(`hooks/use-matchups.ts:26` is its only occurrence).

> **RESOLVED.** `hiddenReason` is now read. A new `getPickVisibilityState(visibility, isUser)`
> (`components/matchups/bet-card.tsx`, exported through `components/matchups/index.ts`) collapses
> the server's discriminant into four states — `own` | `revealed` | `sealed` | `did_not_submit` —
> and every consumer switches on it: `BetColumnSection` (the opponent column) and
> `LockShowdownSide` (the Pick of the Week Showdown). Only `hidden_until_kickoff` produces a
> reveal notice; `not_submitted` renders `DidNotSubmitPlaceholder`, which this report correctly
> identified as already existing and unused on that path.
>
> All three sub-defects are gone:
> 1. A player who filed nothing is now described as "Did not submit", the same treatment the
>    viewer's own side gets.
> 2. `HiddenPicksPlaceholder` is now only reachable in the `sealed` state, so it can no longer
>    print a reveal time for a week with `revealAt: null`. Its `submitted` prop is gone and the
>    icon is unconditionally the lock, because that is the only case it now renders.
> 3. The duplicate sentence is gone — the section printed the reveal copy itself *and* passed the
>    same copy to the placeholder. The placeholder is now the only one that says it.
>
> Mobile got the same helper and the same three call sites in
> `app/(app)/(tabs)/matchups/[matchupId].tsx`, including the `LockShowdown` render gate at what
> was `:903-906`.
>
> **Re-run against the exact `get_matchup_detail` triples quoted above:**
>
> ```
> {hiddenReason: 'not_submitted',       isSubmitted: false, isVisible: false}  → did_not_submit
> {hiddenReason: 'own_card',            isSubmitted: false, isVisible: true }  → own
> {hiddenReason: 'hidden_until_kickoff',isSubmitted: true,  isVisible: false}  → sealed
> {hiddenReason: 'own_card',            isSubmitted: true,  isVisible: true }  → own
> {hiddenReason: 'revealed',            isSubmitted: true,  isVisible: true }  → revealed
> {hiddenReason: 'no_user',             isSubmitted: false, isVisible: true }  → did_not_submit
> (no discriminant, hidden + submitted)                                        → sealed
> (no discriminant, hidden + not submitted)                                    → did_not_submit
> ```
>
> The last two are a deliberate fallback: an older server that sends no discriminant degrades to
> the previous derivation rather than to a wrong answer.

---

## M4 — The same Pick of the Week shows two different potential payouts on three screens

Concretely, on `tester`'s Week 2 card — one teaser, $20 at −110, flagged Pick of the Week:

| Screen | Renders | Source |
|---|---|---|
| Pick Board | **REWARD 47 coins** · BASE 38 coins x 1.5 | `SubmittedBoard.tsx:100`, `:109` |
| Matchup detail | REWARD **38 coins** under a `PICK OF THE WEEK 1.5x` badge | `bet-card.tsx:232` |
| Bet detail | POTENTIAL **38 coins** under a `PICK OF THE WEEK 1.5x` badge | `BetDetail.tsx:190` |

```tsx
SubmittedBoard.tsx:100:   value: `${formatCurrency(getDisplayedPlacedPayout(bet))}…`
bet-card.tsx:232:         const displayedReward = isSettled ? getRealizedReward(bet) : bet.potential_payout;
BetDetail.tsx:189-190:    value={formatCurrency(isSettled ? getRealizedReward(bet) : bet.potential_payout)}
```

Only the Pick Board applies the multiplier, via
`getDisplayedPlacedPayout` (`pick-board-model.ts:544-552`):
`amount + (potential_payout − amount) × 1.5`.

**Which one is right:** the Pick Board. AGENTS.md — "The Lock bet receives a 1.5x multiplier on
profit and loss (wins pay 1.5x, losses cost 1.5x)" and "Win: profit = payout − amount". For $20
at −110: payout 38.18, profit 18.18, Lock profit 27.27, Lock payout **47.27**. The board's 47 is
correct; the other two under-report by 9 coins.

The aggravating factor is that both under-reporting screens print a **`PICK OF THE WEEK 1.5x`
badge directly above the un-multiplied number** (`bet-card.tsx:126-137`), so the UI asserts the
multiplier and then contradicts it.

Same defect on the commissioner's card: `New England Patriots`, $20 at +154 → Pick Board
`REWARD 66 / BASE 51 x 1.5`, bet detail `POTENTIAL 51`.

**Correct:** route all three through `getDisplayedPlacedPayout`, or drop the badge from the
screens that will not honour it.

**Mobile parity:** identical split — `app/(app)/(tabs)/bet-board.tsx:3327` uses the multiplied
value; `matchups/[matchupId].tsx:291` and `:1120`, and `bets/[betId].tsx:132`, use the raw
`potential_payout`. A faithful port of an existing product inconsistency, but it is still wrong
against AGENTS.md on both platforms.

> **RESOLVED**, and the rule now has exactly one definition. `getDisplayedPotentialReward` lives
> in `lib/bet-outcome.ts` beside `getRealizedReward` — the two are the same figure either side of
> settlement — and is byte-identical across web and mobile.
>
> Every screen that shows a pending payout routes through it. That turned out to be **five**
> copies of the multiplier, not the three this report found:
> `pick-board-model.getDisplayedPotentialPayout` and `.getDisplayedPlacedPayout` (Pick Board),
> `matchups/bet-card.tsx` (matchup detail), `pages/bets/BetDetail.tsx` (bet detail),
> `matchups/pick-detail-modal.tsx` and `profile/pick-language.getDisplayedHistoryPayout` — the
> last two were a fourth and fifth site the audit did not reach.
>
> Mobile: `app/(app)/(tabs)/matchups/[matchupId].tsx` (both occurrences) and
> `app/(app)/bets/[betId].tsx`.
>
> **Re-run on the verifier's own case** — one teaser, $20 at −110, flagged Pick of the Week:
>
> ```
> raw potential_payout:    38.18
> non-lock displayed:      38.18
> lock displayed:          47.27  → renders "47 coins"    ← was 38 on two of three screens
> ```
>
> 47 matches the Pick Board and matches AGENTS.md's arithmetic (payout 38.18, profit 18.18, Lock
> profit 27.27, Lock payout 47.27). The `PICK OF THE WEEK 1.5x` badge and the number under it now
> agree on every screen.

---

## M5 — Two Bet Types rules in AGENTS.md are enforced by nothing: not the web client, not mobile, not the database

The brief asked specifically about same-game conflict rules. Both directions were tested.

AGENTS.md states, under **Parlays** and **Teasers**:
> No two legs from the same game (no same-game parlays).

and under **Core Business Rules**:
> Cannot place multiple bets on the same side of the same game within the same league. One
> selection per game per league, across all bet types.

**Neither is implemented anywhere.** Three cards were constructed and passed to the shipped
`getValidationState`, imported live from the dev server. All three returned **zero errors and
zero warnings**:

| Card | AGENTS.md verdict | `getValidationState` |
|---|---|---|
| A — same selection (`Dallas Cowboys −3.5`) in a straight **and** as a parlay leg | forbidden | `errors: []` |
| B — parlay with `Cowboys ML` + `Over 45.5` **from the same game** | forbidden | `errors: []` |
| C — teaser with `Cowboys −1.5` + `Over 39.5` **from the same game** | forbidden | `errors: []` |

The database accepts all three as well. `public.pick_conflict_kind`
(`supabase/migrations/20260530120000_pick_board_triple_conflict_rules.sql`) returns `null` — no
conflict — whenever the markets differ or the sides are the same:

```sql
when not coalesce(p_left_market = p_right_market, false) then null
when left_side = right_side then null
```

and `submit_bets` has no same-game leg check of any kind. Migration
`20260507120000_relax_same_game_combo_validation.sql` deliberately relaxed this, and
`20260530120000_…` dropped the last uniqueness index (`bet_legs_unique_bet_market_side_line_idx`).

**Direction:** client is **looser** than AGENTS.md, and **exactly matches** the database and
mobile. There is no rejected submission today.

**This is a decision, not a code fix — and the fixer must not resolve it unilaterally.** Tightening
the web client alone would make it stricter than the database and block picks Postgres accepts,
which is the other failure mode this audit was asked to prevent. Either:
- the shipped relaxed rule is intended → **AGENTS.md's Bet Types and Core Business Rules text is
  stale and should be corrected**, matching what the test plan already documents under *Current
  Product Notes* ("allowed: moneyline + total and spread + total from the same game"); or
- the strict rule is intended → it must be added to `public.picks_directly_conflict` **first**,
  then mirrored in `lib/pick-conflicts.ts` on both platforms.

Related staleness in the same area: the test plan's *Current Product Notes* claims same-team
moneyline + spread is blocked. It is **not**. `20260520120000_block_same_team_ml_spread_conflicts.sql`
added a `'same_team_moneyline_spread'` case, and `20260530120000_pick_board_triple_conflict_rules.sql`
— which is later — replaced the function and removed it. Web and mobile agree with the current DB.

> **RESOLVED as a decision, not a code change** — this report's instruction to the fixer was
> followed. The choice was put to the repository owner, who selected *"correct AGENTS.md to the
> shipped rule"*: the relaxed behaviour is intended, and the doc was stale.
>
> **No code changed.** `lib/pick-conflicts.ts`, `public.picks_directly_conflict` and
> `public.pick_conflict_kind` are untouched on both platforms; the client is neither stricter nor
> looser than Postgres than it was.
>
> `AGENTS.md` was corrected in three places:
> - **Bet Types → Parlays** — the "No two legs from the same game" bullet is replaced by a
>   statement that any mix of markets is allowed including two from one game, citing
>   `20260507120000_relax_same_game_combo_validation.sql`.
> - **Bet Types → Teasers** — same-game legs follow the parlay rule.
> - **Core Business Rules** — "One selection per game per league" is replaced by the predicate the
>   database actually implements: only *directly contradicting* selections conflict (same market,
>   opposite sides of one game), naming `picks_directly_conflict` / `pick_conflict_kind` and
>   `lib/pick-conflicts.ts`, and stating explicitly that moneyline + total, spread + total, and
>   same-team moneyline + spread all pass.
>
> The test plan's *Current Product Notes* was corrected too: it claimed same-team moneyline +
> spread is blocked. It now records that `20260520120000_…` added that case and the later
> `20260530120000_…` removed it, so the three cards this report constructed (A, B and C) are all
> legal, on the client and in the database alike.

---

## M6 — AGENTS.md and the shipped product disagree on when a multi-leg pick locks

AGENTS.md, Core Business Rules:
> For parlays/teasers: if any leg hasn't locked yet, the entire multi-leg bet can still be edited
> or cancelled. **Once all legs are locked, the bet is fully locked.**

The shipped rule is the opposite — **any** locked leg locks the parent:

```ts
webapp/src/lib/pick-locking.ts:14-16:
  export function isParentPickLocked(pick: LockablePick, now = Date.now()) {
    return pick.bet_legs.some((leg) => isBetLegLocked(leg, now));
  }
```

The database agrees with the code, not the doc:

```sql
supabase/migrations/20260508130000_post_submit_pick_editing.sql (update_submitted_bet):
  if exists (select 1 from public.bet_legs bl
             where bl.bet_id = p_bet_id and (bl.locked or bl.game_start_time <= now()))
  then raise exception 'This pick is locked because one of its games has started';
```

and `set_pick_of_week` carries the same `any leg` guard.

**Direction:** client matches the database and mobile exactly; **AGENTS.md is the outlier.**
`webapp/src/lib/pick-locking.ts` is byte-identical to `lib/pick-locking.ts`, and the client's
gates mirror the RPC's three conditions faithfully (`pick-board-model.ts:919-931` — settled,
any leg locked; `Picks.tsx:695-698`; `Picks.tsx:175-176` + `:722-726` for the reveal-time gate).

**Resolution:** the test plan's *Current Product Notes* already documents the shipped behaviour
("multi-pick cards lock according to current implementation when a leg's game has started"), so
the likely fix is to **correct the AGENTS.md sentence**. Flagged because AGENTS.md is the stated
source of truth and a fixer reading only that line would loosen the client into disagreement
with `update_submitted_bet` — producing exactly the unexplainable rejection this audit hunts.

> **RESOLVED as a decision, not a code change**, exactly as this report recommended. Put to the
> repository owner, who selected *"correct the AGENTS.md sentence"*.
>
> **No code changed.** `lib/pick-locking.ts` is untouched and still byte-identical across
> platforms; `isParentPickLocked` still returns true when **any** leg is locked, matching
> `update_submitted_bet` and `set_pick_of_week`. The client was **not** loosened — doing so is the
> trap this finding exists to prevent.
>
> The AGENTS.md bullet now reads that a multi-leg pick locks as soon as any one of its legs' games
> has started, names the two RPCs and the `bl.locked or bl.game_start_time <= now()` guard they
> raise on, names `isParentPickLocked` as the client mirror, and states outright that loosening
> the client here would let a player edit a pick whose first game is in progress and have Postgres
> reject the write.
>
> The test plan's vaguer wording ("according to current implementation") was tightened to the same
> sentence, so neither document can be read as licence to loosen it.

---

# SHOULD FIX

## S1 — QueryClient ships on library defaults: 3 retries and refetch-on-focus, and the port changed their meaning

```tsx
webapp/src/providers/app-providers.tsx:6:  const queryClient = new QueryClient();
```

No options at all. The brief describes this as "retry 3 with refetchOnWindowFocus" — accurate in
effect, but worth stating precisely: **nothing is configured**. These are TanStack Query v5
defaults, inherited silently. Any reader auditing this file sees no policy and cannot tell that
one is in force.

**Judgement: these defaults are wrong for this app, and more wrong on web than they were on mobile.**

1. **Seven seconds of skeleton before any error appears.** v5's default backoff is
   `min(1000 · 2^attempt, 30000)` → 1s + 2s + 4s ≈ 7s of retries before the query settles into
   error. This compounds directly with S2: the eight screens that never render an error state
   simply never leave the skeleton.
2. **Retrying is pointless for this app's dominant failure mode.** Most failures here are RLS
   denials and Postgres `raise exception` messages — deterministic, and identical on attempt 4.
   The retry budget buys nothing and costs the user seven seconds.
3. **`refetchOnWindowFocus` is a genuine web-only behaviour change, not a ported one.** Mobile has
   the byte-identical `new QueryClient()` (`providers/app-providers.tsx:8`), but React Native has
   no window-focus event and no `focusManager` binding, so on mobile the default is inert. In a
   desktop browser — where tab-switching is constant — every return to the tab restarts the
   whole 7-second cycle on a failing query. The same line of code behaves differently after the
   port, which is precisely the class of divergence a parallel port is expected to miss.
4. **No `staleTime`**, so every mount refetches. The hooks that need it set it locally
   (`use-odds.ts:21` `staleTime: 5min`, `:49`), which shows the intent existed but never made it
   to the root.

**Recommended:** set explicit defaults — `retry: 1` (or a predicate that does not retry 4xx/RLS
errors), a modest `staleTime` (~30s), and `refetchOnWindowFocus: false` for a client where the
only genuinely live data (`league_week_reveal_time`, live scores) already carries its own
`refetchInterval`. Whatever is chosen, write it down rather than inheriting it.

> **RESOLVED**, with the recommended values. `providers/app-providers.tsx` now declares
> `retry: 1`, `staleTime: 30_000` and `refetchOnWindowFocus: false`, with a comment recording why
> each one is set — including the point this report makes about `refetchOnWindowFocus` being inert
> on React Native and live on the web, so the next reader cannot mistake the divergence for an
> oversight. The ~7s skeleton-then-error window is now ~1s, which matters because it compounds
> with S2.

## S2 — Eight data screens have skeletons but no error state, so a failed query renders a false empty state

Every page below uses `Skeleton` and reads `query.data ?? []`, but contains no `isError` branch.
When the query fails, the fallback `[]` flows into the empty state, and the screen confidently
tells the user they have no data — when in fact the fetch failed.

```
grep -L "isError" over webapp/src/pages/**  (data screens only):
  src/pages/Home.tsx
  src/pages/Leaderboard.tsx
  src/pages/Profile.tsx
  src/pages/bets/BetDetail.tsx
  src/pages/leagues/LeagueDetail.tsx
  src/pages/matchups/MatchupDetail.tsx
  src/pages/matchups/MatchupsIndex.tsx
  src/pages/members/MemberDetail.tsx
```

"No picks placed for this matchup" and "You haven't submitted any picks yet" are materially
alarming things to show a player whose picks merely failed to load. With S1's 7-second retry
window in front of it, the sequence is: 7s of skeleton, then a wrong answer.

Screens that **do** handle it correctly, for contrast: `Picks.tsx:909-937` distinguishes loading,
error (`oddsQuery.isError`, surfacing `oddsQuery.error.message`) and genuinely-empty slate; and
`Home.tsx:495-499` gates its no-slate banner on `oddsQuery.isSuccess`, so an odds failure
degrades safely rather than claiming there are no games.

**Correct per AGENTS.md** ("Empty states: Every screen that could be empty gets a helpful
illustration/message and a clear CTA" / "Loading states: Skeleton loaders everywhere"): an empty
state must mean empty. Add an error branch with a retry affordance to the eight screens above.

> **RESOLVED.** A shared `components/ui/QueryErrorState.tsx` renders the error branch: an alert
> icon, a title, the **server's own message** where there is one (an RLS denial or a Postgres
> `raise exception` is the useful half of what goes wrong here), and a Try Again button wired to
> the query's `refetch`. It follows the model this report points at — `Picks.tsx:909-937`.
>
> Wired into all eight screens, plus one more:
>
> | Screen | Error branch replaces |
> |---|---|
> | `Home.tsx` | "no leagues yet" — and separately in `StandingsSnapshot`, "standings appear once the first week is settled" |
> | `Leaderboard.tsx` | "No Standings Yet — join a league", shown to a player already in one |
> | `Profile.tsx` | a bare "Profile data is unavailable." |
> | `bets/BetDetail.tsx` | a retry that conflated "failed" with "not found" — now split, so a clean fetch returning nothing says the pick does not exist or has not revealed |
> | `leagues/LeagueDetail.tsx` | "You may need to join this league before viewing it" — reported to a member on a network failure |
> | `matchups/MatchupDetail.tsx` | `MatchupUnavailable` / "no matchup scheduled this week" |
> | `matchups/MatchupsIndex.tsx` | "No Leagues Yet" on the week cards, and the history table's "no settled matchups yet" |
> | `members/MemberDetail.tsx` | a bare "Member profile is unavailable." |
>
> Every one of these now distinguishes *failed* from *empty*, so an empty state means empty.

## S3 — Four independent copies of the bet-type colour language, and they have already drifted

AGENTS.md: "Parlays always carry the amber accent… Teasers always carry the cyan accent. This
color coding should be consistent across every screen." There are four separate implementations:

| Definition | Parlay bg | Straight bg | Border |
|---|---|---|---|
| `components/picks/pick-board-model.ts:266-283` (`getModeTone`/`modeAccentHex`/`BET_TYPE_TEXT_CLASS`) | text only | text only | — |
| `components/matchups/bet-card.tsx:46-66` (`betTypeAccent`) | `bg-amber-accent/[0.05]` | `bg-white/[0.03]` | `/35` |
| `components/profile/pick-language.tsx:73-101` (`BET_TYPE_META`) | `bg-amber-accent/[0.08]` | `bg-white/[0.04]` | `/35` |
| `components/leagues/SharedBetCard.tsx:15-19` (`betTypeAccent`) | hex only | hex only | — |

They have **already diverged**: a parlay card is 5% amber on the matchup screen and 8% amber on
the profile screen; a straight is `white/[0.03]` vs `white/[0.04]`. Two of the four are even
named the same thing (`betTypeAccent`) in different files with different return shapes.

Labels have drifted too — the same group of picks is called two different things:

```ts
pick-board-model.ts:291-294:  BET_TYPE_GROUP_LABEL  straight: 'Straight Picks'
pick-language.tsx:83-91:      BET_TYPE_META         straight: label 'Straights'
```

Both are user-visible: the Pick Board confirm dialog (`dialogs.tsx:136`) says "Straight Picks",
the Profile breakdown says "STRAIGHTS".

**Correct:** one exported mapping — the canonical one is `pick-board-model.ts` — returning the
full token set (hex, text, bg, border, bar, label), consumed by all four call sites. Today,
changing the parlay accent requires four edits and silently misses three of them. Note this
mapping lives under `components/picks/`, not `src/lib/`; promoting it to `src/lib/bet-type-theme.ts`
would match where the other shared primitives already live.

> **RESOLVED**, at the suggested path. `src/lib/bet-type-theme.ts` holds one `BET_TYPE_THEME`
> table with the full token set — `hex`, `textClass`, `bgClass`, `borderClass`, `barClass`,
> `icon`, `label`, `groupLabel`, `tone` — plus `betTypeTheme` / `betTypeHex` / `betTypeTone`.
>
> All four originals now delegate to it and keep their local names, so no call site changed:
> `pick-board-model` (`getModeTone`, `modeAccentHex`, `BET_TYPE_TEXT_CLASS`, `BET_TYPE_LABEL`,
> `BET_TYPE_GROUP_LABEL`), `matchups/bet-card.betTypeAccent`, `profile/pick-language.BET_TYPE_META`
> and `leagues/SharedBetCard`. A **fifth** copy this report did not list — `components/ui/Badge`'s
> own `toneByBetType` / `defaultBetTypeLabels` — reads from it too.
>
> The two drifts are gone: parlay backgrounds were 5% amber on the matchup screen and 8% on the
> profile screen and are now one value; straights were `white/[0.03]` and `white/[0.04]` and are
> now one. The label split is resolved on **"Straights"** — the Pick Board submit dialog said
> "Straight Picks" and the profile breakdown said "STRAIGHTS"; the shorter form wins because it
> sits beside "Parlays" and "Teasers".
>
> Two coverage gaps found while consolidating, both fixed against AGENTS.md's "consistent across
> every screen": the **submitted** pick card on the Pick Board carried no bet-type accent at all
> (a parlay and a straight were identical apart from the badge, even though the *staged* card in
> the rail does carry it), and the weekly-awards pick box and Home's pick rows were hardcoded
> green. All three now take their bet type's border and background, with a settled result and the
> gold Pick of the Week still outranking the bet type.

## S4 — `REGULAR_SEASON_WEEKS` declared three times, and the week label is wrong during the playoffs

```
webapp/src/constants/rules.ts:11               export const NFL_REGULAR_SEASON_WEEKS = 14;   ← canonical
webapp/src/components/picks/pick-board-model.ts:63  export const REGULAR_SEASON_WEEKS = 14;
webapp/src/pages/matchups/MatchupDetail.tsx:37      const REGULAR_SEASON_WEEKS = 14;          ← bare local literal
```

`LeagueDetail.tsx:277` does it correctly — imports `NFL_REGULAR_SEASON_WEEKS` from
`constants/rules.ts`. `MatchupDetail.tsx:37` is web-only sprawl with no mobile counterpart:
it redefines the constant privately rather than importing the one two directories away.
`constants/rules.ts` also already exports `NFL_PLAYOFF_WEEKS = 3` and
`DEFAULT_LEAGUE_SEASON_WEEKS = 17`, neither of which is used anywhere in `webapp/src`.

Downstream effect: `WeekNavigator` defaults `maxWeek = 14` (`WeekNavigator.tsx:5`) and renders
`Week {week} of {maxWeek}`. AGENTS.md specifies "14 regular weeks + 3 playoff weeks", and
`leagues.status` has a `'playoffs'` value. In weeks 15–17 the header reads **"WEEK 15 OF 14"**,
and the forward arrow is disabled (`:14 canGoNext = week < maxWeek`) so playoff weeks cannot be
navigated to for review.

Not a hard block on play — `Picks.tsx:139` defaults `viewedWeek` to `selectedLeague.current_week`,
so a player still lands on the live playoff week — which is why this is SHOULD rather than MUST.
**Correct:** drive `maxWeek` from `NFL_REGULAR_SEASON_WEEKS + NFL_PLAYOFF_WEEKS` (or the league's
own season length), and delete the two duplicate constants.
**Mobile parity:** mobile has the same 14 ceiling (`bet-board.tsx:213`, `:5253`;
`components/ui/week-navigator.tsx:9`), but only two copies, not three.

> **RESOLVED**, as prescribed. `constants/rules.ts` now derives
> `NFL_SEASON_WEEKS = NFL_REGULAR_SEASON_WEEKS + NFL_PLAYOFF_WEEKS` so it cannot drift, and adds
> `NFL_PLAYOFF_ROUND_LABELS` and `getNflWeekLabel`. Both duplicate constants are deleted —
> `pick-board-model.REGULAR_SEASON_WEEKS` and `MatchupDetail.tsx`'s bare local literal — and
> `NFL_PLAYOFF_WEEKS`, previously unused, now drives `SchedulePanel`'s playoff placeholder weeks.
>
> `WeekNavigator` defaults `maxWeek` to `NFL_SEASON_WEEKS`, so the forward arrow reaches the
> playoffs, and every call site drops its explicit `maxWeek` and takes the default. The header no
> longer reads "WEEK 15 OF 14": past the regular season it names the round — `Playoff Round 1`,
> `Semifinals`, `Championship`, the same three labels `SchedulePanel` already used, now shared —
> and switches from the green calendar treatment to a gold trophy one.
>
> Mobile got the same fix and, since `constants/rules.ts` is byte-identical across platforms, the
> same constants: `components/ui/week-navigator.tsx` plus **three** local copies of the literal
> (`bet-board.tsx`, `matchups/[matchupId].tsx`, `leagues/[leagueId].tsx` — one more than this
> report counted), all deleted.

## S5 — Season Pass and Shop keep selling the pass to people who already own it

After redeeming `ACTION-S1-VIP` on `tester`, with the page correctly showing `PASS ACTIVE` /
`Season Pass active`:

- `/season-pass` still renders, on the same screen: **"WEB IS READ-ONLY — Season Pass purchases
  are only enabled for iOS at launch. Redeem a Season Pass code instead."** plus a
  `RESTORE IN THE IOS APP` button. An active holder is being told to redeem a code.
- `/shop` still renders the banner **"Unlock the Season Pass for exclusive drops"** to a holder.

**Correct:** gate both on the same `seasonPassQuery` state the `PASS ACTIVE` badge already reads
(`Shop.tsx:174`, `pages/SeasonPass.tsx`). Since M2 lives in the same screen and the same query,
these are worth fixing together.

> **RESOLVED**, gated on that exact query, and fixed alongside M2 as suggested.
>
> `/season-pass`: for a holder, the entire purchase surface is gone — no `IosOnlyNotice`, no
> disabled Buy, no disabled Restore, no redeem-a-code field. In its place is a single success
> notice: "Season Pass active. Nothing else to buy — every perk below is already yours." The body
> copy switches too, from a pitch to a statement that the perks are unlocked on this account on
> web and iOS. A holder is never again told to go redeem a code.
>
> `/shop`: the gold banner now reads "Season Pass active — your exclusive drops are unlocked" for
> a holder, and keeps "Unlock the Season Pass for exclusive drops" for everyone else. Both link to
> `/season-pass` as before.

## S6 — Member Profile reports "0 picks" when the server is deliberately redacting

`/members/cd51ec3f-…` (the commissioner, viewed as `tester`) renders `PICK HISTORY — All leagues ·
0 picks`, an empty pick list, and `0 placed` on every bet type — while that player has five
submitted Week 2 straights.

This is **not** a data bug. The gate is correctly enforced server-side by RLS; querying as
`tester` returns zero rows:

```
supabase.from('bets').select().eq('user_id','cd51ec3f-…')  →  0 rows   (no error)
supabase.from('bets').select().eq('user_id','6280d679-…')  →  5 rows   (own card)
```

The defect is presentational, and it is the same root cause as M3: the screen renders a blank
empty state instead of explaining that opponent picks are hidden until first kickoff. A player
comparing this against the league's Members list — which shows that opponent as having submitted
— will read it as data loss.

**Correct:** show the hidden-until-kickoff state here, as the matchup screen does (once M3 is
fixed), rather than an empty history.

> **RESOLVED.** `PickHistory` takes an optional `emptyHint`, shown in place of "No picks match
> these filters." when the source list is empty *before* any filter runs — the case that means
> redaction rather than a filter miss. `ProfileContent` threads it through as `emptyHistoryHint`,
> and `MemberDetail` supplies it only when the profile is not the viewer's own:
>
> > "No picks are visible yet. Opponent cards stay sealed until each week's first kickoff, and
> > revealed picks show up here automatically."
>
> The screen no longer reports "0 picks" as though it were data. The count in the header is
> genuinely the number of *visible* picks — the RLS gate is server-side and correct, as this
> report established — so the fix is the explanation, not the number.

## S7 — Settings duplicates the full notification toggle list without the caveat that makes it truthful

`/notifications/preferences` leads with an unmissable disclosure: `THESE CONTROL PUSH` /
`MOBILE ONLY` / "every switch below decides what the Action Arena **iOS app** is allowed to push
… this browser receives no push notifications either way".

`/settings` renders the **same eight toggles**, writing to the same account fields, under the
heading `NOTIFICATION PREFERENCES / FULL ALERT CONTROL` — with none of that context. A user who
only ever opens Settings is given no way to learn the switches do nothing in the browser they
are sitting in.

**Correct:** either carry the same disclosure into the Settings block, or reduce Settings to a
link into `/notifications/preferences` rather than a second copy of the control surface.

> **RESOLVED** by the first option, and by making the caveat impossible to separate from the
> controls again. The disclosure is now one component,
> `components/notifications/PushScopeNotice.tsx`, rendered by **both** surfaces: full size on
> `/notifications/preferences` (where it replaces the inline copy) and `compact` directly above
> the toggle list in `/settings`. Same wording, same link to the in-app inbox, one source. A user
> who only ever opens Settings is now told that the switches control iOS push and that this
> browser receives none either way.

## S8 — Teaser point size is missing from the submitted Pick Board card

`webapp/src/lib/pick-labels.ts:107` builds placed-pick labels as:

```ts
return `${bet.bet_legs.length}-leg ${bet.bet_type}`;
```

so `tester`'s teaser renders as **"2-LEG TEASER"** on the Pick Board with no point size, even
though 6/6.5/7 changes both the odds and every line. Bet detail gets it right —
`/bets/ae489e76-…` renders **"6-POINT TEASER · 2 LEGS"** — so the Pick Board is the outlier.
The size is inferable from the `49.5 → 43.5` movement, which is why this is minor.

**Mobile parity:** `lib/pick-labels.ts` is byte-identical, so mobile shares it.

> **RESOLVED** in the shared file, so both platforms get it and the two stay byte-identical.
> `PickTitleBet` gains an optional `teaser_points`, and `formatPickTitle` returns
> `"{n}-point teaser · {legs} legs"` for a teaser that has one, falling through to the old
> `"{n}-leg {type}"` for parlays and for a teaser without a size.
>
> ```
> formatPickTitle({bet_type: 'teaser', teaser_points: 6, bet_legs: [·, ·]})
>   → "6-point teaser · 2 legs"          ← was "2-leg teaser"
> ```
>
> The Pick Board card, the matchup card, the pick detail modal, profile history, league chat and
> Home all read `formatPickTitle`, so the size now travels everywhere rather than only to bet
> detail. Bet detail's own hand-rolled `{teaser_points}-point teaser · {legs} legs` line was
> removed as a duplicate of the title directly above it.

## S9 — Capped-parlay predicates disagree with each other by one boundary

```ts
pick-board-model.ts:540:  (bet.rawPotentialReward ?? bet.potential_payout) > PARLAY_PAYOUT_CAP   // staged
pick-board-model.ts:555:  bet.bet_type === 'parlay' && bet.potential_payout >= PARLAY_PAYOUT_CAP  // placed
```

A parlay whose true payout is exactly $500 is *not* labelled capped while staged, then *is*
labelled "capped" after submission (`SubmittedBoard.tsx:101`). The label flips on submit for a
bet that was never actually capped. Reachable, if narrow. Pick one comparison.

> **RESOLVED.** One comparison picked — strictly-greater-than, because "capped" means the payout
> was *cut*, and a parlay paying exactly $500 was never cut. Both predicates now call a single
> `exceedsParlayCap(rawPayout)`.
>
> The staged bet still knows its raw reward. A placed one does not — its stored `potential_payout`
> is already the capped figure — so `isCappedPlacedParlay` recomputes the raw payout from the
> stake and the stored combined odds, which is what produced that figure in the first place. It
> now takes `amount`/`bet_type`/`odds` rather than `potential_payout`.
> `profile/pick-language.isCappedHistoryParlay` — a third copy of the `>=` comparison — delegates
> to it.
>
> ```
> $20 @ +2400     → raw payout exactly 500   → capped: false   ← was true after submitting
> $35 @ +99999900 → raw payout 35,000,000    → capped: true
> ```
>
> The label no longer flips on submit.

## S10 — Coin field's HTML constraints contradict the rule it enforces

```tsx
LineupRail.tsx:118-126:  inputMode="decimal"  type="number"  min={1}  step={1}  max={MAX_SINGLE_BET}
```

`min={1}` and `step={1}` advertise whole coins ≥ 1, but the actual rule — client
(`pick-board-model.ts:709-715`) and database (`submit_bets`: `amount > 35 or amount <= 0`) — is
"greater than 0, at most 35", decimals allowed. So $0.50 and $20.50 are legal and accepted while
the browser marks the field `:invalid`, and `step={1}` is what makes the M1 float bug reachable
in the first place.

Separately, `Picks.tsx:562` parses the raw text while `updateSlipBetAmount`
(`pick-board-model.ts:459`) stores `Number(amount.toFixed(2))`, so typing `20.999` leaves
`20.999` visible in the field while the pick is worth `21`. Align the input constraints with the
rule, or round on blur so the field shows what will be submitted.

> **RESOLVED**, both halves. The coin field is now `min={0.01} step={0.01}` — the rule the client
> and `submit_bets` actually enforce ("greater than 0, at most 35, decimals allowed"), so $0.50
> and $20.50 no longer mark the field `:invalid`. And the field normalises on blur to
> `Number(parsed.toFixed(2))`, the value that will actually be stored, so typing `20.999` leaves
> `21` on screen rather than a figure the pick is not worth.
>
> This also removes what made **M1** easy to reach: `step={1}` was steering players onto whole
> coins, and the float bug lived in the sub-coin remainders.

## S11 — Parlay odds can render as an eight-digit number beside a capped payout

`makeParlaySlipBet` stores true combined odds and a capped payout. Six legs at +900:

```
odds: 99999900   potential_payout: 500   rawPotentialReward: 35000000
```

The payout cap is applied correctly (AGENTS.md "$500 cap" — verified, see V6), but the board
displays `+99,999,900` next to `500 coins`. Unreachable with realistic NFL lines; worth a
display clamp if the odds figure is ever shown for large parlays. `bets.odds` is `int`, and
this value still fits.

> **RESOLVED** with a display clamp, in `lib/format.formatAmericanOdds` itself — so every one of
> the ~10 places odds are rendered gets it, on both platforms, with no call site rewired and no
> dead code left on either. The stored value is untouched; nothing downstream reads the string.
>
> ```
> formatAmericanOdds(99999900) → "+99999+"
> formatAmericanOdds(-110)     → "-110"      ← real lines are nowhere near the ceiling
> ```

## S12 — Single 1.05 MB JS bundle

`dist/assets/index-BxpIdiUl.js` — 1,054.38 kB raw, 287.87 kB gzip, over Rollup's advisory. Every
route, including `/terms` and `/privacy`, is in one chunk. `React.lazy` on the route elements in
`App.tsx` is the natural split for a desktop SPA behind a login.

> **RESOLVED** with `React.lazy` on the route elements, as suggested. 23 routes are now lazy,
> behind one `<Suspense fallback={<FullPageLoader />}>` — the same loader the auth guards already
> show. Four stay eager because they can be a player's *first* paint, where a Suspense fallback is
> a flash of nothing: `/login`, `/signup`, `/onboarding` and the 404.
>
> ```
> before:  dist/assets/index-BxpIdiUl.js   1,054.38 kB  (287.87 kB gzip)   ← Rollup warning
> after:   dist/assets/index-G7LQobUj.js     493.59 kB  (142.98 kB gzip)   ← no warning
>          + 104 route and shared chunks, e.g. Picks 64.79 kB, LeagueDetail 47.58 kB,
>            MatchupDetail 33.69 kB, Terms 0.99 kB, Privacy 8.90 kB
> ```
>
> **All 28 routes were re-walked after the split** — every one renders, every guarded route
> redirects to `/login` rather than crashing, and the console is clean. This re-confirms **V13**
> against the new chunk graph.

---

# ENVIRONMENT — blocks live-odds verification (not a `webapp/src` defect)

## E1 — The `fetch-odds` Edge Function is not deployed to the shared dev project

The browser console fills with:

```
Access to fetch at 'https://kgrtfhyrbgifeolwtbep.supabase.co/functions/v1/fetch-odds'
from origin 'http://localhost:5173' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check: It does not have HTTP ok status.
```

The CORS message is a symptom, not the cause. Probing the preflight directly:

```
OPTIONS /functions/v1/fetch-odds        → 404   sb-error-code: NOT_FOUND
OPTIONS /functions/v1/sync-live-scores  → 405
OPTIONS /functions/v1/settle-bets       → 405
OPTIONS /functions/v1/delete-account    → 204
OPTIONS /functions/v1/process-notifications → 405
```

Every other function answers; `fetch-odds` alone returns 404. It is simply not deployed. The
function's own source is correct — `supabase/functions/fetch-odds/index.ts:42-44` sets the CORS
headers and `:143-148` answers `OPTIONS` with 204.

Consequence, proven by calling the shipped module in the browser:

```
fetchUpcomingNflOdds()                      → throws "Unable to load odds right now…"
fetchUpcomingNflOdds({allowMockOdds:false}) → throws "Unable to load odds right now…"
fetchUpcomingNflOdds({allowMockOdds:true})  → 16 games (mock_nfl_w01_dal_phi, …)
```

Note `VITE_USE_MOCK_DATA=true` is **not sufficient** on its own —
`odds-api.ts:255` requires `isUsingMockOdds && options.allowMockOdds`, and
`Picks.tsx:137` only passes `allowMockOdds` for an App-Store-capture league
(`useUpcomingNflOdds({ allowMockOdds: Boolean(appStoreCaptureMode) })`), while `Home.tsx:490`
never passes it. This gating is **identical to mobile** (`hooks/use-odds.ts:9-23`,
`bet-board.tsx:4383`, `app/(app)/(tabs)/index.tsx:920`), so this is not a port defect — and
mobile would fail against this project too.

**Impact on this audit:** the Pick Board's game grid could not be exercised, because both test
accounts have already submitted Week 2 and no slate loads for an unsubmitted card. The builder
paths (staging straights/parlays/teasers, live conflict prompts, the $500 cap warning in situ)
were therefore verified by executing the shipped model directly rather than by clicking.
The Pick Board's own handling of this failure is correct — see V12.

**To fix:** deploy `fetch-odds`, or point `webapp/.env` at a project where it exists.

---

# VERIFIED CORRECT

Stated explicitly so the next agent does not re-audit these.

**V1 — Rule constants.** `webapp/src/constants/rules.ts` is **byte-identical** to
`constants/rules.ts` (`diff` exit 0). `WEEKLY_BUDGET 100`, `MINIMUM_BETS_PER_WEEK 5`,
`MAX_SINGLE_BET 35`, `PARLAY_PAYOUT_CAP 500`, `LOCK_OF_THE_WEEK_MULTIPLIER 1.5` — all match
AGENTS.md exactly.

**V2 — Ported `lib/` layer.** `diff` is empty for all twelve shared files:
`pick-conflicts.ts`, `pick-locking.ts`, `bet-outcome.ts`, `settled-bets.ts`, `bets-with-legs.ts`,
`format.ts`, `live-pick-status.ts`, `pick-labels.ts`, `matchup-language.ts`, `home-results.ts`,
`league-settings.ts`, `nfl-teams.ts`. Byte-identical ports, no drift. (`invite-code.ts` is
web-only, correctly so — mobile has no equivalent URL entry point.)

**V3 — `getValidationState` mirrors `submit_bets` clause for clause.** Every rule in
`public.submit_bets` was checked against `pick-board-model.ts:728-805`:

| `submit_bets` | Client | Match |
|---|---|---|
| `submitted_count < 5` | `:735` | ✓ |
| `submitted_lock_count <> 1` | `:742-746` (0 and >1 both caught) | ✓ |
| `amount > 35 or amount <= 0` | `:748-754` | ✓ |
| `submitted_total <> 100` | `:756-764` | ✗ — see **M1** (float) |
| direct conflicts | `:731`, `:766` via shared `areConflictingPicks` | ✓ |
| straight leg count `<> 1` | structural (`makeStraightBet` always 1 leg) | ✓ |
| parlay 2–6 legs | `:782-785` | ✓ |
| teaser 2–4 legs | `:791-794` | ✓ |
| `teaser_points in (6, 6.5, 7)` | `TeaserPoints` union type | ✓ |
| non-teaser with `teaser_points` set | `null` at `:291`, `:425` | ✓ |
| parlay `potential_payout > 500` | capped at `:306` | ✓ |
| leg `game_start_time <= now()` | `:778-780` | ✓ |
| teaser moneyline leg | `:795-797`, plus `Picks.tsx:528-531` at add time | ✓ |

The client additionally states "Every pick needs a coin amount above zero" up front
(`:748-750`) — documented at `:720-727` as a deliberate improvement over mobile, and it matches
the DB's `amount <= 0`. Correct, and strictly better than mobile.

**V4 — Teaser point adjustment direction.** Exact against AGENTS.md's own examples, by calling
`getAdjustedTeaserLine` on the running build:

```
spread favourite −7.5, 6pt  →  −1.5   ✓
spread underdog  +3.5, 6pt  →  +9.5   ✓
Over  45.5,      6pt        →  39.5   ✓
Under 45.5,      6pt        →  51.5   ✓
```

Confirmed live on `tester`'s card: `Over 43.5` labelled `49.5 → 43.5`, and
`Chicago Bears +3.5` labelled `-2.5 → +3.5` (a −2.5 favourite teased 6 points to +3.5).

**V5 — Teaser odds lookup table.** `getTeaserOdds` returns exactly AGENTS.md's table, and
correctly returns `null` outside 2–4 legs:

```
2 legs → [-110, -120, -130]     3 legs → [+150, +130, +110]
4 legs → [+250, +200, +160]     1 leg → null,  5 legs → null
```

Live check: `tester`'s 2-leg 6pt teaser shows `-110`; $20 at −110 → 38 coins base. Correct.

**V6 — Parlay math and the $500 cap.** `makeParlaySlipBet` with six +900 legs at $35 returns
`potential_payout: 500`, `rawPotentialReward: 35000000`, `isCappedParlay: true`. Live check on
`tester`'s real parlay: legs −118 and −185 → decimal 1.8475 × 1.5405 = 2.8460 → **+185** displayed,
$20 × 2.8460 = **57 coins** displayed. Both correct. Odds conversion matches AGENTS.md's formulas.

**V7 — Conflict detection matches the database semantically.** `lib/pick-conflicts.ts:60-78`
(`areDirectlyContradictingPicks`) and `public.pick_conflict_kind` implement the same predicate,
including the `0.001` line epsilon, the absolute-value comparison for spreads, and the
same-side short-circuit. Conflicts are checked at add time against both the staged lineup and
the in-progress builder (`Picks.tsx:454-461`), when committing a parlay or teaser
(`:589-593`, `:635-639`), and across the whole card at submit (`:731`).

**V8 — Pick of the Week gating mirrors `set_pick_of_week`.** All three RPC guards are present
client-side: settled picks excluded and locked picks excluded (`SubmittedBoard.tsx:196`
`showPotwStar = !readOnly && !potwSwapClosed && !isLocked && !isSettled`), and the
post-first-kickoff cutoff (`Picks.tsx:175-176` against `league_week_reveal_time`, re-checked at
`:726`). `toggleLockBet` (`Picks.tsx:570-574`) makes >1 Lock structurally impossible while
staging. Live: the board reads "Pick of the Week can be moved until first kickoff".

**V9 — Re-submission is blocked client-side.** `submit_bets` raises "Bets have already been
submitted for this week" (`20260518193000_guard_duplicate_weekly_submissions.sql`). The client
never reaches it: `Picks.tsx:167-169` sets `isReadOnly` once `placedBets.length > 0` and the
builder is gated on `canBuildLineup`. Both test accounts showed `CARD SUBMITTED` correctly.

**V10 — Submit is genuinely gated on validation.** `LineupRail.tsx:726` / `:875` —
`disabled={!ready}` where `ready = validation.errors.length === 0 && slipBets.length > 0`. No
path bypasses `getValidationState`.

**V11 — Opponent visibility gate is correct and server-enforced.** Verified two ways. RLS returns
**zero rows** for an opponent's pending bets pre-kickoff (not merely a client-side hide), and
`get_matchup_detail` returns an accurate `hiddenReason`/`isSubmitted`/`revealAt` triple
(quoted in M3). Week 2 renders the viewer's own card in full and the opponent's as
`SUBMITTED` + `REVEALS WEDNESDAY AT 8:20 PM`, with `Philadelphia Eagles`-style opponent detail
absent. The gate works; only its *copy* for the not-submitted case is wrong (M3).

**V12 — Pick Board handles odds loading, error and empty states correctly.** `Picks.tsx:909-937`
covers all three distinctly, surfaces the real error message, and distinguishes "next slate opens
{date}" from "no active slate". This is the model the eight screens in S2 should follow.

**V13 — Every registered route renders; no crashes.** All routes in `App.tsx` were visited:
`/`, `/picks`, `/leagues`, `/leagues/create`, `/leagues/join`, `/leagues/:id`, `/matchups`,
`/matchups/:id`, `/leaderboard`, `/profile`, `/members/:id`, `/bets/:id`, `/analytics`,
`/settings`, `/notifications`, `/notifications/preferences`, `/season-pass`, `/shop`,
`/coin-store`, `/join/:code`, `/login`, `/signup`, `/forgot-password`, `/reset-password`,
`/onboarding`, `/disclosure`, `/terms`, `/privacy`. No render crash on any. The only console
errors across the whole sweep were E1's `fetch-odds` failures.
`/this-route-does-not-exist` → `404 / OFF THE BOARD / That route does not exist.` with a
Back to Home link.

**V14 — No broken internal links.** Every `<Link to>` in `webapp/src` resolves through
`ROUTES` or `buildRoute` from `lib/routes.ts`; the only string-literal target is
`Settings.tsx:496` `` `${ROUTES.disclosure}?source=settings` ``, which is a real route plus a
query param and is read at `Disclosure.tsx:47`. Every `ROUTES` key has a matching `<Route path>`
in `App.tsx`, and every `<Route>` is reachable. No dangling targets.

**V15 — `/join/:inviteCode` works in both session states.**
*Signed out:* `/join/FUSYZG` renders the invite card showing `FUSYZG` and banks it —
`localStorage["action-arena.pending-invite-code"] === "FUSYZG"`, confirmed in the browser.
`InviteJoin.tsx:11-22` documents exactly why localStorage rather than router state (the trip
through login is a full navigation).
*Signed in:* `/join/FUSYZG` redirects to `/leagues/join` with the invite field **pre-filled with
`FUSYZG`**, confirmed by reading the live input value. The code is consumed afterwards
(`pendingInvite: null`). Both halves of the requirement hold.

**V16 — Parlay leg chains, teaser line movement and multi-leg detail render correctly.**
Exercised on `tester`'s real rows (this is the work no earlier agent could do):
- Pick Board — teaser card lists both legs with per-leg movement (`49.5 → 43.5`,
  `-2.5 → +3.5`), `ODDS -110`, `PLAYED 20`, `REWARD 47`, `BASE 38 coins x 1.5`; parlay card lists
  both legs with `ODDS +185`, `REWARD 57`.
- Bet detail (`/bets/ae489e76-…`) — `6-POINT TEASER · 2 LEGS`, numbered `LEG 1` / `LEG 2`, each
  with its own market, odds, movement, kickoff and `OPEN` lock state.
- Bet detail (`/bets/a3173b4a-…`) — `2-LEG PARLAY`, `+185`, both legs with individual odds.
- Profile pick history lists all five picks with correct type badges and links.
All arithmetic independently recomputed and correct. The only defect on these surfaces is the
Pick of the Week payout split (M4) and the missing teaser size on the board card (S8).

**V17 — Season Pass redemption and the unlocked analytics screen.** `ACTION-S1-VIP` redeemed
successfully on `tester`; page moved to `PASS ACTIVE` / "Season Pass active. Exclusive drops and
analytics are unlocked." `/analytics` moved from `PREVIEW LOCKED / ADVANCED STATS LOCKED` to
`SEASON PASS HOLDER` with a correct, well-written empty state — "No settled picks were found in
your all-leagues Strategy Lab scope yet…" — since `tester` has no settled picks. Four
pass-exclusive cosmetics were granted (`s1_logo_founder`, `s1_frame_champion`,
`s1_lock_overdrive`, `s1_trophy_legacy`), matching the advertised "4 exclusive cosmetics".
The unlock path is correct; the *shop's* handling of the unlocked state is not (M2, S5).

**V18 — H2H league structure.** League detail renders 14 regular-season matchups plus
`PLAYOFF ROUND 1`, `SEMIFINALS`, `CHAMPIONSHIP` ("Seeded from the regular-season standings once
Week 14 settles") — matching AGENTS.md's "14 regular weeks + 3 playoff weeks". Home/away
alternates correctly week to week. Standings, members (`2/10`), invite code (`FUSYZG` with both
Copy Code and Copy Link), chat with realtime messages and system "submitted their picks" events,
and commissioner-only controls all render.

**V19 — Payment placeholders.** AGENTS.md: "Payment processing and ad SDKs are not integrated
yet. Purchase buttons use placeholders." `/coin-store` shows all three packs as `IOS APP ONLY`
with disabled buttons and `WEB IS READ-ONLY`; `/season-pass` shows `BUY IN THE IOS APP` and
`RESTORE IN THE IOS APP` disabled. Correct — no web purchase path exists.

**V20 — No gameplay behind payment.** Verified against AGENTS.md's "No gameplay feature is gated
behind payment": leagues, picks, matchups, chat, leaderboard, profile and bet history were all
fully usable on `tester` **before** the pass was redeemed. Only `/analytics` and the
pass-exclusive cosmetics were gated, which is what AGENTS.md prescribes.

---

# Test plan walk — `action-arena-test-plan-v2.quick-reference.md`

| # | Area | Verdict | Evidence |
|---|---|---|---|
| 1 | Authentication | **PASS** | Sign-out clears session and lands `/login`; sign-in as `tester` restores the session and the guarded shell. `RequireAuth`/`RequireAnon` both enforce. Password entry was performed by the requester, not by this agent. |
| 2 | League Creation | **PASS (form)** | `/leagues/create` renders name, H2H/cumulative format, visibility, sport, max members with validation. Not submitted — would create real rows in the shared dev DB. |
| 3 | Joining Leagues | **PASS** | Invite-code field, public browse with search, `NO PUBLIC ROOMS` empty state + CTA. Full invite flow verified both session states — see **V15**. |
| 4 | League Detail | **PASS** | See **V18**. 14 + 3 structure confirmed. |
| 5 | Straight bets | **PARTIAL** | Math verified against the shipped module and real rows (`$20 @ -110 → 38`; `$20 @ +154 → 51`; `$20 @ -198 → 30`) — matches the plan's worked examples. Board-side staging not clickable: **E1**. |
| 6 | Validation rules | **FAIL** | Min-5, one-Lock, $35 cap, conflicts all correct (**V3**). Exact-$100 rejects legal cards: **M1**. |
| 7 | Parlays | **PASS** | Amber accent, 2–6 legs, $500 cap, counts as 1 bet, odds multiply-and-convert — all verified (**V6**, **V16**). |
| 8 | Teasers | **PASS** | Cyan accent, 6/6.5/7, 2–4 legs, no moneylines, full lookup table (**V4**, **V5**). |
| 9 | Pick of the Week | **PARTIAL** | Designation, one-only, swap gating all correct (**V8**). Payout display inconsistent across three screens: **M4**. |
| 10 | Mixed submission | **PASS** | `tester`'s card is exactly the plan's shape — 3 straights + 1 parlay + 1 teaser, 100 coins, 5 picks, one `is_lock`. Per-leg lock states render (`OPEN` on each leg). |
| 11–13 | Settlement | **NOT EXERCISED** | No settled picks exist in the fixture (Week 1 has zero picks for either player; Week 2 is entirely `PENDING`). Settling would require `week:complete` against the shared dev database — a destructive, cross-league mutation not authorised for this audit. Settled-state *rendering* paths were read and are wired (`getRealizedReward`, `isSettledResult`, `ResultPill`, `LegResultPill`), but no assertion is made about settlement correctness. |
| 14 | Matchup resolution | **PARTIAL** | Week 1 shows a recorded `TIE` at 0–0 and the history table renders. Live resolution not exercised (same reason as 11–13). |
| 15 | Matchup detail | **FAIL** | Two-player columns, profit race ("PROFIT SWING / Dead even"), Pick of the Week Showdown and the visibility gate all render correctly (**V11**). Not-submitted opponents are mislabelled: **M3**. |
| 16 | Profile and stats | **PARTIAL** | Hero stats, breakdown by type, teaser-size splits, 6 achievements, pick history with filters all render. Missing error state: **S2**. Member-profile redaction unexplained: **S6**. |
| 17 | Leaderboard | **PASS** | Season/This Week toggle, rank, record, weekly and total profit, "you" highlight. Missing error state: **S2**. |
| 18 | Weekly awards | **PARTIAL** | Trophy case renders its pre-settlement state ("Awards land once this week settles"). Generation not exercised (11–13). |
| 19 | Notifications | **PASS** | Inbox renders a real `PICK REMINDER` row; `MARK ALL READ`; preferences persist. Correctly discloses that browser push does not exist and nothing is missed. |
| 20 | League chat | **PASS** | Realtime messages and system "submitted their picks" events render in `/leagues/:id`. `SHARE TO CHAT` present on every pick card. |
| 21 | Playoffs / championship | **NOT EXERCISED** | Bracket placeholders render (**V18**); requires a completed season. Week navigator ceiling affects review here: **S4**. |
| 22 | End-of-season awards | **NOT EXERCISED** | Requires a completed season. |
| 23 | Cosmetics shop | **FAIL** | Catalogue, categories, ownership counts, equip state all render; purchase is impossible for pass holders and equip is rejected by the DB: **M2**. |
| 24 | Season Pass | **PARTIAL** | Redemption, premium flag and analytics unlock all correct (**V17**). Stale sell-copy after activation: **S5**. Early Pick Board access could not be exercised (needs a configured `odds_release_windows` row; the gate itself is wired at `Picks.tsx:481-487`). |
| 25 | Ad hooks | **PASS (as specified)** | `src/lib/ad-hooks.ts` logs events only, no SDK — exactly what AGENTS.md prescribes. |
| 26 | Analytics events | **PASS** | `src/lib/analytics.ts` present and called from the submit mutation (`use-straight-bets.ts:210+` counts by bet type). |
| 27 | Edge cases | **PARTIAL** | 404 route, signed-out invite, empty public-league list, no-pick player (Week 1) all handled. Offline/network-failure behaviour is where **S1** + **S2** compound: a failed query shows 7s of skeleton then a false empty state. |
| 28 | Odds API | **BLOCKED** | **E1** — `fetch-odds` returns 404, not deployed. |
| — | N/A on web | — | Push notification delivery, haptics, App Store IAP purchase and restore are iOS-only by design and correctly disclosed in the UI rather than hidden. |

---

## Summary

**6 MUST FIX** — M1 (float `$100` blocks legal cards), M2 (pass holders cannot buy; DB rejects
every Equip they are offered), M3 (non-submitters reported as pending reveal), M4 (Pick of the
Week payout differs across three screens), M5 and M6 (AGENTS.md contradicts the shipped rule in
both the same-game and per-leg-locking cases — **decisions, not unilateral code fixes**).

**12 SHOULD FIX**, plus **1 environment blocker** (E1).

> ### All 18 resolved — 2026-09-04 fix pass
>
> **6/6 MUST FIX and 12/12 SHOULD FIX** are closed; see the `**RESOLVED**` block under each. E1 is
> unchanged and remains an environment fact.
>
> Four of the findings turned out to be larger than reported, and the fix went to the full extent
> in each case rather than to the lines quoted:
>
> - **M4** was five copies of the Lock multiplier, not three — the pick detail modal and the
>   profile history payout were a fourth and fifth.
> - **M2** lived in three components, not two — the cosmetic detail modal shared it.
> - **S3** was five copies of the bet-type colour language, not four — `components/ui/Badge`
>   carried its own. Two screens where picks appear carried *no* bet-type accent at all (the
>   submitted Pick Board card, and the weekly-awards pick box), which is the same AGENTS.md rule
>   failing in the other direction.
> - **S4** was four copies of the week constant on mobile, not two.
>
> Nothing in this pass loosened a client rule to make a case pass, and nothing made a client
> stricter than Postgres. The two rule disagreements (M5, M6) were resolved by correcting the
> documentation to the shipped behaviour, which is what this report argued for and what the
> repository owner chose.
>
> `lib/format.ts`, `lib/pick-labels.ts`, `lib/bet-outcome.ts` and `constants/rules.ts` are still
> **byte-identical** between `webapp/src/` and the repo root after the pass, so **V1** and **V2**
> still hold. **V13** was re-walked against the new lazy-route chunk graph. Every other **V**
> finding was left untouched by design.

M1, M2, M3 and M4 are all present in mobile as well, and M5/M6 are doc-vs-product drift shared by
both platforms. This is the most useful thing the audit found: **the parallel port was faithful.**
Almost nothing broke in translation — the `lib/` layer is byte-identical, the validation gate
mirrors `submit_bets` clause for clause, and the conflict predicate matches
`pick_conflict_kind` exactly. What the port did instead was **replicate four real product defects
onto a second platform**, and in one case (S1's `refetchOnWindowFocus`) copy a line of code whose
behaviour changes when the runtime changes.

The web-specific findings are narrower and concentrated in the seams: the third copy of
`REGULAR_SEASON_WEEKS` (S4), the four drifting bet-type colour tables (S3), the eight screens
with no error branch (S2), and the QueryClient defaults that were inert on mobile and are not on
web (S1).

Two areas remain genuinely unverified and are flagged rather than glossed: **settlement and
final result states** (test plan 11–14, 18, 21–22), which need `week:complete` against the shared
dev database, and the **Pick Board's game grid and builder interactions**, which need `fetch-odds`
deployed (E1). Both are blocked by fixture and environment state, not by the code.
