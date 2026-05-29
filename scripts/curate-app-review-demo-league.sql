-- Curate the App Review Demo League without touching any other league.
--
-- Default mode is review-only: the final statement is ROLLBACK, so this file
-- prints the planned changes and exercises the full curation transaction without
-- persisting production data changes. To apply after review, change the final
-- ROLLBACK to COMMIT and run this exact file against the linked project.
--
-- Target league:
--   da74152d-2864-4a17-bbca-0a1acc492d55 / App Review Demo League
-- Target users:
--   appreview@actionarena.app
--   appreview-opponent@actionarena.app
--
-- Note: public.settle_completed_scores currently invokes the unscoped
-- public.resolve_ready_weekly_standings() wrapper, which may update other ready
-- leagues. To honor the "demo league only" requirement, this script uses the
-- same production settlement primitives (evaluate_bet_leg, payout helpers,
-- teaser odds, Lock multiplier) scoped to the demo league, then runs the
-- production scoped weekly resolver public.resolve_league_week(demo_id, week).

begin;

set constraints all deferred;

do $$
declare
  demo_league_id constant uuid := 'da74152d-2864-4a17-bbca-0a1acc492d55'::uuid;
  demo_email constant text := 'appreview@actionarena.app';
  opponent_email constant text := 'appreview-opponent@actionarena.app';

  demo_user_id uuid;
  opponent_user_id uuid;
  target_league public.leagues;
  existing_bet_count integer;
  existing_leg_count integer;
  existing_matchup_count integer;
  existing_slate_count integer;
  existing_standing_count integer;
  existing_live_state_count integer;
  existing_game_count integer;
  seeded_bet_count integer;
  seeded_leg_count integer;
  seeded_game_count integer;
  live_state_result integer;
  settlement_bet_count integer := 0;
  bet_record public.bets;
  leg_record public.bet_legs;
  loss_count integer;
  pending_count integer;
  remaining_leg_count integer;
  computed_result public.bet_result;
  computed_profit numeric(10,2);
  payout numeric;
  combined_decimal numeric;
  teaser_odds integer;
