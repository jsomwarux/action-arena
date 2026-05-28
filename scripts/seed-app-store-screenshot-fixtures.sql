-- Idempotent App Store screenshot fixtures.
-- Creates global-week-exempt leagues with marketable pick-board, lineup,
-- leaderboard, and completed winning matchup states for the first two likely capture users:
-- appreview@actionarena.app and jsomwarux@yahoo.com.

begin;

create temporary table screenshot_users on commit drop as
select
  id,
  email,
  display_name,
  row_number() over (
    order by
      case
        when lower(email) = 'appreview@actionarena.app' then 0
        when lower(email) = 'jsomwarux@yahoo.com' then 1
        else 2
      end,
      created_at,
      id
  ) as slot
from public.users
order by
  case
    when lower(email) = 'appreview@actionarena.app' then 0
    when lower(email) = 'jsomwarux@yahoo.com' then 1
    else 2
  end,
  created_at,
  id
limit 10;

do $$
begin
  if (select count(*) from screenshot_users) < 6 then
    raise exception 'App Store screenshot fixtures require at least 6 public.users rows';
  end if;
end;
$$;

create or replace function pg_temp.screenshot_user(p_slot integer)
returns uuid
language sql
stable
as $$
  select id from screenshot_users where slot = p_slot
$$;

delete from public.leagues
where id = '00000000-0000-0000-0000-000000031001'::uuid
   or id = '00000000-0000-0000-0000-000000031101'::uuid
   or id = '00000000-0000-0000-0000-000000031102'::uuid
   or name in (
     'App Store Screenshot League',
     'Sunday Card League',
     'Lineup Builder League'
   );

delete from public.live_game_states
where game_id like 'appstore_%';

delete from public.games
where game_id like 'appstore_%';

insert into public.leagues (
  id,
  name,
  description,
  commissioner_id,
  type,
  visibility,
  invite_code,
  max_members,
  sport,
  season_year,
  current_week,
  status,
  settings,
  created_at
)
values
  (
    '00000000-0000-0000-0000-000000031101'::uuid,
    'Sunday Card League',
    'Polished capture fixture for the Pick Board hook shot.',
    pg_temp.screenshot_user(1),
    'h2h',
    'private',
    'SUNCAR',
    10,
    'nfl',
    2099,
    3,
    'active',
    jsonb_build_object(
      'global_week_exempt', true,
      'global_week_test_fixture', true,
      'app_store_screenshot_fixture', true,
      'app_store_capture_mode', 'hook_prefill'
    ),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000031102'::uuid,
    'Lineup Builder League',
    'Polished capture fixture for the filled weekly lineup shot.',
    pg_temp.screenshot_user(1),
    'h2h',
    'private',
    'LINBUD',
    10,
    'nfl',
    2099,
    3,
    'active',
    jsonb_build_object(
      'global_week_exempt', true,
      'global_week_test_fixture', true,
      'app_store_screenshot_fixture', true,
      'app_store_capture_mode', 'lineup_prefill'
    ),
    now() - interval '1 second'
  );

insert into public.league_members (league_id, user_id, team_name, joined_at)
select
  fixture.league_id,
  users.id,
  case users.slot
    when 1 then 'Review Rebels'
    when 2 then 'Sunday Syndicate'
    when 3 then 'North End Picks'
    when 4 then 'Fourth Quarter Club'
    when 5 then 'Primetime Pulse'
    when 6 then 'Red Zone Runners'
    when 7 then 'Gridiron Guild'
    when 8 then 'Victory Formation'
    when 9 then 'Pocket Passers'
    else 'Two-Minute Drill'
  end,
  now() + (users.slot::text || ' seconds')::interval
from screenshot_users users
cross join (
  values
    ('00000000-0000-0000-0000-000000031101'::uuid),
    ('00000000-0000-0000-0000-000000031102'::uuid)
) as fixture(league_id);

insert into public.leagues (
  id,
  name,
  description,
  commissioner_id,
  type,
  visibility,
  invite_code,
  max_members,
  sport,
  season_year,
  current_week,
  status,
  settings,
  created_at
)
values (
  '00000000-0000-0000-0000-000000031001'::uuid,
  'App Store Screenshot League',
  'Polished capture fixture with realistic standings, completed matchups, and settled picks.',
  pg_temp.screenshot_user(1),
  'h2h',
  'private',
  'APPSTR',
  10,
  'nfl',
  2099,
  3,
  'active',
  jsonb_build_object(
    'global_week_exempt', true,
    'global_week_test_fixture', true,
    'app_store_screenshot_fixture', true
  ),
  now() - interval '2 seconds'
);

