\set ON_ERROR_STOP on

begin;

do $$
begin
  if current_database() <> 'postgres'
    or inet_server_addr() is distinct from '172.18.0.2'::inet
       and inet_server_addr() is distinct from '172.19.0.2'::inet
       and inet_server_addr() is distinct from '172.20.0.2'::inet
       and current_setting('is_superuser', true) is null
  then
    raise exception 'Release fixtures must run only in the local Supabase database';
  end if;

  if exists (
    select 1
    from public.leagues
    where id between
      '20000000-0000-0000-0000-000000000001'::uuid
      and '20000000-0000-0000-0000-000000000099'::uuid
  ) then
    raise exception 'Release fixture IDs already exist; reset the local database first';
  end if;

  if (
    select count(*)
    from public.users
    where id between
      '10000000-0000-0000-0000-000000000001'::uuid
      and '10000000-0000-0000-0000-000000000099'::uuid
  ) <> 12 then
    raise exception 'Expected 12 deterministic release Auth users';
  end if;
end;
$$;

create or replace function pg_temp.fixture_uuid(p_label text)
returns uuid
language sql
immutable
as $$
  select (
    substr(value, 1, 8) || '-' ||
    substr(value, 9, 4) || '-' ||
    substr(value, 13, 4) || '-' ||
    substr(value, 17, 4) || '-' ||
    substr(value, 21, 12)
  )::uuid
  from (select md5(p_label) as value) digest
$$;

create or replace function pg_temp.add_straight(
  p_label text,
  p_user_id uuid,
  p_league_id uuid,
  p_ordinal integer,
  p_start_time timestamptz,
  p_locked boolean default false,
  p_result public.bet_result default 'pending',
  p_profit numeric default null,
  p_is_lock boolean default false
)
returns uuid
language plpgsql
as $$
declare
  target_bet_id uuid := pg_temp.fixture_uuid(p_label || ':bet:' || p_ordinal);
  target_game_id text := p_label || '-game-' || p_ordinal;
