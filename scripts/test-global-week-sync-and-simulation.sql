begin;

create temporary table global_week_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create or replace function pg_temp.record_result(
  p_name text,
  p_passed boolean,
  p_detail text default ''
)
returns void
language plpgsql
as $$
begin
  insert into global_week_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create temporary table global_week_context on commit drop as
select
  gen_random_uuid() as first_league_id,
  gen_random_uuid() as second_league_id,
  gen_random_uuid() as third_league_id,
  gen_random_uuid() as direct_insert_league_id,
  gen_random_uuid() as first_bet_id,
  gen_random_uuid() as second_bet_id,
  gen_random_uuid() as third_bet_id,
  id as user_id
from public.users
order by created_at, id
limit 1;

do $$
begin
  if (select count(*) from global_week_context) <> 1 then
    raise exception 'Global week tests require at least one public.users row';
  end if;
end;
$$;

select public.set_global_sport_week('nfl'::public.league_sport, 2099, 1, 'global week test bootstrap');

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
select
  first_league_id,
  'Global Week Sync Test A',
  user_id,
  'cumulative'::public.league_type,
  'private'::public.league_visibility,
  'GWA' || upper(left(replace(first_league_id::text, '-', ''), 3)),
  4,
  'nfl'::public.league_sport,
  2099,
  1,
  'active'::public.league_status
from global_week_context
union all
select
  second_league_id,
  'Global Week Sync Test B',
  user_id,
  'cumulative'::public.league_type,
  'private'::public.league_visibility,
  'GWB' || upper(left(replace(second_league_id::text, '-', ''), 3)),
  4,
  'nfl'::public.league_sport,
  2099,
  1,
  'active'::public.league_status
from global_week_context
union all
select
  third_league_id,
  'Global Week Sync Test C',
  user_id,
  'cumulative'::public.league_type,
  'private'::public.league_visibility,
  'GWC' || upper(left(replace(third_league_id::text, '-', ''), 3)),
  4,
  'nfl'::public.league_sport,
  2099,
  1,
  'drafting'::public.league_status
from global_week_context;

insert into public.league_members (league_id, user_id, team_name)
select first_league_id, user_id, 'Global Week A'
from global_week_context
union all
select second_league_id, user_id, 'Global Week B'
from global_week_context
union all
select third_league_id, user_id, 'Global Week C'
from global_week_context;

do $$
begin
  update public.leagues
  set current_week = 2
  where id = (select first_league_id from global_week_context);

  perform pg_temp.record_result(
    'single active NFL league week update is rejected',
    false,
    'direct update unexpectedly succeeded'
  );
exception
  when others then
    perform pg_temp.record_result(
      'single active NFL league week update is rejected',
      sqlerrm like 'NFL leagues use one global current week%',
      sqlerrm
    );
end;
$$;

do $$
begin
  update public.leagues
  set current_week = 2
  where id = (select third_league_id from global_week_context);

  perform pg_temp.record_result(
    'single drafting NFL league week update is rejected',
    false,
    'direct drafting-league update unexpectedly succeeded'
  );
exception
  when others then
    perform pg_temp.record_result(
      'single drafting NFL league week update is rejected',
      sqlerrm like 'NFL leagues use one global current week%',
      sqlerrm
    );
end;
$$;

select public.set_global_sport_week('nfl'::public.league_sport, 2099, 4, 'global week test move forward');

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
select
  direct_insert_league_id,
  'Global Week Direct Insert Test',
  user_id,
  'cumulative'::public.league_type,
  'private'::public.league_visibility,
  'GWD' || upper(left(replace(direct_insert_league_id::text, '-', ''), 3)),
  4,
  'nfl'::public.league_sport,
  2099,
  1,
  'drafting'::public.league_status
from global_week_context;

select pg_temp.record_result(
  'new NFL league row is coerced to the global week on insert',
  current_week = 4,
  'current_week=' || current_week::text
)
from public.leagues
where id = (select direct_insert_league_id from global_week_context);

delete from public.leagues
where id = (select direct_insert_league_id from global_week_context);

do $$
declare
  created_league_id uuid;
  created_week integer;
  standing_week integer;
begin
  perform set_config(
    'request.jwt.claim.sub',
    (select user_id::text from global_week_context),
    true
  );

  created_league_id := public.create_league(
    'Global Week Created League Test',
    'cumulative'::public.league_type,
    'private'::public.league_visibility,
    4,
    'nfl'::public.league_sport,
    '',
    2099
  );

  select current_week
  into created_week
  from public.leagues
  where id = created_league_id;

  select week_number
  into standing_week
  from public.standings
  where league_id = created_league_id
    and user_id = (select user_id from global_week_context)
  limit 1;

  perform pg_temp.record_result(
    'create_league starts at the global week with no catch-up standing',
    created_week = 4 and standing_week = 4,
    'league_week=' || coalesce(created_week::text, 'null')
      || ', standing_week=' || coalesce(standing_week::text, 'null')
  );

  delete from public.leagues where id = created_league_id;
end;
$$;

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
select first_league_id, user_id, 3, 0, 0, 0, 12, 12, 1
from global_week_context;

insert into public.weekly_matchups (
  id,
  league_id,
  week_number,
  home_user_id,
  away_user_id,
  is_playoff,
  is_championship
)
select gen_random_uuid(), first_league_id, 3, user_id, null, false, false
from global_week_context;