insert into public.league_members (league_id, user_id, team_name, joined_at)
select
  '00000000-0000-0000-0000-000000031001'::uuid,
  users.id,
  case users.slot
    when 1 then 'Review Rebels'
    when 2 then 'Sunday Syndicate'
    when 3 then 'North End Picks'
    when 4 then 'Fourth Quarter Club'
    when 5 then 'Primetime Pulse'
    when 6 then 'Red Zone Runners'
    when 7 then 'Gridiron Guild'
    when 8 then 'Victory Formation'
    when 9 then 'Pocket Passers'
    else 'Two-Minute Drill'
  end,
  now() + (users.slot::text || ' seconds')::interval
from screenshot_users users;

insert into public.standings (
  league_id,
  user_id,
  week_number,
  wins,
  losses,
  ties,
  weekly_profit,
  total_profit,
  rank
)
select
  '00000000-0000-0000-0000-000000031001'::uuid,
  pg_temp.screenshot_user(row_data.slot),
  row_data.week_number,
  row_data.wins,
  row_data.losses,
  0,
  row_data.weekly_profit,
  row_data.total_profit,
  row_data.rank
from (
  values
    (1, 1, 1, 0, 82::numeric, 82::numeric, 1),
    (2, 1, 0, 1, -24::numeric, -24::numeric, 6),
    (3, 1, 1, 0, 36::numeric, 36::numeric, 3),
    (4, 1, 1, 0, 24::numeric, 24::numeric, 4),
    (5, 1, 1, 0, 48::numeric, 48::numeric, 2),
    (6, 1, 0, 1, -12::numeric, -12::numeric, 5),
    (7, 1, 0, 1, -18::numeric, -18::numeric, 7),
    (8, 1, 0, 1, -30::numeric, -30::numeric, 8),
    (9, 1, 0, 1, -42::numeric, -42::numeric, 9),
    (10, 1, 0, 1, -55::numeric, -55::numeric, 10),

    (1, 2, 2, 0, 42::numeric, 124::numeric, 1),
    (2, 2, 1, 1, 151::numeric, 127::numeric, 2),
    (3, 2, 1, 1, -28::numeric, 8::numeric, 6),
    (4, 2, 2, 0, 50::numeric, 74::numeric, 3),
    (5, 2, 1, 1, -8::numeric, 40::numeric, 4),
    (6, 2, 1, 1, 24::numeric, 12::numeric, 5),
    (7, 2, 1, 1, 10::numeric, -8::numeric, 7),
    (8, 2, 0, 2, 2::numeric, -28::numeric, 8),
    (9, 2, 0, 2, -18::numeric, -60::numeric, 9),
    (10, 2, 0, 2, -12::numeric, -67::numeric, 10),

    (1, 3, 3, 0, 64::numeric, 188::numeric, 2),
    (2, 3, 2, 1, 118::numeric, 245::numeric, 1),
    (3, 3, 1, 2, 35::numeric, 43::numeric, 5),
    (4, 3, 2, 1, 32::numeric, 106::numeric, 3),
    (5, 3, 2, 1, 48::numeric, 88::numeric, 4),
    (6, 3, 1, 2, -6::numeric, 6::numeric, 6),
    (7, 3, 2, 1, 12::numeric, 4::numeric, 7),
    (8, 3, 0, 3, -18::numeric, -46::numeric, 8),
    (9, 3, 1, 2, -32::numeric, -92::numeric, 9),
    (10, 3, 0, 3, -44::numeric, -111::numeric, 10)
) as row_data(slot, week_number, wins, losses, weekly_profit, total_profit, rank)
join screenshot_users users on users.slot = row_data.slot;

