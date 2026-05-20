# Action Arena Test Plan v2 - Codex Reference

Source PDF: `/Users/jsomwaru/Desktop/action-arena-test-plan-v2.md.pdf`
Full extracted text: `docs/testing/action-arena-test-plan-v2.full-extract.md`

Use this file as the fast map. Use the full extract when exact step wording matters.

## Setup Assumptions

- Mock odds should be enabled with `EXPO_PUBLIC_USE_MOCK_DATA=true`.
- Expected mock slate: roughly 14-16 fake NFL games with realistic odds.
- Test accounts:
  - Player 1: `test1@actionarena.com` / `test1234` - primary tester
  - Player 2: `test2@actionarena.com` / `test2234` - opponent / league mate
  - Player 3: `test3@actionarena.com` / `test3234` - third league member
  - Player 4: `test4@actionarena.com` / `test4234` - edge cases
- New users should have `arena_coins = 500`.
- Core tables expected: `users`, `leagues`, `league_members`, `weekly_matchups`, `bets`, `bet_legs`, `standings`, `user_cosmetics`, `season_passes`, `seasons`.

## Current Product Notes

- The PDF still says "Lock of the Week" in several places. In current UI/business wording, this is "Pick of the Week" (`bets.is_lock` in DB).
- The PDF has older same-game/duplicate wording in Test 6.5 and Test 7.3. Current conflict rule blocks direct contradictions plus same-team moneyline/spread pairings:
  - blocked: both teams' moneylines, both sides of the same spread, both sides of the same total, same-team moneyline + spread
  - allowed: moneyline + total and spread + total from the same game
- Opponent card visibility is now gated until the league/week first kickoff. Before first kickoff, own card is visible; opponent details are redacted.
- Post-submit editing exists until the relevant lock rule fires. Straight picks lock when their game starts; multi-pick cards lock according to current implementation when a leg's game has started.
- POTW swaps after submission are allowed only before the league/week first kickoff and only onto editable picks.

## Test Index

1. Authentication
   - signup, validation, login, session persistence, logout
   - DB checks: Supabase Auth user plus matching `public.users` row

2. League Creation
   - H2H league, cumulative league, public league, validation
   - DB checks: `leagues`, `league_members`

3. Joining Leagues
   - invite code, public browse, invalid code, full league, duplicate join, add all 4 players
   - DB checks: no duplicate `league_members` rows

4. League Detail
   - standings table, matchup schedule, members list, invite code share, odd-member bye week
   - H2H expectation: 14 regular weeks + 3 playoff weeks

5. Bet Placement - Straight Bets
   - viewing games/odds, budget tracker, valid straight, multiple straights, spread/total, edit amount, remove bet
   - math examples:
     - $20 at -150 pays $33.33, profit $13.33
     - $20 at -110 pays $38.18

6. Bet Placement - Validation Rules
   - minimum 5 bets, max $35 single bet, exactly $100 allocated, direct conflict prevention
   - see Current Product Notes for updated conflict behavior

7. Bet Placement - Parlays
   - builder accent amber, 2-6 legs, live odds updates, $500 payout cap, counts as 1 bet
   - parlay odds: multiply decimal odds, convert back to American

8. Bet Placement - Teasers
   - builder accent cyan, 6/6.5/7 point sizes, 2-4 legs, no moneylines, table verification
   - teaser odds table:
     - 2 legs: 6=-110, 6.5=-120, 7=-130
     - 3 legs: 6=+150, 6.5=+130, 7=+110
     - 4 legs: 6=+250, 6.5=+200, 7=+160

9. Pick/Lock of the Week
   - required designation, only one, works on straight/parlay/teaser, visible after submission and matchup detail
   - multiplier: wins and losses are 1.5x; pushes stay 0

10. Mixed Bet Submission
   - example full card: 3 straights ($15 each), 1 three-leg parlay ($25), 1 two-leg teaser ($30), total $100
   - DB checks: 5 `bets` rows, expected `bet_legs` row counts, one `is_lock = true`
   - lock timing: simulate game start and verify affected picks/legs lock

11. Settlement - Straight Bets
   - win/loss/push settlement, profit math

12. Settlement - Parlays
   - all-win, one-loss, push behavior, push-to-single-leg, all-push, payout cap

13. Settlement - Teasers
   - teaser win/loss/push logic, pushed legs dropping below minimum, lookup recalculation