insert into public.league_week_slate_games (
  league_id,
  week_number,
  game_id,
  commence_time,
  away_team,
  home_team
)
select first_league_id, 3, 'global_week_future_artifact', now() + interval '14 days', 'Away Team', 'Home Team'
from global_week_context;

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
  is_lock
)
select gen_random_uuid(), user_id, first_league_id, 3, 'straight'::public.bet_type, 10, 100, 20, 'pending'::public.bet_result, false
from global_week_context;

select public.align_active_nfl_leagues_to_week(1, 2099, false, true);

select pg_temp.record_result(
  'alignment sets all NFL leagues to target week regardless of status',
  count(*) = 3 and bool_and(current_week = 1),
  'weeks=' || coalesce(jsonb_agg(current_week order by name)::text, '[]')
)
from public.leagues
where season_year = 2099
  and sport = 'nfl'
  and name like 'Global Week Sync Test%';

select pg_temp.record_result(
  'alignment prunes future artifacts past target week',
  not exists (
    select 1
    from public.standings standings
    cross join global_week_context context
    where standings.league_id in (context.first_league_id, context.second_league_id, context.third_league_id)
      and standings.week_number > 1
  )
    and not exists (
      select 1
      from public.weekly_matchups matchup
      cross join global_week_context context
      where matchup.league_id in (context.first_league_id, context.second_league_id, context.third_league_id)
        and matchup.week_number > 1
    )
    and not exists (
      select 1
      from public.league_week_slate_games slate
      cross join global_week_context context
      where slate.league_id in (context.first_league_id, context.second_league_id, context.third_league_id)
        and slate.week_number > 1
    )
    and not exists (
      select 1
      from public.bets bet
      cross join global_week_context context
      where bet.league_id in (context.first_league_id, context.second_league_id, context.third_league_id)
        and bet.week_number > 1
    ),
  'expected no future standings, matchups, slate rows, or bets after alignment'
);

insert into public.league_week_slate_games (
  league_id,
  week_number,
  game_id,
  commence_time,
  away_team,
  home_team
)
select first_league_id, 1, 'global_week_sim_game', now() + interval '7 days', 'Away Team', 'Home Team'
from global_week_context
union all
select second_league_id, 1, 'global_week_sim_game', now() + interval '7 days', 'Away Team', 'Home Team'
from global_week_context
union all
select third_league_id, 1, 'global_week_sim_game', now() + interval '7 days', 'Away Team', 'Home Team'
from global_week_context;

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
  is_lock
)
select first_bet_id, user_id, first_league_id, 1, 'straight'::public.bet_type, 10, 100, 20, 'pending'::public.bet_result, true
from global_week_context
union all
select second_bet_id, user_id, second_league_id, 1, 'straight'::public.bet_type, 10, 100, 20, 'pending'::public.bet_result, true
from global_week_context
union all
select third_bet_id, user_id, third_league_id, 1, 'straight'::public.bet_type, 10, 100, 20, 'pending'::public.bet_result, true
from global_week_context;

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
select first_bet_id, 'global_week_sim_game', 'moneyline'::public.bet_market, 'Home Team', null::numeric, null::numeric, 100, 'pending'::public.bet_result, now() + interval '7 days', false
from global_week_context
union all
select second_bet_id, 'global_week_sim_game', 'moneyline'::public.bet_market, 'Home Team', null::numeric, null::numeric, 100, 'pending'::public.bet_result, now() + interval '7 days', false
from global_week_context
union all
select third_bet_id, 'global_week_sim_game', 'moneyline'::public.bet_market, 'Home Team', null::numeric, null::numeric, 100, 'pending'::public.bet_result, now() + interval '7 days', false
from global_week_context;

select public.simulate_global_week_kickoff(1, 2099);

select pg_temp.record_result(
  'global kickoff marks week games live and locks every placed leg',
  exists (
    select 1
    from public.live_game_states
    where game_id = 'global_week_sim_game'
      and status = 'in_progress'
  )
    and (
      select count(*)
      from public.bet_legs leg
      join public.bets bet on bet.id = leg.bet_id
      cross join global_week_context context
      where bet.id in (context.first_bet_id, context.second_bet_id, context.third_bet_id)
        and leg.locked
        and leg.game_start_time <= now()
    ) = 3,
  'expected live_game_states=in_progress and every leg locked'
);

select public.simulate_global_week_completion(
  1,
  jsonb_build_array(
    jsonb_build_object(
      'id', 'global_week_sim_game',
      'home_score', 24,
      'away_score', 17
    )
  ),
  2099
);

select pg_temp.record_result(
  'global completion settles all week picks and advances every league',
  not exists (
    select 1
    from public.bets bet
    join public.leagues league on league.id = bet.league_id
    where league.sport = 'nfl'
      and league.season_year = 2099
      and bet.week_number = 1
      and bet.result = 'pending'
  )
    and (
      select count(*)
      from public.leagues
      where sport = 'nfl'
        and season_year = 2099
        and name like 'Global Week Sync Test%'
        and current_week = 2
    ) = 3,
  'expected no pending Week 1 bets and every league on Week 2'
);

select pg_temp.record_result(
  'global completion writes standings for every league',
  count(*) = 3
    and bool_and(abs(weekly_profit - 15) < 0.005)
    and bool_and(abs(total_profit - 15) < 0.005),
  'standing_rows=' || count(*)::text || ', profits=' || coalesce(jsonb_agg(total_profit)::text, '[]')
)
from public.standings standings
cross join global_week_context context
where standings.league_id in (context.first_league_id, context.second_league_id, context.third_league_id)
  and standings.week_number = 1;

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
) as global_week_test_summary
from global_week_test_results;

rollback;
