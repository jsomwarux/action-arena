begin;

create temporary table weekly_resolution_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table weekly_resolution_users on commit drop as
select id, row_number() over (order by created_at, id) as ordinal
from public.users
order by created_at, id
limit 4;

do $$
begin
  if (select count(*) from weekly_resolution_users) < 4 then
    raise exception 'Weekly matchup resolution tests require at least 4 public.users rows';
  end if;
end;
$$;

create or replace function pg_temp.test_user(p_ordinal integer)
returns uuid
language sql
stable
as $$
  select id from weekly_resolution_users where ordinal = p_ordinal
$$;

create or replace function pg_temp.record_result(
  p_name text,
  p_passed boolean,
  p_detail text default ''
)
returns void
language plpgsql
as $$
begin
  insert into weekly_resolution_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create or replace function pg_temp.add_resolved_bet(
  p_league_id uuid,
  p_user_id uuid,
  p_week_number integer,
  p_profit numeric,
  p_result public.bet_result default 'win'::public.bet_result
)
returns void
language sql
as $$
  insert into public.bets (
    user_id,
    league_id,
    week_number,
    bet_type,
    amount,
    odds,
    potential_payout,
    result,
    profit,
    is_lock
  )
  values (
    p_user_id,
    p_league_id,
    p_week_number,
    'straight'::public.bet_type,
    10,
    100,
    20,
    p_result,
    p_profit,
    false
  );
$$;

select public.set_global_sport_week('nfl'::public.league_sport, 2097, 1, 'weekly matchup resolution test bootstrap');

insert into public.leagues (
  id,
  name,
  commissioner_id,
  type,
  visibility,
  invite_code,
  max_members,
  sport,
  season_year,
  current_week,
  status
)
values
  ('00000000-0000-0000-0000-000000014001'::uuid, 'Step 14 H2H Resolution Test', pg_temp.test_user(1), 'h2h', 'private', 'S14001', 4, 'nfl', 2097, 1, 'active'),
  ('00000000-0000-0000-0000-000000014002'::uuid, 'Step 14 Cumulative Resolution Test', pg_temp.test_user(1), 'cumulative', 'private', 'S14002', 4, 'nfl', 2097, 1, 'active');

insert into public.league_members (league_id, user_id, team_name)
select league_id, user_id, team_name
from (
  values
    ('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(1), 'H2H Player 1'),
    ('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(2), 'H2H Player 2'),
    ('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(3), 'H2H Player 3'),
    ('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(4), 'H2H Player 4'),
    ('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(1), 'Cumulative Player 1'),
    ('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(2), 'Cumulative Player 2'),
    ('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(3), 'Cumulative Player 3')
) as members(league_id, user_id, team_name);

insert into public.weekly_matchups (
  id,
  league_id,
  week_number,
  home_user_id,
  away_user_id,
  is_playoff,
  is_championship
)
values
  ('00000000-0000-0000-0000-000000014101'::uuid, '00000000-0000-0000-0000-000000014001'::uuid, 1, pg_temp.test_user(1), pg_temp.test_user(2), false, false),
  ('00000000-0000-0000-0000-000000014102'::uuid, '00000000-0000-0000-0000-000000014001'::uuid, 1, pg_temp.test_user(3), pg_temp.test_user(4), false, false),
  ('00000000-0000-0000-0000-000000014103'::uuid, '00000000-0000-0000-0000-000000014001'::uuid, 2, pg_temp.test_user(1), pg_temp.test_user(3), false, false),
  ('00000000-0000-0000-0000-000000014104'::uuid, '00000000-0000-0000-0000-000000014001'::uuid, 2, pg_temp.test_user(2), pg_temp.test_user(4), false, false),
  ('00000000-0000-0000-0000-000000014105'::uuid, '00000000-0000-0000-0000-000000014001'::uuid, 3, pg_temp.test_user(1), pg_temp.test_user(4), false, false),
  ('00000000-0000-0000-0000-000000014106'::uuid, '00000000-0000-0000-0000-000000014001'::uuid, 3, pg_temp.test_user(2), pg_temp.test_user(3), false, false);

-- Week 1 covers 14.1 and 14.4: Player 1 beats Player 2; Player 4 has no bets and loses to Player 3's positive profit.
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(1), 1, 45);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(2), 1, -12, 'loss'::public.bet_result);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(3), 1, 8);

-- Week 2 covers 14.2: Player 1 and Player 3 tie exactly.
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(1), 2, 5);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(3), 2, 5);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(2), 2, -4, 'loss'::public.bet_result);

-- Week 3 completes the multi-week standings check in 14.5.
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(1), 3, 10);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(2), 3, 20);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014001'::uuid, pg_temp.test_user(3), 3, -5, 'loss'::public.bet_result);

-- Cumulative league covers 14.3 across three weeks.
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(1), 1, 30);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(2), 1, -10, 'loss'::public.bet_result);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(1), 2, -5, 'loss'::public.bet_result);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(2), 2, 15);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(2), 3, 10);
select pg_temp.add_resolved_bet('00000000-0000-0000-0000-000000014002'::uuid, pg_temp.test_user(3), 3, -20, 'loss'::public.bet_result);

select public.resolve_league_week('00000000-0000-0000-0000-000000014001'::uuid, 1);
select public.resolve_league_week('00000000-0000-0000-0000-000000014002'::uuid, 1);
select public.resolve_league_week('00000000-0000-0000-0000-000000014001'::uuid, 2);
select public.resolve_league_week('00000000-0000-0000-0000-000000014002'::uuid, 2);
select public.resolve_league_week('00000000-0000-0000-0000-000000014001'::uuid, 3);
select public.resolve_league_week('00000000-0000-0000-0000-000000014002'::uuid, 3);

