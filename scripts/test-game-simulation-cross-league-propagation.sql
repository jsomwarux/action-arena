begin;

create temporary table game_simulation_cross_league_results (
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
  insert into game_simulation_cross_league_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create temporary table game_simulation_context on commit drop as
select
  gen_random_uuid() as first_league_id,
  gen_random_uuid() as second_league_id,
  gen_random_uuid() as first_bet_id,
  gen_random_uuid() as second_bet_id,
  id as user_id
from public.users
order by created_at, id
limit 1;

do $$
begin
  if (select count(*) from game_simulation_context) <> 1 then
    raise exception 'Cross-league simulation tests require at least one public.users row';
  end if;
end;
$$;

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
  'Global Game Simulation A',
  user_id,
  'cumulative'::public.league_type,
  'private'::public.league_visibility,
  'GSA' || upper(left(replace(first_league_id::text, '-', ''), 3)),
  4,
  'nfl'::public.league_sport,
  2026,
  1,
  'active'::public.league_status
from game_simulation_context
union all
select
  second_league_id,
  'Global Game Simulation B',
  user_id,
  'cumulative'::public.league_type,
  'private'::public.league_visibility,
  'GSB' || upper(left(replace(second_league_id::text, '-', ''), 3)),
  4,
  'nfl'::public.league_sport,
  2026,
  1,
  'active'::public.league_status
from game_simulation_context;

insert into public.league_members (league_id, user_id, team_name)
select first_league_id, user_id, 'Global Sim A'
from game_simulation_context
union all
select second_league_id, user_id, 'Global Sim B'
from game_simulation_context;

insert into public.league_week_slate_games (
  league_id,
  week_number,
  game_id,
  commence_time,
  away_team,
  home_team
)
select first_league_id, 1, 'global_sim_dal_phi', now() + interval '7 days', 'Away Team', 'Home Team'
from game_simulation_context
union all
select second_league_id, 1, 'global_sim_dal_phi', now() + interval '7 days', 'Away Team', 'Home Team'
from game_simulation_context;

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
from game_simulation_context
union all
select second_bet_id, user_id, second_league_id, 1, 'straight'::public.bet_type, 10, 100, 20, 'pending'::public.bet_result, true
from game_simulation_context;

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
select first_bet_id, 'global_sim_dal_phi', 'moneyline'::public.bet_market, 'Home Team', null::numeric, null::numeric, 100, 'pending'::public.bet_result, now() + interval '7 days', false
from game_simulation_context
union all
select second_bet_id, 'global_sim_dal_phi', 'moneyline'::public.bet_market, 'Home Team', null::numeric, null::numeric, 100, 'pending'::public.bet_result, now() + interval '7 days', false
from game_simulation_context;

insert into public.games (
  game_id,
  sport,
  season_year,
  week_number,
  commence_time,
  away_team,
  home_team
)
values (
  'global_sim_dal_phi',
  'nfl',
  2026,
  1,
  now() - interval '1 minute',
  'Away Team',
  'Home Team'
)
on conflict (game_id) do update
set
  commence_time = excluded.commence_time,
  away_team = excluded.away_team,
  home_team = excluded.home_team;

select pg_temp.record_result(
  'kickoff fans out slate rows across leagues',
  count(*) = 2 and bool_and(commence_time <= now()),
  'slate_rows=' || count(*)::text || ', max_commence=' || coalesce(max(commence_time)::text, 'null')
)
from public.league_week_slate_games
where game_id = 'global_sim_dal_phi';

select pg_temp.record_result(
  'kickoff fans out placed leg locks across leagues',
  count(*) = 2
    and bool_and(bl.locked)
    and bool_and(bl.game_start_time <= now()),
  'placed_legs=' || count(*)::text || ', locked=' || coalesce(bool_and(bl.locked)::text, 'null')
)
from public.bet_legs bl
where bl.game_id = 'global_sim_dal_phi';

select public.settle_completed_scores(
  jsonb_build_array(
    jsonb_build_object(
      'id', 'global_sim_dal_phi',
      'completed', true,
      'home_team', 'Home Team',
      'away_team', 'Away Team',
      'scores', jsonb_build_array(
        jsonb_build_object('name', 'Home Team', 'score', '24'),
        jsonb_build_object('name', 'Away Team', 'score', '17')
      ),
      'sport_key', 'americanfootball_nfl',
      'sport_title', 'NFL',
      'last_update', now()
    )
  )
);

select pg_temp.record_result(
  'settlement fans out bet leg results across leagues',
  count(*) = 2 and bool_and(result = 'win'::public.bet_result),
  'settled_legs=' || count(*)::text || ', results=' || coalesce(jsonb_agg(result)::text, '[]')
)
from public.bet_legs
where game_id = 'global_sim_dal_phi';

select pg_temp.record_result(
  'settlement resolves bets across leagues',
  count(*) = 2
    and bool_and(b.result = 'win'::public.bet_result)
    and bool_and(abs(coalesce(b.profit, 0) - 15) < 0.005),
  'settled_bets=' || count(*)::text || ', profits=' || coalesce(jsonb_agg(b.profit)::text, '[]')
)
from public.bets b
join game_simulation_context c
  on b.id in (c.first_bet_id, c.second_bet_id);

select pg_temp.record_result(
  'settlement resolves standings across leagues',
  count(*) = 2
    and bool_and(abs(weekly_profit - 15) < 0.005)
    and bool_and(abs(total_profit - 15) < 0.005),
  'standing_rows=' || count(*)::text || ', profits=' || coalesce(jsonb_agg(total_profit)::text, '[]')
)
from public.standings standings
cross join game_simulation_context c
where standings.league_id in (c.first_league_id, c.second_league_id)
  and standings.user_id = c.user_id
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
) as game_simulation_cross_league_test_summary
from game_simulation_cross_league_results;

rollback;