begin
  select *
  into target_league
  from public.leagues
  where id = demo_league_id;

  if target_league.id is null or target_league.name <> 'App Review Demo League' then
    raise exception 'Expected App Review Demo League at %, found %', demo_league_id, target_league.name;
  end if;

  select id into demo_user_id from public.users where lower(email) = demo_email;
  select id into opponent_user_id from public.users where lower(email) = opponent_email;

  if demo_user_id is null or opponent_user_id is null then
    raise exception 'Both demo users must exist. demo_user=%, opponent_user=%', demo_user_id, opponent_user_id;
  end if;

  if not exists (
    select 1 from public.league_members where league_id = demo_league_id and user_id = demo_user_id
  ) or not exists (
    select 1 from public.league_members where league_id = demo_league_id and user_id = opponent_user_id
  ) then
    raise exception 'Both demo users must be members of league %', demo_league_id;
  end if;

  select count(*)
  into existing_bet_count
  from public.bets
  where league_id = demo_league_id
    and week_number between 1 and 4;

  select count(*)
  into existing_leg_count
  from public.bet_legs leg
  join public.bets bet on bet.id = leg.bet_id
  where bet.league_id = demo_league_id
    and bet.week_number between 1 and 4;

  select count(*)
  into existing_matchup_count
  from public.weekly_matchups
  where league_id = demo_league_id
    and week_number between 1 and 4;

  select count(*)
  into existing_slate_count
  from public.league_week_slate_games
  where league_id = demo_league_id
    and week_number between 1 and 4;

  select count(*)
  into existing_standing_count
  from public.standings
  where league_id = demo_league_id
    and week_number between 1 and 4;

  select count(*)
  into existing_live_state_count
  from public.live_game_states
  where game_id like 'appreview_demo_%';

  select count(*)
  into existing_game_count
  from public.games
  where game_id like 'appreview_demo_%';

  create temporary table app_review_demo_games (
    game_key text primary key,
    game_id text not null unique,
    week_number integer not null,
    commence_time timestamptz not null,
    away_team text not null,
    home_team text not null,
    away_score integer not null,
    home_score integer not null
  ) on commit drop;

  insert into app_review_demo_games (
    game_key,
    game_id,
    week_number,
    commence_time,
    away_team,
    home_team,
    away_score,
    home_score
  )
  values
    ('w01_dal_phi', 'appreview_demo_w01_dal_phi', 1, '2026-01-04 18:00:00+00', 'Dallas Cowboys', 'Philadelphia Eagles', 20, 27),
    ('w01_buf_nyj', 'appreview_demo_w01_buf_nyj', 1, '2026-01-04 18:15:00+00', 'Buffalo Bills', 'New York Jets', 24, 17),
    ('w01_cin_cle', 'appreview_demo_w01_cin_cle', 1, '2026-01-04 18:30:00+00', 'Cincinnati Bengals', 'Cleveland Browns', 21, 23),
    ('w01_bal_pit', 'appreview_demo_w01_bal_pit', 1, '2026-01-04 18:45:00+00', 'Baltimore Ravens', 'Pittsburgh Steelers', 28, 24),
    ('w01_kc_den', 'appreview_demo_w01_kc_den', 1, '2026-01-04 21:05:00+00', 'Kansas City Chiefs', 'Denver Broncos', 31, 20),
    ('w01_sf_sea', 'appreview_demo_w01_sf_sea', 1, '2026-01-04 21:25:00+00', 'San Francisco 49ers', 'Seattle Seahawks', 23, 26),
    ('w01_det_chi', 'appreview_demo_w01_det_chi', 1, '2026-01-04 21:40:00+00', 'Detroit Lions', 'Chicago Bears', 34, 21),

    ('w02_mia_ne', 'appreview_demo_w02_mia_ne', 2, '2026-01-11 18:00:00+00', 'Miami Dolphins', 'New England Patriots', 17, 20),
    ('w02_gb_min', 'appreview_demo_w02_gb_min', 2, '2026-01-11 18:15:00+00', 'Green Bay Packers', 'Minnesota Vikings', 21, 24),
    ('w02_tb_no', 'appreview_demo_w02_tb_no', 2, '2026-01-11 18:30:00+00', 'Tampa Bay Buccaneers', 'New Orleans Saints', 30, 27),
    ('w02_lar_ari', 'appreview_demo_w02_lar_ari', 2, '2026-01-11 18:45:00+00', 'Los Angeles Rams', 'Arizona Cardinals', 17, 14),
    ('w02_lv_lac', 'appreview_demo_w02_lv_lac', 2, '2026-01-11 21:05:00+00', 'Las Vegas Raiders', 'Los Angeles Chargers', 13, 28),
    ('w02_hou_ten', 'appreview_demo_w02_hou_ten', 2, '2026-01-11 21:25:00+00', 'Houston Texans', 'Tennessee Titans', 24, 20),
    ('w02_jax_ind', 'appreview_demo_w02_jax_ind', 2, '2026-01-11 21:40:00+00', 'Jacksonville Jaguars', 'Indianapolis Colts', 19, 22),

    ('w03_atl_car', 'appreview_demo_w03_atl_car', 3, '2026-01-18 18:00:00+00', 'Atlanta Falcons', 'Carolina Panthers', 24, 17),
    ('w03_was_nyg', 'appreview_demo_w03_was_nyg', 3, '2026-01-18 18:15:00+00', 'Washington Commanders', 'New York Giants', 16, 21),
    ('w03_dal_phi', 'appreview_demo_w03_dal_phi', 3, '2026-01-18 18:30:00+00', 'Dallas Cowboys', 'Philadelphia Eagles', 28, 24),
    ('w03_buf_nyj', 'appreview_demo_w03_buf_nyj', 3, '2026-01-18 18:45:00+00', 'Buffalo Bills', 'New York Jets', 20, 23),
    ('w03_cin_cle', 'appreview_demo_w03_cin_cle', 3, '2026-01-18 21:05:00+00', 'Cincinnati Bengals', 'Cleveland Browns', 30, 27),
    ('w03_bal_pit', 'appreview_demo_w03_bal_pit', 3, '2026-01-18 21:25:00+00', 'Baltimore Ravens', 'Pittsburgh Steelers', 17, 20),
    ('w03_kc_den', 'appreview_demo_w03_kc_den', 3, '2026-01-18 21:40:00+00', 'Kansas City Chiefs', 'Denver Broncos', 35, 24),

    ('w04_sf_sea', 'appreview_demo_w04_sf_sea', 4, '2026-01-25 18:00:00+00', 'San Francisco 49ers', 'Seattle Seahawks', 27, 24),
    ('w04_det_chi', 'appreview_demo_w04_det_chi', 4, '2026-01-25 18:15:00+00', 'Detroit Lions', 'Chicago Bears', 23, 17),
    ('w04_mia_ne', 'appreview_demo_w04_mia_ne', 4, '2026-01-25 18:30:00+00', 'Miami Dolphins', 'New England Patriots', 31, 24),
    ('w04_gb_min', 'appreview_demo_w04_gb_min', 4, '2026-01-25 18:45:00+00', 'Green Bay Packers', 'Minnesota Vikings', 20, 20),
    ('w04_tb_no', 'appreview_demo_w04_tb_no', 4, '2026-01-25 21:05:00+00', 'Tampa Bay Buccaneers', 'New Orleans Saints', 14, 21),
    ('w04_lar_ari', 'appreview_demo_w04_lar_ari', 4, '2026-01-25 21:25:00+00', 'Los Angeles Rams', 'Arizona Cardinals', 26, 23),
    ('w04_lv_lac', 'appreview_demo_w04_lv_lac', 4, '2026-01-25 21:40:00+00', 'Las Vegas Raiders', 'Los Angeles Chargers', 18, 30);

  create temporary table app_review_demo_bets (
    bet_key text primary key,
    bettor text not null check (bettor in ('demo', 'opponent')),
    week_number integer not null,
    bet_type public.bet_type not null,
    amount numeric(10,2) not null,
    teaser_points numeric(3,1),
    is_lock boolean not null
  ) on commit drop;

  insert into app_review_demo_bets (bet_key, bettor, week_number, bet_type, amount, teaser_points, is_lock)
  values
    ('demo_w01_eagles_spread', 'demo', 1, 'straight', 20, null, true),
    ('demo_w01_bills_ml', 'demo', 1, 'straight', 20, null, false),
    ('demo_w01_parlay', 'demo', 1, 'parlay', 20, null, false),
    ('demo_w01_teaser', 'demo', 1, 'teaser', 20, 6, false),
    ('demo_w01_over', 'demo', 1, 'straight', 20, null, false),
    ('opp_w01_cowboys_ml', 'opponent', 1, 'straight', 20, null, false),
    ('opp_w01_jets_spread', 'opponent', 1, 'straight', 20, null, false),
    ('opp_w01_parlay', 'opponent', 1, 'parlay', 20, null, false),
    ('opp_w01_teaser', 'opponent', 1, 'teaser', 20, 6, false),
    ('opp_w01_under', 'opponent', 1, 'straight', 20, null, true),

    ('demo_w02_dolphins_ml', 'demo', 2, 'straight', 20, null, false),
    ('demo_w02_packers_spread', 'demo', 2, 'straight', 20, null, false),
    ('demo_w02_parlay', 'demo', 2, 'parlay', 20, null, false),
    ('demo_w02_teaser', 'demo', 2, 'teaser', 20, 6, false),
    ('demo_w02_under', 'demo', 2, 'straight', 20, null, true),
    ('opp_w02_patriots_ml', 'opponent', 2, 'straight', 20, null, false),
    ('opp_w02_vikings_spread', 'opponent', 2, 'straight', 20, null, false),
    ('opp_w02_parlay', 'opponent', 2, 'parlay', 20, null, true),
    ('opp_w02_teaser', 'opponent', 2, 'teaser', 20, 6, false),
    ('opp_w02_over', 'opponent', 2, 'straight', 20, null, false),

    ('demo_w03_falcons_ml', 'demo', 3, 'straight', 20, null, false),
    ('demo_w03_giants_ml', 'demo', 3, 'straight', 20, null, false),
    ('demo_w03_parlay', 'demo', 3, 'parlay', 20, null, true),
    ('demo_w03_teaser', 'demo', 3, 'teaser', 20, 6, false),
    ('demo_w03_under', 'demo', 3, 'straight', 20, null, false),
    ('opp_w03_panthers_ml', 'opponent', 3, 'straight', 20, null, true),
    ('opp_w03_commanders_spread', 'opponent', 3, 'straight', 20, null, false),
    ('opp_w03_parlay', 'opponent', 3, 'parlay', 20, null, false),
    ('opp_w03_teaser', 'opponent', 3, 'teaser', 20, 6, false),
    ('opp_w03_over', 'opponent', 3, 'straight', 20, null, false),

    ('demo_w04_49ers_ml', 'demo', 4, 'straight', 20, null, false),
    ('demo_w04_lions_spread', 'demo', 4, 'straight', 20, null, false),
    ('demo_w04_parlay', 'demo', 4, 'parlay', 20, null, false),
    ('demo_w04_teaser', 'demo', 4, 'teaser', 20, 6, false),
    ('demo_w04_under', 'demo', 4, 'straight', 20, null, true),
    ('opp_w04_seahawks_ml', 'opponent', 4, 'straight', 20, null, false),
    ('opp_w04_bears_spread', 'opponent', 4, 'straight', 20, null, false),
    ('opp_w04_parlay', 'opponent', 4, 'parlay', 20, null, true),
    ('opp_w04_teaser', 'opponent', 4, 'teaser', 20, 6, false),
    ('opp_w04_over', 'opponent', 4, 'straight', 20, null, false);

  create temporary table app_review_demo_legs (
    bet_key text not null references app_review_demo_bets(bet_key),
    leg_order integer not null,
    game_key text not null references app_review_demo_games(game_key),
    market public.bet_market not null,
    selection text not null,
    original_line numeric(6,2),
    adjusted_line numeric(6,2),
    leg_odds integer not null,
    primary key (bet_key, leg_order)
  ) on commit drop;

  insert into app_review_demo_legs (
    bet_key,
    leg_order,
    game_key,
    market,
    selection,
    original_line,
    adjusted_line,
    leg_odds
  )
  values
    ('demo_w01_eagles_spread', 1, 'w01_dal_phi', 'spread', 'Philadelphia Eagles', -3.5, -3.5, -110),
    ('demo_w01_bills_ml', 1, 'w01_buf_nyj', 'moneyline', 'Buffalo Bills', null, null, -135),
    ('demo_w01_parlay', 1, 'w01_cin_cle', 'moneyline', 'Cleveland Browns', null, null, 105),
    ('demo_w01_parlay', 2, 'w01_bal_pit', 'moneyline', 'Baltimore Ravens', null, null, -125),
    ('demo_w01_teaser', 1, 'w01_kc_den', 'spread', 'Kansas City Chiefs', -12.5, -6.5, -110),
    ('demo_w01_teaser', 2, 'w01_det_chi', 'spread', 'Detroit Lions', -9.5, -3.5, -110),
    ('demo_w01_over', 1, 'w01_sf_sea', 'over_under', 'Over', 45.5, 45.5, -110),
    ('opp_w01_cowboys_ml', 1, 'w01_dal_phi', 'moneyline', 'Dallas Cowboys', null, null, 125),
    ('opp_w01_jets_spread', 1, 'w01_buf_nyj', 'spread', 'New York Jets', 2.5, 2.5, -110),
    ('opp_w01_parlay', 1, 'w01_cin_cle', 'moneyline', 'Cincinnati Bengals', null, null, -125),
    ('opp_w01_parlay', 2, 'w01_bal_pit', 'moneyline', 'Pittsburgh Steelers', null, null, 105),
    ('opp_w01_teaser', 1, 'w01_kc_den', 'spread', 'Denver Broncos', 12.5, 18.5, -110),
    ('opp_w01_teaser', 2, 'w01_det_chi', 'spread', 'Chicago Bears', 9.5, 15.5, -110),
    ('opp_w01_under', 1, 'w01_sf_sea', 'over_under', 'Under', 45.5, 45.5, -110),

    ('demo_w02_dolphins_ml', 1, 'w02_mia_ne', 'moneyline', 'Miami Dolphins', null, null, -115),
    ('demo_w02_packers_spread', 1, 'w02_gb_min', 'spread', 'Green Bay Packers', 2.5, 2.5, -110),
    ('demo_w02_parlay', 1, 'w02_tb_no', 'moneyline', 'New Orleans Saints', null, null, -105),
    ('demo_w02_parlay', 2, 'w02_lar_ari', 'moneyline', 'Arizona Cardinals', null, null, 105),
    ('demo_w02_teaser', 1, 'w02_lv_lac', 'spread', 'Las Vegas Raiders', 8.5, 14.5, -110),
    ('demo_w02_teaser', 2, 'w02_jax_ind', 'spread', 'Jacksonville Jaguars', 3.5, 9.5, -110),
    ('demo_w02_under', 1, 'w02_hou_ten', 'over_under', 'Under', 43.5, 43.5, -110),
    ('opp_w02_patriots_ml', 1, 'w02_mia_ne', 'moneyline', 'New England Patriots', null, null, 105),
    ('opp_w02_vikings_spread', 1, 'w02_gb_min', 'spread', 'Minnesota Vikings', -2.5, -2.5, -110),
    ('opp_w02_parlay', 1, 'w02_tb_no', 'moneyline', 'Tampa Bay Buccaneers', null, null, -120),
    ('opp_w02_parlay', 2, 'w02_lar_ari', 'moneyline', 'Los Angeles Rams', null, null, -115),
    ('opp_w02_teaser', 1, 'w02_lv_lac', 'spread', 'Los Angeles Chargers', -10.5, -4.5, -110),
    ('opp_w02_teaser', 2, 'w02_jax_ind', 'spread', 'Indianapolis Colts', -3.5, 2.5, -110),
    ('opp_w02_over', 1, 'w02_hou_ten', 'over_under', 'Over', 43.5, 43.5, -110),

    ('demo_w03_falcons_ml', 1, 'w03_atl_car', 'moneyline', 'Atlanta Falcons', null, null, 110),
    ('demo_w03_giants_ml', 1, 'w03_was_nyg', 'moneyline', 'New York Giants', null, null, -125),
    ('demo_w03_parlay', 1, 'w03_dal_phi', 'moneyline', 'Dallas Cowboys', null, null, 105),
    ('demo_w03_parlay', 2, 'w03_buf_nyj', 'moneyline', 'New York Jets', null, null, 115),
    ('demo_w03_teaser', 1, 'w03_cin_cle', 'spread', 'Cincinnati Bengals', -3.5, 2.5, -110),
    ('demo_w03_teaser', 2, 'w03_kc_den', 'spread', 'Kansas City Chiefs', -8.5, -2.5, -110),
    ('demo_w03_under', 1, 'w03_bal_pit', 'over_under', 'Under', 38.5, 38.5, -110),
    ('opp_w03_panthers_ml', 1, 'w03_atl_car', 'moneyline', 'Carolina Panthers', null, null, -130),
    ('opp_w03_commanders_spread', 1, 'w03_was_nyg', 'spread', 'Washington Commanders', 3.5, 3.5, -110),
    ('opp_w03_parlay', 1, 'w03_dal_phi', 'moneyline', 'Philadelphia Eagles', null, null, -125),
    ('opp_w03_parlay', 2, 'w03_buf_nyj', 'moneyline', 'Buffalo Bills', null, null, -120),
    ('opp_w03_teaser', 1, 'w03_cin_cle', 'spread', 'Cleveland Browns', 3.5, 9.5, -110),
    ('opp_w03_teaser', 2, 'w03_kc_den', 'spread', 'Denver Broncos', 8.5, 14.5, -110),
    ('opp_w03_over', 1, 'w03_bal_pit', 'over_under', 'Over', 38.5, 38.5, -110),

    ('demo_w04_49ers_ml', 1, 'w04_sf_sea', 'moneyline', 'San Francisco 49ers', null, null, 105),
    ('demo_w04_lions_spread', 1, 'w04_det_chi', 'spread', 'Detroit Lions', -3.5, -3.5, -110),
    ('demo_w04_parlay', 1, 'w04_mia_ne', 'moneyline', 'Miami Dolphins', null, null, -130),
    ('demo_w04_parlay', 2, 'w04_lar_ari', 'moneyline', 'Los Angeles Rams', null, null, -115),
    ('demo_w04_teaser', 1, 'w04_gb_min', 'spread', 'Green Bay Packers', 1.5, 7.5, -110),
    ('demo_w04_teaser', 2, 'w04_tb_no', 'spread', 'Tampa Bay Buccaneers', 4.5, 10.5, -110),
    ('demo_w04_under', 1, 'w04_lv_lac', 'over_under', 'Under', 47.5, 47.5, -110),
    ('opp_w04_seahawks_ml', 1, 'w04_sf_sea', 'moneyline', 'Seattle Seahawks', null, null, -125),
    ('opp_w04_bears_spread', 1, 'w04_det_chi', 'spread', 'Chicago Bears', 3.5, 3.5, -110),
    ('opp_w04_parlay', 1, 'w04_mia_ne', 'moneyline', 'New England Patriots', null, null, 110),
    ('opp_w04_parlay', 2, 'w04_lar_ari', 'moneyline', 'Arizona Cardinals', null, null, 105),
    ('opp_w04_teaser', 1, 'w04_gb_min', 'spread', 'Minnesota Vikings', -1.5, 4.5, -110),
    ('opp_w04_teaser', 2, 'w04_tb_no', 'spread', 'New Orleans Saints', -4.5, 1.5, -110),
    ('opp_w04_over', 1, 'w04_lv_lac', 'over_under', 'Over', 47.5, 47.5, -110);

  select count(*) into seeded_game_count from app_review_demo_games;
  select count(*) into seeded_bet_count from app_review_demo_bets;
  select count(*) into seeded_leg_count from app_review_demo_legs;

  raise notice 'Review mode: this committed script ends with ROLLBACK. Change only the final ROLLBACK to COMMIT to apply.';
  raise notice 'Target league: % (%), current visibility %, current_week %, status %',
    target_league.name,
    demo_league_id,
    target_league.visibility,
    target_league.current_week,
    target_league.status;
  raise notice 'Target accounts: % -> Jordan Ellis / Review Rebels; % -> Morgan Lee / North End Picks',
    demo_email,
    opponent_email;
  raise notice 'Will delete existing demo-only week 1-4 rows: % bets, % legs, % matchups, % standings, % slate rows, % appreview_demo live states, % appreview_demo games',
    existing_bet_count,
    existing_leg_count,
    existing_matchup_count,
    existing_standing_count,
    existing_slate_count,
    existing_live_state_count,
    existing_game_count;
  raise notice 'Will insert demo-only replacement rows: % games/slate/live states, 4 matchups, % bets, % legs',
    seeded_game_count,
    seeded_bet_count,
    seeded_leg_count;
  raise notice 'Will derive leg results, bet results/profits, matchup profits, W-L-T, ranks, and total_profit from production settlement primitives plus public.resolve_league_week.';
  raise notice 'No standings totals or matchup profits are hand-written by this script.';

  if exists (
    select 1
    from public.league_week_slate_games
    where game_id like 'appreview_demo_%'
      and league_id <> demo_league_id
  ) then
    raise exception 'Refusing to run: appreview_demo_ game ids are referenced by another league.';
  end if;

  delete from public.standings
  where league_id = demo_league_id
    and week_number between 1 and 4;

  delete from public.weekly_matchups
  where league_id = demo_league_id
    and week_number between 1 and 4;

  delete from public.bets
  where league_id = demo_league_id
    and week_number between 1 and 4;

  delete from public.league_week_slate_games
  where league_id = demo_league_id
    and week_number between 1 and 4;

  delete from public.live_game_states
  where game_id like 'appreview_demo_%';

  delete from public.games
  where game_id like 'appreview_demo_%';

  update public.users
  set display_name = case
    when id = demo_user_id then 'Jordan Ellis'
    when id = opponent_user_id then 'Morgan Lee'
    else display_name
  end
  where id in (demo_user_id, opponent_user_id);

  update public.league_members
  set team_name = case
    when user_id = demo_user_id then 'Review Rebels'
    when user_id = opponent_user_id then 'North End Picks'
    else team_name
  end
  where league_id = demo_league_id
    and user_id in (demo_user_id, opponent_user_id);

  update public.leagues
  set visibility = 'private',
      current_week = 5,
      status = 'active',
      description = 'Curated App Review demo with four completed weeks, settled picks, and derived standings.',
      settings = jsonb_set(
        jsonb_set(
          coalesce(settings, '{}'::jsonb),
          '{global_week_exempt}',
          'true'::jsonb,
          true
        ),
        '{global_week_test_fixture}',
        'true'::jsonb,
        true
      )
  where id = demo_league_id;

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
    'nfl'::public.league_sport,
    2026,
    week_number,
    commence_time,
    away_team,
    home_team
  from app_review_demo_games;

  insert into public.league_week_slate_games (
    league_id,
    week_number,
    game_id,
    commence_time,
    away_team,
    home_team
  )
  select
    demo_league_id,
    week_number,
    game_id,
    commence_time,
    away_team,
    home_team
  from app_review_demo_games
  order by week_number, commence_time;

  insert into public.weekly_matchups (
    league_id,
    week_number,
    home_user_id,
    away_user_id,
    is_playoff,
    is_championship
  )
  select
    demo_league_id,
    week_number,
    case when week_number in (1, 3) then demo_user_id else opponent_user_id end,
    case when week_number in (1, 3) then opponent_user_id else demo_user_id end,
    false,
    false
  from generate_series(1, 4) as week_number;

  create temporary table app_review_demo_bet_ids (
    bet_key text primary key,
    bet_id uuid not null default gen_random_uuid()
  ) on commit drop;

  insert into app_review_demo_bet_ids (bet_key)
  select bet_key
  from app_review_demo_bets;

  insert into public.bets (
    id,
    user_id,
    league_id,
    week_number,
    bet_type,
    amount,
    odds,
    potential_payout,
    result,
    teaser_points,
    is_lock,
    created_at
  )
  select
    ids.bet_id,
    case when bets.bettor = 'demo' then demo_user_id else opponent_user_id end,
    demo_league_id,
    bets.week_number,
    bets.bet_type,
    bets.amount,
    case
      when bets.bet_type = 'straight' then min(legs.leg_odds)
      when bets.bet_type = 'teaser' then public.teaser_odds_for(count(*)::integer, bets.teaser_points)
      else public.decimal_to_american(exp(sum(ln(public.american_to_decimal(legs.leg_odds)))))
    end as odds,
    case
      when bets.bet_type = 'straight' then public.payout_from_american(bets.amount, min(legs.leg_odds))
      when bets.bet_type = 'teaser' then public.payout_from_american(
        bets.amount,
        public.teaser_odds_for(count(*)::integer, bets.teaser_points)
      )
      else least(round(bets.amount * exp(sum(ln(public.american_to_decimal(legs.leg_odds)))), 2), 500)
    end as potential_payout,
    'pending'::public.bet_result,
    bets.teaser_points,
    bets.is_lock,
    min(games.commence_time) - interval '2 days'
  from app_review_demo_bets bets
  join app_review_demo_bet_ids ids on ids.bet_key = bets.bet_key
  join app_review_demo_legs legs on legs.bet_key = bets.bet_key
  join app_review_demo_games games on games.game_key = legs.game_key
  group by
    ids.bet_id,
    bets.bet_key,
    bets.bettor,
    bets.week_number,
    bets.bet_type,
    bets.amount,
    bets.teaser_points,
    bets.is_lock;

  insert into public.bet_legs (
    bet_id,
    game_id,
    market,
    selection,
    original_line,
    adjusted_line,
    leg_odds,
    result,
    game_start_time,
    locked
  )
  select
    ids.bet_id,
    games.game_id,
    legs.market,
    legs.selection,
    legs.original_line,
    legs.adjusted_line,
    legs.leg_odds,
    'pending'::public.bet_result,
    games.commence_time,
    false
  from app_review_demo_legs legs
  join app_review_demo_bet_ids ids on ids.bet_key = legs.bet_key
  join app_review_demo_games games on games.game_key = legs.game_key
  order by ids.bet_id, legs.leg_order;

  select public.upsert_live_game_states(
    jsonb_agg(
      jsonb_build_object(
        'id', game_id,
        'completed', true,
        'home_team', home_team,
        'away_team', away_team,
        'scores', jsonb_build_array(
          jsonb_build_object('name', home_team, 'score', home_score::text),
          jsonb_build_object('name', away_team, 'score', away_score::text)
        ),
        'sport_key', 'americanfootball_nfl',
        'sport_title', 'NFL',
        'status', 'final',
        'current_period', 'final',
        'commence_time', commence_time,
        'last_update', commence_time + interval '3 hours'
      )
      order by week_number, commence_time
    )
  )
  into live_state_result
  from app_review_demo_games;

  update public.bet_legs leg
  set result = public.evaluate_bet_leg(
        leg.market,
        leg.selection,
        leg.adjusted_line,
        games.home_team,
        games.away_team,
        games.home_score,
        games.away_score
      ),
      locked = true
  from public.bets bet,
    app_review_demo_games games
  where bet.id = leg.bet_id
    and games.game_id = leg.game_id
    and bet.league_id = demo_league_id
    and bet.week_number between 1 and 4;

  for bet_record in
    select *
    from public.bets
    where league_id = demo_league_id
      and week_number between 1 and 4
    order by week_number, created_at, id
  loop
    computed_result := null;
    computed_profit := null;

    if bet_record.bet_type = 'straight' then
      select *
      into leg_record
      from public.bet_legs
      where bet_id = bet_record.id
      limit 1;

      if leg_record.result = 'win' then
        payout := public.payout_from_american(bet_record.amount, leg_record.leg_odds);
        computed_result := 'win';
        computed_profit := round(payout - bet_record.amount, 2);
      elsif leg_record.result = 'loss' then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif leg_record.result = 'push' then
        computed_result := 'push';
        computed_profit := 0;
      end if;
    elsif bet_record.bet_type = 'parlay' then
      select
        count(*) filter (where result = 'loss'),
        count(*) filter (where result = 'pending')
      into loss_count, pending_count
      from public.bet_legs
      where bet_id = bet_record.id;

      if loss_count > 0 then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif pending_count = 0 then
        select count(*)
        into remaining_leg_count
        from public.bet_legs
        where bet_id = bet_record.id
          and result <> 'push';

        if remaining_leg_count = 0 then
          computed_result := 'push';
          computed_profit := 0;
        elsif remaining_leg_count = 1 then
          select *
          into leg_record
          from public.bet_legs
          where bet_id = bet_record.id
            and result <> 'push'
          limit 1;

          payout := public.payout_from_american(bet_record.amount, leg_record.leg_odds);
          computed_result := 'win';
          computed_profit := round(payout - bet_record.amount, 2);
        else
          combined_decimal := 1;

          for leg_record in
            select *
            from public.bet_legs
            where bet_id = bet_record.id
              and result <> 'push'
          loop
            combined_decimal := combined_decimal * public.american_to_decimal(leg_record.leg_odds);
          end loop;

          payout := least(round(bet_record.amount * combined_decimal, 2), 500);
          computed_result := 'win';
          computed_profit := round(payout - bet_record.amount, 2);
        end if;
      end if;
    elsif bet_record.bet_type = 'teaser' then
      select
        count(*) filter (where result = 'loss'),
        count(*) filter (where result = 'pending')
      into loss_count, pending_count
      from public.bet_legs
      where bet_id = bet_record.id;

      if loss_count > 0 then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif pending_count = 0 then
        select count(*)
        into remaining_leg_count
        from public.bet_legs
        where bet_id = bet_record.id
          and result <> 'push';

        if remaining_leg_count < 2 then
          computed_result := 'push';
          computed_profit := 0;
        else
          teaser_odds := public.teaser_odds_for(remaining_leg_count, bet_record.teaser_points);

          if teaser_odds is null then
            raise exception 'No teaser odds for bet %, remaining legs %, teaser points %',
              bet_record.id,
              remaining_leg_count,
              bet_record.teaser_points;
          end if;

          payout := public.payout_from_american(bet_record.amount, teaser_odds);
          computed_result := 'win';
          computed_profit := round(payout - bet_record.amount, 2);
        end if;
      end if;
    end if;

    if computed_result is null or computed_profit is null then
      raise exception 'Could not settle demo bet %', bet_record.id;
    end if;

    if bet_record.is_lock and computed_result in ('win', 'loss') then
      computed_profit := round(computed_profit * 1.5, 2);
    end if;

    update public.bets
    set result = computed_result,
        profit = computed_profit
    where id = bet_record.id;

    settlement_bet_count := settlement_bet_count + 1;
  end loop;

  perform public.resolve_league_week(demo_league_id, 1);
  perform public.resolve_league_week(demo_league_id, 2);
  perform public.resolve_league_week(demo_league_id, 3);
  perform public.resolve_league_week(demo_league_id, 4);

  raise notice 'Settlement preview complete: % live states upserted, % bets settled, 4 weeks resolved from settled picks.',
    live_state_result,
    settlement_bet_count;
end;
$$;

select
  'app_review_demo_preview' as report,
  (
    select jsonb_agg(
      jsonb_build_object(
        'week', week_number,
        'rank', rank,
        'user', users.email,
        'team', members.team_name,
        'record', concat(wins, '-', losses, '-', ties),
        'weekly_profit', weekly_profit,
        'total_profit', total_profit
      )
      order by week_number, rank, users.email
    )
    from public.standings standings
    join public.users users on users.id = standings.user_id
    join public.league_members members
      on members.league_id = standings.league_id
      and members.user_id = standings.user_id
    where standings.league_id = 'da74152d-2864-4a17-bbca-0a1acc492d55'::uuid
      and standings.week_number between 1 and 4
  ) as derived_standings,
  (
    select jsonb_agg(
      jsonb_build_object(
        'week', week_number,
        'home_profit', home_profit,
        'away_profit', away_profit,
        'winner_id', winner_id
      )
      order by week_number
    )
    from public.weekly_matchups
    where league_id = 'da74152d-2864-4a17-bbca-0a1acc492d55'::uuid
      and week_number between 1 and 4
  ) as derived_matchups;

rollback;
