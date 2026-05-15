begin;

create temporary table playoff_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table playoff_context on commit drop as
select gen_random_uuid() as league_id;

create temporary table playoff_users on commit drop as
select id, row_number() over (order by created_at, id) as seed
from public.users
order by created_at, id
limit 8;

do $$
begin
  if (select count(*) from playoff_users) < 8 then
    raise exception 'Playoff and championship tests require at least 8 public.users rows';
  end if;
end;
$$;

create or replace function pg_temp.test_user(p_seed integer)
returns uuid
language sql
stable
as $$
  select id from playoff_users where seed = p_seed
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
  insert into playoff_test_results (name, passed, detail)
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
  p_profit numeric
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
    case when p_profit < 0 then 'loss'::public.bet_result else 'win'::public.bet_result end,
    p_profit,
    false
  );
$$;

select public.set_global_sport_week('nfl'::public.league_sport, 2096, 14, 'playoff championship test bootstrap');

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
  league_id,
  'Playoff Championship Regression Test',
  pg_temp.test_user(1),
  'h2h'::public.league_type,
  'private'::public.league_visibility,
  'PCT' || upper(left(replace(league_id::text, '-', ''), 3)),
  8,
  'nfl'::public.league_sport,
  2096,
  14,
  'active'::public.league_status
from playoff_context;

insert into public.league_members (league_id, user_id, team_name, joined_at)
select
  context.league_id,
  users.id,
  'Seed ' || users.seed::text,
  now() + (users.seed::text || ' seconds')::interval
from playoff_context context
join playoff_users users on true;

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
  context.league_id,
  users.id,
  13,
  13 - users.seed,
  users.seed - 1,
  0,
  (900 - (users.seed * 100))::numeric,
  (900 - (users.seed * 100))::numeric,
  users.seed
from playoff_context context
join playoff_users users on true;

insert into public.weekly_matchups (
  league_id,
  week_number,
  home_user_id,
  away_user_id,
  is_playoff,
  is_championship
)
select context.league_id, 14, pg_temp.test_user(1), pg_temp.test_user(8), false, false from playoff_context context
union all
select context.league_id, 14, pg_temp.test_user(2), pg_temp.test_user(7), false, false from playoff_context context
union all
select context.league_id, 14, pg_temp.test_user(3), pg_temp.test_user(6), false, false from playoff_context context
union all
select context.league_id, 14, pg_temp.test_user(4), pg_temp.test_user(5), false, false from playoff_context context;

select pg_temp.add_resolved_bet(context.league_id, users.id, 14, 10 - users.seed)
from playoff_context context
join playoff_users users on true;

select public.resolve_league_week(league_id, 14)
from playoff_context;

select pg_temp.record_result(
  '21.2 Week 14 completion moves H2H league into playoffs',
  league.status = 'playoffs',
  'status=' || league.status::text || ', current_week=' || league.current_week::text
)
from public.leagues league
join playoff_context context on context.league_id = league.id;

select pg_temp.record_result(
  '21.2 Week 15 playoff bracket seeds 1v8, 4v5, 3v6, 2v7',
  count(*) = 4
    and bool_and(is_playoff)
    and bool_and(not is_championship)
    and bool_or(home_user_id = pg_temp.test_user(1) and away_user_id = pg_temp.test_user(8))
    and bool_or(home_user_id = pg_temp.test_user(4) and away_user_id = pg_temp.test_user(5))
    and bool_or(home_user_id = pg_temp.test_user(3) and away_user_id = pg_temp.test_user(6))
    and bool_or(home_user_id = pg_temp.test_user(2) and away_user_id = pg_temp.test_user(7)),
  coalesce(jsonb_agg(jsonb_build_object('home', home_user_id, 'away', away_user_id, 'championship', is_championship) order by home_user_id)::text, '[]')
)
from public.weekly_matchups matchup
join playoff_context context on context.league_id = matchup.league_id
where matchup.week_number = 15;

-- Week 15 winners: seeds 1, 5, 3, and 2.
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(1), 15, 50) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(8), 15, -10) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(4), 15, 5) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(5), 15, 30) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(3), 15, 40) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(6), 15, -20) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(2), 15, 35) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(7), 15, -15) from playoff_context context;

select public.resolve_league_week(league_id, 15)
from playoff_context;