14. Weekly Matchup Resolution
   - H2H winner/loser/tie, standings update, cumulative league update

15. Matchup Detail Screen
   - current week matchup, past week matchup, multi-leg bets display
   - current product additionally requires opponent visibility gate before first kickoff

16. Profile and Stats
   - profile info, bet history, season stats, achievements

17. Leaderboard
   - league leaderboard and global/season ranking style checks

18. Weekly Awards
   - award generation/display after settlement

19. Notifications
   - bet lock, opponent submitted/locked, matchup result, weekly awards

20. League Chat
   - real-time messages, multi-user chat, share bet to chat, stickers
   - voluntary share during hidden period should reveal only that shared pick

21. Playoff and Championship
   - playoff seeding, playoff matchups, championship completion

22. End-of-Season Awards
   - season completion and awards snapshot

23. Cosmetics Shop
   - catalog display, purchase, equip, coin deduction, visual placement

24. Season Pass
   - redeem code, premium flag, early access, cosmetics

25. Ad Hooks
   - placeholder ad events/logging; no real ad SDK expected

26. Analytics Events
   - event logging for key actions

27. Edge Cases
   - network/offline, app close/reopen, multiple leagues, leave league mid-season, no-pick player

28. Odds API Integration
   - separate track when moving beyond mock data

## Useful DB Simulation Notes

Game simulation is global by `game_id`. Do not update a single
`league_week_slate_games` row for one league. NFL games happen once, and the DB
now treats `public.games` as the canonical kickoff record. Updating that row fans
out to every league slate and every placed leg that references the same game.

To simulate first kickoff / reveal / leg lock across every league that has the
game on its slate:

```sql
begin;

with simulated_game as (
  select
    '<game_id>'::text as game_id,
    coalesce(max(league.sport), 'nfl'::public.league_sport) as sport,
    min(league.season_year) as season_year,
    min(slate.week_number) as week_number,
    now() - interval '1 minute' as commence_time,
    max(slate.away_team) filter (where slate.away_team is not null) as away_team,
    max(slate.home_team) filter (where slate.home_team is not null) as home_team
  from public.league_week_slate_games slate
  join public.leagues league on league.id = slate.league_id
  where slate.game_id = '<game_id>'
)
insert into public.games (
  game_id,
  sport,
  season_year,
  week_number,
  commence_time,
  away_team,
  home_team
)
select
  game_id,
  sport,
  season_year,
  week_number,
  commence_time,
  away_team,
  home_team
from simulated_game
on conflict (game_id) do update
set
  sport = excluded.sport,
  season_year = coalesce(public.games.season_year, excluded.season_year),
  week_number = coalesce(public.games.week_number, excluded.week_number),
  commence_time = excluded.commence_time,
  away_team = coalesce(excluded.away_team, public.games.away_team),
  home_team = coalesce(excluded.home_team, public.games.home_team);

commit;
```

That one canonical update triggers all of these compatibility updates
atomically:

- `league_week_slate_games.commence_time` for every league/week containing the game
- `bet_legs.game_start_time` and `bet_legs.locked` for every placed leg on the game
- reveal-time logic, opponent visibility, and Pick of the Week lock timing across leagues

To simulate a live score for that same game, keep the canonical kickoff update
and the live score in one transaction:

```sql
begin;

with simulated_game as (
  select
    '<game_id>'::text as game_id,
    coalesce(max(league.sport), 'nfl'::public.league_sport) as sport,
    min(league.season_year) as season_year,
    min(slate.week_number) as week_number,
    now() - interval '1 minute' as commence_time,
    coalesce(
      max(slate.away_team) filter (where slate.away_team is not null),
      '<away_team>'
    ) as away_team,
    coalesce(
      max(slate.home_team) filter (where slate.home_team is not null),
      '<home_team>'
    ) as home_team
  from public.league_week_slate_games slate
  join public.leagues league on league.id = slate.league_id
  where slate.game_id = '<game_id>'
)
insert into public.games (
  game_id,
  sport,
  season_year,
  week_number,
  commence_time,
  away_team,
  home_team
)
select game_id, sport, season_year, week_number, commence_time, away_team, home_team
from simulated_game
on conflict (game_id) do update
set
  sport = excluded.sport,
  season_year = coalesce(public.games.season_year, excluded.season_year),
  week_number = coalesce(public.games.week_number, excluded.week_number),
  commence_time = excluded.commence_time,
  away_team = coalesce(excluded.away_team, public.games.away_team),
  home_team = coalesce(excluded.home_team, public.games.home_team);

insert into public.live_game_states (
  game_id,
  away_team,
  home_team,
  away_score,
  home_score,
  current_period,
  time_remaining,
  status,
  last_updated
)
values (
  '<game_id>',
  '<away_team>',
  '<home_team>',
  7,
  14,
  'Q2',
  '8:32',
  'in_progress',
  now()
)
on conflict (game_id) do update
set
  away_score = excluded.away_score,
  home_score = excluded.home_score,
  current_period = excluded.current_period,
  time_remaining = excluded.time_remaining,
  status = excluded.status,
  last_updated = now();

commit;
```