insert into public.weekly_matchups (
  id,
  league_id,
  week_number,
  home_user_id,
  away_user_id,
  home_profit,
  away_profit,
  winner_id,
  is_playoff,
  is_championship
)
select *
from (
  values
    ('00000000-0000-0000-0000-000000031201'::uuid, '00000000-0000-0000-0000-000000031001'::uuid, 2, pg_temp.screenshot_user(1), pg_temp.screenshot_user(3), 84::numeric, -26::numeric, pg_temp.screenshot_user(1), false, false),
    ('00000000-0000-0000-0000-000000031301'::uuid, '00000000-0000-0000-0000-000000031001'::uuid, 3, pg_temp.screenshot_user(2), pg_temp.screenshot_user(4), 118::numeric, 32::numeric, pg_temp.screenshot_user(2), false, false),
    ('00000000-0000-0000-0000-000000031302'::uuid, '00000000-0000-0000-0000-000000031001'::uuid, 3, pg_temp.screenshot_user(1), pg_temp.screenshot_user(3), 64::numeric, 35::numeric, pg_temp.screenshot_user(1), false, false),
    ('00000000-0000-0000-0000-000000031303'::uuid, '00000000-0000-0000-0000-000000031001'::uuid, 3, pg_temp.screenshot_user(5), pg_temp.screenshot_user(6), 48::numeric, -6::numeric, pg_temp.screenshot_user(5), false, false),
    ('00000000-0000-0000-0000-000000031304'::uuid, '00000000-0000-0000-0000-000000031001'::uuid, 3, pg_temp.screenshot_user(7), pg_temp.screenshot_user(8), 12::numeric, -18::numeric, pg_temp.screenshot_user(7), false, false),
    ('00000000-0000-0000-0000-000000031305'::uuid, '00000000-0000-0000-0000-000000031001'::uuid, 3, pg_temp.screenshot_user(9), pg_temp.screenshot_user(10), -32::numeric, -44::numeric, pg_temp.screenshot_user(9), false, false)
) as matchups(id, league_id, week_number, home_user_id, away_user_id, home_profit, away_profit, winner_id, is_playoff, is_championship);

insert into public.games (game_id, sport, season_year, week_number, commence_time, away_team, home_team)
select
  game_id,
  'nfl',
  2099,
  3,
  now() - interval '1 day',
  away_team,
  home_team
from (
  values
    ('appstore_w03_dal_phi', 'Dallas Cowboys', 'Philadelphia Eagles'),
    ('appstore_w03_tb_no', 'Tampa Bay Buccaneers', 'New Orleans Saints'),
    ('appstore_w03_was_nyg', 'Washington Commanders', 'New York Giants'),
    ('appstore_w03_min_gb', 'Minnesota Vikings', 'Green Bay Packers'),
    ('appstore_w03_bal_pit', 'Baltimore Ravens', 'Pittsburgh Steelers'),
    ('appstore_w03_kc_den', 'Kansas City Chiefs', 'Denver Broncos'),
    ('appstore_w03_buf_nyj', 'Buffalo Bills', 'New York Jets'),
    ('appstore_w03_sf_sea', 'San Francisco 49ers', 'Seattle Seahawks'),
    ('appstore_w03_det_chi', 'Detroit Lions', 'Chicago Bears'),
    ('appstore_w03_mia_ne', 'Miami Dolphins', 'New England Patriots')
) as games(game_id, away_team, home_team);

insert into public.league_week_slate_games (league_id, week_number, game_id, commence_time, away_team, home_team)
select
  '00000000-0000-0000-0000-000000031001'::uuid,
  3,
  game_id,
  now() - interval '1 day',
  away_team,
  home_team
from public.games
where game_id like 'appstore_w03_%';

insert into public.live_game_states (
  game_id,
  sport_key,
  away_team,
  home_team,
  away_score,
  home_score,
  current_period,
  time_remaining,
  status,
  last_updated
)
select
  game_id,
  'americanfootball_nfl',
  away_team,
  home_team,
  case game_id
    when 'appstore_w03_dal_phi' then 27
    when 'appstore_w03_tb_no' then 24
    when 'appstore_w03_was_nyg' then 17
    when 'appstore_w03_min_gb' then 20
    when 'appstore_w03_bal_pit' then 28
    when 'appstore_w03_kc_den' then 31
    when 'appstore_w03_buf_nyj' then 26
    when 'appstore_w03_sf_sea' then 30
    when 'appstore_w03_det_chi' then 23
    else 21
  end,
  case game_id
    when 'appstore_w03_dal_phi' then 24
    when 'appstore_w03_tb_no' then 20
    when 'appstore_w03_was_nyg' then 14
    when 'appstore_w03_min_gb' then 27
    when 'appstore_w03_bal_pit' then 17
    when 'appstore_w03_kc_den' then 24
    when 'appstore_w03_buf_nyj' then 19
    when 'appstore_w03_sf_sea' then 20
    when 'appstore_w03_det_chi' then 21
    else 17
  end,
  'Final',
  '0:00',
  'final',
  now()
from public.games
where game_id like 'appstore_w03_%';