select pg_temp.record_result(
  '14.1 H2H winner determination updates matchup winner',
  home_profit = 45
    and away_profit = -12
    and winner_id = pg_temp.test_user(1),
  'home=' || coalesce(home_profit::text, 'null')
    || ', away=' || coalesce(away_profit::text, 'null')
    || ', winner=' || coalesce(winner_id::text, 'null')
)
from public.weekly_matchups
where id = '00000000-0000-0000-0000-000000014101'::uuid;

select pg_temp.record_result(
  '14.1 H2H winner and loser standings are 1-0-0 and 0-1-0',
  bool_and(
    (user_id = pg_temp.test_user(1) and wins = 1 and losses = 0 and ties = 0 and total_profit = 45)
    or (user_id = pg_temp.test_user(2) and wins = 0 and losses = 1 and ties = 0 and total_profit = -12)
  )
    and count(*) = 2,
  coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'w', wins, 'l', losses, 't', ties, 'total', total_profit) order by user_id)::text, '[]')
)
from public.standings
where league_id = '00000000-0000-0000-0000-000000014001'::uuid
  and week_number = 1
  and user_id in (pg_temp.test_user(1), pg_temp.test_user(2));

select pg_temp.record_result(
  '14.2 H2H tie gives both players a tie and no winner',
  matchup.winner_id is null
    and standings_ok.passed,
  'winner=' || coalesce(matchup.winner_id::text, 'null') || ', standings=' || standings_ok.detail
)
from public.weekly_matchups matchup
cross join lateral (
  select
    count(*) = 2
      and bool_and(wins = 1 and losses = 0 and ties = 1 and total_profit in (50, 13)) as passed,
    coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'w', wins, 'l', losses, 't', ties, 'total', total_profit) order by user_id)::text, '[]') as detail
  from public.standings
  where league_id = '00000000-0000-0000-0000-000000014001'::uuid
    and week_number = 2
    and user_id in (pg_temp.test_user(1), pg_temp.test_user(3))
) standings_ok
where matchup.id = '00000000-0000-0000-0000-000000014103'::uuid;

select pg_temp.record_result(
  '14.3 cumulative league totals and ranks are ordered by total profit',
  count(*) = 3
    and bool_and(wins = 0 and losses = 0 and ties = 0)
    and bool_and(
      (user_id = pg_temp.test_user(2) and total_profit = 15 and rank = 1)
      or (user_id = pg_temp.test_user(1) and total_profit = -75 and rank = 2)
      or (user_id = pg_temp.test_user(3) and total_profit = -220 and rank = 3)
    ),
  coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'rank', rank, 'weekly', weekly_profit, 'total', total_profit, 'w', wins, 'l', losses, 't', ties) order by rank)::text, '[]')
)
from public.standings
where league_id = '00000000-0000-0000-0000-000000014002'::uuid
  and week_number = 3;

select pg_temp.record_result(
  '14.4 no-pick player receives -100 weekly profit and loses to positive opponent',
  matchup.home_profit = 8
    and matchup.away_profit = -100
    and matchup.winner_id = pg_temp.test_user(3)
    and no_pick.weekly_profit = -100
    and no_pick.total_profit = -100
    and no_pick.wins = 0
    and no_pick.losses = 1
    and no_pick.ties = 0,
  'matchup home=' || coalesce(matchup.home_profit::text, 'null')
    || ', away=' || coalesce(matchup.away_profit::text, 'null')
    || ', winner=' || coalesce(matchup.winner_id::text, 'null')
    || ', player4=' || jsonb_build_object('weekly', no_pick.weekly_profit, 'total', no_pick.total_profit, 'w', no_pick.wins, 'l', no_pick.losses, 't', no_pick.ties)::text
)
from public.weekly_matchups matchup
join public.standings no_pick
  on no_pick.league_id = matchup.league_id
  and no_pick.week_number = matchup.week_number
  and no_pick.user_id = pg_temp.test_user(4)
where matchup.id = '00000000-0000-0000-0000-000000014102'::uuid;

select pg_temp.record_result(
  '14.5 H2H standings rank by record before total profit over three weeks',
  count(*) = 4
    and bool_and(
      (user_id = pg_temp.test_user(1) and wins = 2 and losses = 0 and ties = 1 and total_profit = 60 and rank = 1)
      or (user_id = pg_temp.test_user(2) and wins = 2 and losses = 1 and ties = 0 and total_profit = 4 and rank = 2)
      or (user_id = pg_temp.test_user(3) and wins = 1 and losses = 1 and ties = 1 and total_profit = 8 and rank = 3)
      or (user_id = pg_temp.test_user(4) and wins = 0 and losses = 3 and ties = 0 and total_profit = -300 and rank = 4)
    ),
  coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'rank', rank, 'w', wins, 'l', losses, 't', ties, 'weekly', weekly_profit, 'total', total_profit) order by rank)::text, '[]')
)
from public.standings
where league_id = '00000000-0000-0000-0000-000000014001'::uuid
  and week_number = 3;

select jsonb_build_object(
  'total', count(*),
  'passed', count(*) filter (where passed),
  'failed', count(*) filter (where not passed),
  'results', jsonb_agg(
    jsonb_build_object(
      'name', name,
      'status', case when passed then 'PASS' else 'FAIL' end,
      'detail', detail
    )
    order by name
  )
) as weekly_matchup_resolution_test_summary
from weekly_resolution_test_results;

rollback;