select pg_temp.record_result(
  '21.3 Week 16 semifinal uses Week 15 winners and excludes eliminated teams',
  count(*) = 2
    and bool_and(is_playoff)
    and bool_and(not is_championship)
    and bool_or(home_user_id = pg_temp.test_user(1) and away_user_id = pg_temp.test_user(5))
    and bool_or(home_user_id = pg_temp.test_user(2) and away_user_id = pg_temp.test_user(3))
    and not exists (
      select 1
      from public.weekly_matchups eliminated_matchup
      join playoff_context eliminated_context on eliminated_context.league_id = eliminated_matchup.league_id
      where eliminated_matchup.week_number = 16
        and (
          eliminated_matchup.home_user_id in (pg_temp.test_user(4), pg_temp.test_user(6), pg_temp.test_user(7), pg_temp.test_user(8))
          or eliminated_matchup.away_user_id in (pg_temp.test_user(4), pg_temp.test_user(6), pg_temp.test_user(7), pg_temp.test_user(8))
        )
    ),
  coalesce(jsonb_agg(jsonb_build_object('home', home_user_id, 'away', away_user_id) order by home_user_id)::text, '[]')
)
from public.weekly_matchups matchup
join playoff_context context on context.league_id = matchup.league_id
where matchup.week_number = 16;

-- Eliminated players can still place Week 16 bets; they should not re-enter the bracket.
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(4), 16, 25) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(6), 16, 20) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(7), 16, 15) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(8), 16, 10) from playoff_context context;

select pg_temp.record_result(
  '21.3 Eliminated players can place bets without being in the semifinal bracket',
  count(*) = 4
    and not exists (
      select 1
      from public.weekly_matchups matchup
      join playoff_context context on context.league_id = matchup.league_id
      where matchup.week_number = 16
        and (
          matchup.home_user_id in (pg_temp.test_user(4), pg_temp.test_user(6), pg_temp.test_user(7), pg_temp.test_user(8))
          or matchup.away_user_id in (pg_temp.test_user(4), pg_temp.test_user(6), pg_temp.test_user(7), pg_temp.test_user(8))
        )
    ),
  'eliminated_week_16_bets=' || count(*)::text
)
from public.bets bet
join playoff_context context on context.league_id = bet.league_id
where bet.week_number = 16
  and bet.user_id in (pg_temp.test_user(4), pg_temp.test_user(6), pg_temp.test_user(7), pg_temp.test_user(8));

-- Week 16 winners: seeds 1 and 3.
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(1), 16, 45) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(5), 16, -5) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(2), 16, 5) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(3), 16, 35) from playoff_context context;

select public.resolve_league_week(league_id, 16)
from playoff_context;

select pg_temp.record_result(
  '21.3 Week 17 championship is between the two remaining players',
  count(*) = 1
    and bool_and(is_playoff)
    and bool_and(is_championship)
    and bool_or(home_user_id = pg_temp.test_user(1) and away_user_id = pg_temp.test_user(3)),
  coalesce(jsonb_agg(jsonb_build_object('home', home_user_id, 'away', away_user_id, 'championship', is_championship))::text, '[]')
)
from public.weekly_matchups matchup
join playoff_context context on context.league_id = matchup.league_id
where matchup.week_number = 17;

-- Week 17 winner: seed 3 wins the championship, while seed 1 remains total-profit leader.
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(1), 17, 1) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(3), 17, 60) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(2), 17, 30) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(4), 17, 25) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(5), 17, 20) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(6), 17, 15) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(7), 17, 10) from playoff_context context;
select pg_temp.add_resolved_bet(context.league_id, pg_temp.test_user(8), 17, 5) from playoff_context context;

select public.resolve_league_week(league_id, 17)
from playoff_context;

select pg_temp.record_result(
  '21.4 Championship matchup winner is recorded on Week 17',
  winner_id = pg_temp.test_user(3),
  'winner=' || coalesce(winner_id::text, 'null')
)
from public.weekly_matchups matchup
join playoff_context context on context.league_id = matchup.league_id
where matchup.week_number = 17
  and matchup.is_championship = true;

select pg_temp.record_result(
  '21.4 League status changes to complete after championship settlement',
  league.status = 'complete',
  'status=' || league.status::text || ', current_week=' || league.current_week::text
)
from public.leagues league
join playoff_context context on context.league_id = league.id;

select pg_temp.record_result(
  '21.4 Season snapshot preserves final standings for all league members',
  snapshot.id is not null
    and jsonb_array_length(snapshot.final_standings) = 8,
  'snapshot=' || coalesce(snapshot.id::text, 'null')
    || ', final_standings_count=' || coalesce(jsonb_array_length(snapshot.final_standings)::text, 'null')
)
from playoff_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2096;

select pg_temp.record_result(
  '21.4 Season champion is the championship matchup winner',
  snapshot.champion_user_id = championship.winner_id
    and championship.winner_id = pg_temp.test_user(3),
  'snapshot_champion=' || coalesce(snapshot.champion_user_id::text, 'null')
    || ', championship_winner=' || coalesce(championship.winner_id::text, 'null')
)
from playoff_context context
join public.weekly_matchups championship
  on championship.league_id = context.league_id
  and championship.week_number = 17
  and championship.is_championship = true
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2096;

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
) as playoff_championship_test_summary
from playoff_test_results;

rollback;