create temporary table screenshot_bets (
  bet_id uuid primary key,
  slot integer not null,
  bet_type public.bet_type not null,
  amount numeric not null,
  odds integer not null,
  potential_payout numeric not null,
  result public.bet_result not null,
  profit numeric not null,
  teaser_points numeric,
  is_lock boolean not null
) on commit drop;

insert into screenshot_bets values
  ('00000000-0000-0000-0000-000000031401'::uuid, 2, 'straight', 20, 120, 44, 'win', 36, null, true),
  ('00000000-0000-0000-0000-000000031402'::uuid, 2, 'parlay', 20, 232, 66, 'win', 46, null, false),
  ('00000000-0000-0000-0000-000000031403'::uuid, 2, 'teaser', 20, -110, 38, 'win', 18, 6, false),
  ('00000000-0000-0000-0000-000000031404'::uuid, 2, 'straight', 20, -110, 38, 'loss', -20, null, false),
  ('00000000-0000-0000-0000-000000031405'::uuid, 2, 'straight', 20, -105, 39, 'win', 38, null, false),

  ('00000000-0000-0000-0000-000000031411'::uuid, 4, 'straight', 20, -110, 38, 'win', 18, null, false),
  ('00000000-0000-0000-0000-000000031412'::uuid, 4, 'straight', 20, 125, 45, 'win', 25, null, true),
  ('00000000-0000-0000-0000-000000031413'::uuid, 4, 'straight', 20, -110, 38, 'loss', -20, null, false),
  ('00000000-0000-0000-0000-000000031414'::uuid, 4, 'teaser', 20, -110, 38, 'win', 18, 6, false),
  ('00000000-0000-0000-0000-000000031415'::uuid, 4, 'straight', 20, -110, 38, 'loss', -9, null, false),

  ('00000000-0000-0000-0000-000000031421'::uuid, 1, 'straight', 20, 115, 43, 'win', 34, null, true),
  ('00000000-0000-0000-0000-000000031422'::uuid, 1, 'parlay', 20, 210, 62, 'win', 42, null, false),
  ('00000000-0000-0000-0000-000000031423'::uuid, 1, 'straight', 20, -110, 38, 'loss', -20, null, false),
  ('00000000-0000-0000-0000-000000031424'::uuid, 1, 'straight', 20, -105, 39, 'win', 38, null, false),
  ('00000000-0000-0000-0000-000000031425'::uuid, 1, 'straight', 20, -110, 38, 'loss', -30, null, false),

  ('00000000-0000-0000-0000-000000031431'::uuid, 3, 'straight', 20, -110, 38, 'win', 18, null, false),
  ('00000000-0000-0000-0000-000000031432'::uuid, 3, 'straight', 20, 120, 44, 'win', 24, null, true),
  ('00000000-0000-0000-0000-000000031433'::uuid, 3, 'straight', 20, -110, 38, 'loss', -20, null, false),
  ('00000000-0000-0000-0000-000000031434'::uuid, 3, 'parlay', 20, 165, 53, 'win', 33, null, false),
  ('00000000-0000-0000-0000-000000031435'::uuid, 3, 'straight', 20, -110, 38, 'loss', -20, null, false);

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
  profit,
  teaser_points,
  is_lock,
  created_at
)
select
  bet.bet_id,
  pg_temp.screenshot_user(bet.slot),
  '00000000-0000-0000-0000-000000031001'::uuid,
  3,
  bet.bet_type,
  bet.amount,
  bet.odds,
  bet.potential_payout,
  bet.result,
  bet.profit,
  bet.teaser_points,
  bet.is_lock,
  now() - interval '3 hours' + (bet.slot::text || ' minutes')::interval
from screenshot_bets bet;