begin
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
  values (
    target_bet_id,
    p_user_id,
    p_league_id,
    1,
    'straight',
    20,
    -110,
    38.18,
    p_result,
    p_profit,
    null,
    p_is_lock,
    '2026-07-01 12:00:00+00'::timestamptz + make_interval(secs => p_ordinal)
  );

  insert into public.bet_legs (
    id,
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
  values (
    pg_temp.fixture_uuid(p_label || ':leg:' || p_ordinal),
    target_bet_id,
    target_game_id,
    'spread',
    'Release Team ' || p_ordinal,
    -3.5,
    -3.5,
    -110,
    p_result,
    p_start_time,
    p_locked
  );

  return target_bet_id;
end;
$$;

insert into public.global_sport_weeks (
  sport,
  season_year,
  current_week,
  updated_by
)
values ('nfl', 2026, 1, 'release-verification')
on conflict (sport, season_year) do update
set current_week = excluded.current_week,
    updated_by = excluded.updated_by;

delete from public.games
where game_id like 'release-%';

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
  ('20000000-0000-0000-0000-000000000001', 'Release Public H2H', 'Public discovery fixture', '10000000-0000-0000-0000-000000000003', 'h2h', 'public', 'PUB001', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:01:00+00'),
  ('20000000-0000-0000-0000-000000000002', 'Release Private Cumulative', 'Private invite fixture', '10000000-0000-0000-0000-000000000003', 'cumulative', 'private', 'PRV002', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:02:00+00'),
  ('20000000-0000-0000-0000-000000000003', 'Release Unsubmitted Card', 'Current-week empty card fixture', '10000000-0000-0000-0000-000000000003', 'cumulative', 'private', 'UNS003', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:03:00+00'),
  ('20000000-0000-0000-0000-000000000004', 'Release Editable Card', 'Submitted editable card fixture', '10000000-0000-0000-0000-000000000003', 'cumulative', 'private', 'EDT004', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:04:00+00'),
  ('20000000-0000-0000-0000-000000000005', 'Release Partial Lock', 'Partially locked matchup fixture', '10000000-0000-0000-0000-000000000003', 'h2h', 'private', 'PRT005', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:05:00+00'),
  ('20000000-0000-0000-0000-000000000006', 'Release Revealed Matchup', 'Fully locked reveal fixture', '10000000-0000-0000-0000-000000000003', 'h2h', 'private', 'REV006', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:06:00+00'),
  ('20000000-0000-0000-0000-000000000007', 'Release Settled Matchup', 'Settled matchup fixture', '10000000-0000-0000-0000-000000000003', 'h2h', 'private', 'SET007', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:07:00+00'),
  ('20000000-0000-0000-0000-000000000008', 'Release Moderation Chat', 'Chat moderation fixture', '10000000-0000-0000-0000-000000000003', 'h2h', 'private', 'CHT008', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:08:00+00'),
  ('20000000-0000-0000-0000-000000000009', 'Release Delete Member', 'Member deletion fixture', '10000000-0000-0000-0000-000000000003', 'cumulative', 'private', 'DEL009', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:09:00+00'),
  ('20000000-0000-0000-0000-000000000010', 'Release Delete Commissioner', 'Commissioner reassignment fixture', '10000000-0000-0000-0000-000000000006', 'cumulative', 'private', 'DLC010', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:10:00+00'),
  ('20000000-0000-0000-0000-000000000011', 'Release Delete Only Member', 'Only-member league deletion fixture', '10000000-0000-0000-0000-000000000007', 'cumulative', 'private', 'DLO011', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:11:00+00'),
  ('20000000-0000-0000-0000-000000000012', 'Release Submit Card', 'Mutating card submission fixture', '10000000-0000-0000-0000-000000000003', 'cumulative', 'private', 'SUB012', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:12:00+00'),
  ('20000000-0000-0000-0000-000000000013', 'Release Commissioner Actions', 'Commissioner authorization fixture', '10000000-0000-0000-0000-000000000003', 'h2h', 'private', 'COM013', 10, 'nfl', 2026, 1, 'drafting', '{"release_fixture":true}', '2026-07-01 10:13:00+00'),
  ('20000000-0000-0000-0000-000000000014', 'Release Realtime', 'Two-session realtime fixture', '10000000-0000-0000-0000-000000000003', 'h2h', 'private', 'RTC014', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:14:00+00'),
  ('20000000-0000-0000-0000-000000000015', 'Release Public Cumulative', 'Public cumulative contract fixture', '10000000-0000-0000-0000-000000000003', 'cumulative', 'public', 'CUM015', 10, 'nfl', 2026, 1, 'active', '{"release_fixture":true}', '2026-07-01 10:15:00+00');

insert into public.league_members (
  id,
  league_id,
  user_id,
  team_name,
  joined_at
)
values
  (pg_temp.fixture_uuid('public:commissioner'), '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Commissioner Crew', '2026-07-01 11:00:00+00'),
  (pg_temp.fixture_uuid('public:user-one'), '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'User One Public', '2026-07-01 11:01:00+00'),
  (pg_temp.fixture_uuid('public:blocked-validator'), '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'Validation Fixture', '2026-07-01 11:01:01+00'),
  (pg_temp.fixture_uuid('private:commissioner'), '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'Commissioner Private', '2026-07-01 11:02:00+00'),
  (pg_temp.fixture_uuid('unsubmitted:user-one'), '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Unsubmitted User', '2026-07-01 11:03:00+00'),
  (pg_temp.fixture_uuid('editable:user-two'), '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Editable User', '2026-07-01 11:04:00+00'),
  (pg_temp.fixture_uuid('partial:user-one'), '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Partial Home', '2026-07-01 11:05:00+00'),
  (pg_temp.fixture_uuid('partial:user-two'), '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Partial Away', '2026-07-01 11:05:01+00'),
  (pg_temp.fixture_uuid('revealed:user-one'), '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Revealed Home', '2026-07-01 11:06:00+00'),
  (pg_temp.fixture_uuid('revealed:user-two'), '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'Revealed Away', '2026-07-01 11:06:01+00'),
  (pg_temp.fixture_uuid('settled:user-one'), '20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Settled Home', '2026-07-01 11:07:00+00'),
  (pg_temp.fixture_uuid('settled:user-two'), '20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'Settled Away', '2026-07-01 11:07:01+00'),
  (pg_temp.fixture_uuid('chat:commissioner'), '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', 'Chat Commissioner', '2026-07-01 11:08:00+00'),
  (pg_temp.fixture_uuid('chat:user-one'), '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Chat User One', '2026-07-01 11:08:01+00'),
  (pg_temp.fixture_uuid('chat:user-two'), '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'Chat User Two', '2026-07-01 11:08:02+00'),
  (pg_temp.fixture_uuid('chat:blocked'), '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000011', 'Blocked Fixture', '2026-07-01 11:08:03+00'),
  (pg_temp.fixture_uuid('delete-member:commissioner'), '20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', 'Delete Member Owner', '2026-07-01 11:09:00+00'),
  (pg_temp.fixture_uuid('delete-member:member'), '20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000005', 'Deleted Member', '2026-07-01 11:09:01+00'),
  (pg_temp.fixture_uuid('delete-commissioner:owner'), '20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000006', 'Deleted Commissioner', '2026-07-01 11:10:00+00'),
  (pg_temp.fixture_uuid('delete-commissioner:successor'), '20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Commissioner Successor', '2026-07-01 11:10:01+00'),
  (pg_temp.fixture_uuid('delete-only:owner'), '20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000007', 'Only Member', '2026-07-01 11:11:00+00'),
  (pg_temp.fixture_uuid('submit:submitter'), '20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000009', 'Submitter', '2026-07-01 11:12:00+00'),
  (pg_temp.fixture_uuid('commissioner:owner'), '20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000003', 'Commissioner Owner', '2026-07-01 11:13:00+00'),
  (pg_temp.fixture_uuid('commissioner:member'), '20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Ordinary Member', '2026-07-01 11:13:01+00'),
  (pg_temp.fixture_uuid('realtime:commissioner'), '20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000003', 'Realtime Commissioner', '2026-07-01 11:14:00+00'),
  (pg_temp.fixture_uuid('realtime:user-one'), '20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Realtime One', '2026-07-01 11:14:01+00'),
  (pg_temp.fixture_uuid('realtime:user-two'), '20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000002', 'Realtime Two', '2026-07-01 11:14:02+00'),
  (pg_temp.fixture_uuid('cumulative:commissioner'), '20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000003', 'Cumulative Commissioner', '2026-07-01 11:15:00+00'),
  (pg_temp.fixture_uuid('cumulative:duplicate'), '20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000012', 'Duplicate Fixture', '2026-07-01 11:15:01+00');

insert into public.standings (
  id,
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
  pg_temp.fixture_uuid('standing:' || lm.league_id || ':' || lm.user_id),
  lm.league_id,
  lm.user_id,
  1,
  0,
  0,
  0,
  0,
  0,
  row_number() over (
    partition by lm.league_id
    order by lm.joined_at, lm.id
  )::integer
from public.league_members lm
where lm.league_id between
  '20000000-0000-0000-0000-000000000001'::uuid
  and '20000000-0000-0000-0000-000000000015'::uuid;

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
  'release-game-' || lpad(ordinal::text, 2, '0'),
  'nfl',
  2026,
  1,
  '2099-09-10 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  'Release Away ' || ordinal,
  'Release Home ' || ordinal
from generate_series(1, 10) ordinal;

insert into public.league_week_slate_games (
  id,
  league_id,
  week_number,
  game_id,
  commence_time,
  away_team,
  home_team
)
select
  pg_temp.fixture_uuid('slate:' || target.league_id || ':' || game.game_id),
  target.league_id,
  1,
  game.game_id,
  game.commence_time,
  game.away_team,
  game.home_team
from (
  values
    ('20000000-0000-0000-0000-000000000003'::uuid),
    ('20000000-0000-0000-0000-000000000004'::uuid),
    ('20000000-0000-0000-0000-000000000012'::uuid)
) target(league_id)
cross join public.games game
where game.game_id like 'release-game-%';

select pg_temp.add_straight(
  'editable',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000004',
  ordinal,
  '2099-09-10 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  false,
  'pending',
  null,
  ordinal = 1
)
from generate_series(1, 5) ordinal;

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
values
  ('30000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005', 1, 'parlay', 20, 264, 72.80, 'pending', null, null, true, '2026-07-01 12:05:01+00'),
  ('30000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005', 1, 'parlay', 20, 264, 72.80, 'pending', null, null, true, '2026-07-01 12:05:02+00');

insert into public.bet_legs (
  id,
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
values
  ('40000000-0000-0000-0000-000000000501', '30000000-0000-0000-0000-000000000501', 'release-partial-home-started', 'spread', 'Partial Home Started', -3.5, -3.5, -110, 'pending', '2020-09-10 17:00:00+00', true),
  ('40000000-0000-0000-0000-000000000502', '30000000-0000-0000-0000-000000000501', 'release-partial-home-future', 'spread', 'Partial Home Future', -3.5, -3.5, -110, 'pending', '2099-09-10 17:00:00+00', false),
  ('40000000-0000-0000-0000-000000000503', '30000000-0000-0000-0000-000000000502', 'release-partial-away-started', 'spread', 'Partial Away Started', 3.5, 3.5, -110, 'pending', '2020-09-10 17:00:00+00', true),
  ('40000000-0000-0000-0000-000000000504', '30000000-0000-0000-0000-000000000502', 'release-partial-away-future', 'spread', 'Partial Away Future', 3.5, 3.5, -110, 'pending', '2099-09-10 18:00:00+00', false);

select pg_temp.add_straight(
  'partial-home',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000005',
  ordinal,
  '2099-09-11 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  false,
  'pending',
  null,
  false
)
from generate_series(2, 5) ordinal;

select pg_temp.add_straight(
  'partial-away',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000005',
  ordinal,
  '2099-09-12 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  false,
  'pending',
  null,
  false
)
from generate_series(2, 5) ordinal;

select pg_temp.add_straight(
  'revealed-home',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000006',
  ordinal,
  '2020-09-10 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  true,
  'pending',
  null,
  ordinal = 1
)
from generate_series(1, 5) ordinal;

select pg_temp.add_straight(
  'revealed-away',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000006',
  ordinal,
  '2020-09-11 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  true,
  'pending',
  null,
  ordinal = 1
)
from generate_series(1, 5) ordinal;

select pg_temp.add_straight(
  'settled-home',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000007',
  ordinal,
  '2020-09-10 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  true,
  'win',
  18.18,
  ordinal = 1
)
from generate_series(1, 5) ordinal;

select pg_temp.add_straight(
  'settled-away',
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000007',
  ordinal,
  '2020-09-11 17:00:00+00'::timestamptz + make_interval(hours => ordinal),
  true,
  'loss',
  -20,
  ordinal = 1
)
from generate_series(1, 5) ordinal;

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
values
  ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 1, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', null, null, null, false, false),
  ('50000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 1, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', null, null, null, false, false),
  ('50000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 1, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 90.90, -100, '10000000-0000-0000-0000-000000000001', false, false);

set local app.allow_arena_coin_update = 'true';
update public.users
set arena_coins = case
    when id = '10000000-0000-0000-0000-000000000009' then 50
    when id = '10000000-0000-0000-0000-000000000002' then 0
    else 500
  end,
  chat_terms_accepted_at = case
    when id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000011'
    ) then '2026-07-01 12:30:00+00'::timestamptz
    else chat_terms_accepted_at
  end
where id between
  '10000000-0000-0000-0000-000000000001'::uuid
  and '10000000-0000-0000-0000-000000000012'::uuid;

insert into public.user_cosmetics (
  id,
  user_id,
  item_id,
  category,
  is_equipped,
  equipped_at,
  metadata
)
values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'frame_electric',
  'profile_frame',
  true,
  '2026-07-01 12:31:00+00',
  '{"release_fixture":true}'
);

insert into public.season_passes (
  id,
  user_id,
  season_year,
  redeemed_code,
  source,
  created_at
)
values (
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  2026,
  null,
  'release_fixture',
  '2026-07-01 12:32:00+00'
);

select public.grant_season_pass_cosmetics(
  '10000000-0000-0000-0000-000000000003',
  2026
);

insert into public.season_pass_redeem_codes (
  code,
  season_year,
  max_redemptions,
  redeemed_count,
  active,
  expires_at
)
values ('RELEASE-PASS', 2026, 1, 0, true, '2099-12-31 23:59:59+00')
on conflict (code) do update
set season_year = excluded.season_year,
    max_redemptions = excluded.max_redemptions,
    redeemed_count = 0,
    active = true,
    expires_at = excluded.expires_at;

insert into public.league_chat_messages (
  id,
  league_id,
  user_id,
  message_type,
  body,
  metadata,
  created_at
)
values
  ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'user', 'Release chat message from user two', '{}', '2026-07-01 12:33:00+00'),
  ('80000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000011', 'user', 'Fixture message hidden by the initial block', '{}', '2026-07-01 12:33:01+00');

insert into public.user_blocks (
  id,
  blocker_id,
  blocked_id,
  league_id,
  created_at
)
values (
  '90000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000011',
  '20000000-0000-0000-0000-000000000008',
  '2026-07-01 12:34:00+00'
);

insert into public.notification_preferences (user_id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000009')
on conflict (user_id) do nothing;

commit;

select jsonb_build_object(
  'status', 'release fixtures seeded',
  'users', 12,
  'leagues', 15,
  'matchups', 3
)::text;