To advance or reverse the live score while testing status flips:

```sql
update public.live_game_states
set
  away_score = 21,
  home_score = 17,
  current_period = 'Q3',
  time_remaining = '4:10',
  status = 'in_progress',
  last_updated = now()
where game_id = '<game_id>';
```

To settle a completed game across every league at once, update the final live
state and call settlement in the same transaction. `settle_completed_scores`
already evaluates `bet_legs` by `game_id`, so every league with picks on the
underlying game settles to the same outcome:

```sql
begin;

insert into public.live_game_states (
  game_id,
  away_team,
  home_team,
  away_score,
  home_score,
  current_period,
  time_remaining,
  status,
  last_updated
)
values (
  '<game_id>',
  '<away_team>',
  '<home_team>',
  <away_score>,
  <home_score>,
  'final',
  null,
  'final',
  now()
)
on conflict (game_id) do update
set
  away_team = excluded.away_team,
  home_team = excluded.home_team,
  away_score = excluded.away_score,
  home_score = excluded.home_score,
  current_period = 'final',
  time_remaining = null,
  status = 'final',
  last_updated = now();

select public.settle_completed_scores(
  jsonb_build_array(
    jsonb_build_object(
      'id', '<game_id>',
      'completed', true,
      'home_team', '<home_team>',
      'away_team', '<away_team>',
      'scores', jsonb_build_array(
        jsonb_build_object('name', '<home_team>', 'score', '<home_score>'),
        jsonb_build_object('name', '<away_team>', 'score', '<away_score>')
      ),
      'sport_key', 'americanfootball_nfl',
      'sport_title', 'NFL',
      'last_update', now()
    )
  )
);

commit;
```

To verify a global kickoff or settlement touched every league attribution:

```sql
select
  slate.league_id,
  slate.week_number,
  slate.game_id,
  slate.commence_time,
  bool_and(bl.locked) as all_placed_legs_locked,
  count(bl.id) as placed_leg_count,
  jsonb_agg(distinct b.result) filter (where b.id is not null) as bet_results
from public.league_week_slate_games slate
left join public.bets b
  on b.league_id = slate.league_id
  and b.week_number = slate.week_number
left join public.bet_legs bl
  on bl.bet_id = b.id
  and bl.game_id = slate.game_id
where slate.game_id = '<game_id>'
group by slate.league_id, slate.week_number, slate.game_id, slate.commence_time
order by slate.league_id, slate.week_number;
```

Live production sync is handled by the `sync-live-scores` Edge Function. Run it from a one-minute scheduler during live windows; it skips the Odds API call when no slate games are near kickoff or currently live, and final games drop out of the polling candidate set.

To find placed legs for a league/week:

```sql
select
  b.league_id,
  b.week_number,
  b.bet_type,
  b.is_lock,
  bl.game_id,
  bl.selection,
  bl.market,
  bl.game_start_time,
  bl.locked,
  bl.result
from public.bet_legs bl
join public.bets b on b.id = bl.bet_id
where b.league_id = '<league_id>'
  and b.week_number = <week_number>
order by bl.game_start_time, b.created_at, bl.selection;
```

## How To Ask Codex During Testing

Good prompts:

- "I am on Test 7.4 and the payout cap looks wrong. What should I inspect?"
- "For Test 10.2, give me the SQL to start the Cowboys game for this league/week."
- "I see opponent picks before kickoff in Test 15. Which API/RPC should be redacting them?"
- "Compare this behavior to the saved test plan and tell me if it is expected or a bug."