insert into public.bet_legs (bet_id, game_id, market, selection, original_line, adjusted_line, leg_odds, result, game_start_time, locked)
values
  ('00000000-0000-0000-0000-000000031401'::uuid, 'appstore_w03_dal_phi', 'moneyline', 'Dallas Cowboys', null, null, 120, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031402'::uuid, 'appstore_w03_tb_no', 'moneyline', 'Tampa Bay Buccaneers', null, null, -135, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031402'::uuid, 'appstore_w03_was_nyg', 'over_under', 'Under 38.5', 38.5, 38.5, -110, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031403'::uuid, 'appstore_w03_min_gb', 'spread', 'Green Bay Packers -2.5', -2.5, 3.5, -110, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031403'::uuid, 'appstore_w03_bal_pit', 'over_under', 'Over 41.5', 41.5, 35.5, -110, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031404'::uuid, 'appstore_w03_kc_den', 'spread', 'Kansas City Chiefs -7.5', -7.5, -7.5, -110, 'loss', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031405'::uuid, 'appstore_w03_buf_nyj', 'moneyline', 'Buffalo Bills', null, null, -105, 'win', now() - interval '1 day', true),

  ('00000000-0000-0000-0000-000000031411'::uuid, 'appstore_w03_sf_sea', 'moneyline', 'San Francisco 49ers', null, null, -110, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031412'::uuid, 'appstore_w03_det_chi', 'moneyline', 'Detroit Lions', null, null, 125, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031413'::uuid, 'appstore_w03_mia_ne', 'spread', 'Miami Dolphins -3.5', -3.5, -3.5, -110, 'loss', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031414'::uuid, 'appstore_w03_dal_phi', 'over_under', 'Over 44.5', 44.5, 38.5, -110, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031415'::uuid, 'appstore_w03_tb_no', 'spread', 'New Orleans Saints +3.5', 3.5, 3.5, -110, 'loss', now() - interval '1 day', true),

  ('00000000-0000-0000-0000-000000031421'::uuid, 'appstore_w03_tb_no', 'moneyline', 'Tampa Bay Buccaneers', null, null, 115, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031422'::uuid, 'appstore_w03_was_nyg', 'moneyline', 'Washington Commanders', null, null, -125, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031422'::uuid, 'appstore_w03_min_gb', 'moneyline', 'Green Bay Packers', null, null, -135, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031423'::uuid, 'appstore_w03_bal_pit', 'over_under', 'Under 41.5', 41.5, 41.5, -110, 'loss', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031424'::uuid, 'appstore_w03_kc_den', 'moneyline', 'Kansas City Chiefs', null, null, -105, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031425'::uuid, 'appstore_w03_buf_nyj', 'spread', 'New York Jets +3.5', 3.5, 3.5, -110, 'loss', now() - interval '1 day', true),

  ('00000000-0000-0000-0000-000000031431'::uuid, 'appstore_w03_dal_phi', 'moneyline', 'Philadelphia Eagles', null, null, -110, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031432'::uuid, 'appstore_w03_tb_no', 'moneyline', 'New Orleans Saints', null, null, 120, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031433'::uuid, 'appstore_w03_was_nyg', 'over_under', 'Over 38.5', 38.5, 38.5, -110, 'loss', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031434'::uuid, 'appstore_w03_sf_sea', 'moneyline', 'San Francisco 49ers', null, null, -115, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031434'::uuid, 'appstore_w03_det_chi', 'moneyline', 'Detroit Lions', null, null, -110, 'win', now() - interval '1 day', true),
  ('00000000-0000-0000-0000-000000031435'::uuid, 'appstore_w03_mia_ne', 'moneyline', 'Miami Dolphins', null, null, -110, 'loss', now() - interval '1 day', true);

select jsonb_build_object(
  'leagues', jsonb_build_array(
    jsonb_build_object(
      'id', '00000000-0000-0000-0000-000000031101',
      'name', 'Sunday Card League',
      'invite_code', 'SUNCAR',
      'capture_mode', 'hook_prefill',
      'current_week', 3
    ),
    jsonb_build_object(
      'id', '00000000-0000-0000-0000-000000031102',
      'name', 'Lineup Builder League',
      'invite_code', 'LINBUD',
      'capture_mode', 'lineup_prefill',
      'current_week', 3
    ),
    jsonb_build_object(
      'id', '00000000-0000-0000-0000-000000031001',
      'name', 'App Store Screenshot League',
      'invite_code', 'APPSTR',
      'capture_mode', 'settled_results',
      'current_week', 3
    )
  ),
  'users', (
    select jsonb_agg(
      jsonb_build_object(
        'slot', slot,
        'email', email,
        'display_name', display_name,
        'id', id
      )
      order by slot
    )
    from screenshot_users
  ),
  'matchups', jsonb_build_array(
    jsonb_build_object('id', '00000000-0000-0000-0000-000000031301', 'winner_slot', 2, 'frame', 'jsomwarux current-user win'),
    jsonb_build_object('id', '00000000-0000-0000-0000-000000031302', 'winner_slot', 1, 'frame', 'appreview current-user win')
  )
) as app_store_screenshot_fixture_summary;

commit;
