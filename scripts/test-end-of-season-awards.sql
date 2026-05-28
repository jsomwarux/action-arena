begin;

create temporary table season_awards_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table season_awards_context on commit drop as
select gen_random_uuid() as league_id;

create temporary table season_awards_users on commit drop as
select id, row_number() over (order by created_at, id) as seed
from public.users
order by created_at, id
limit 4;

do $$
begin
  if (select count(*) from season_awards_users) < 4 then
    raise exception 'End-of-season awards tests require at least 4 public.users rows';
  end if;
end;
$$;

create or replace function pg_temp.test_user(p_seed integer)
returns uuid
language sql
stable
as $$
  select id from season_awards_users where seed = p_seed
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
  insert into season_awards_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

select public.set_global_sport_week('nfl'::public.league_sport, 2097, 17, 'end-of-season awards test bootstrap');

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
  'End-of-Season Awards Regression Test',
  pg_temp.test_user(1),
  'h2h'::public.league_type,
  'private'::public.league_visibility,
  'ESA' || upper(left(replace(league_id::text, '-', ''), 3)),
  4,
  'nfl'::public.league_sport,
  2097,
  17,
  'playoffs'::public.league_status
from season_awards_context;

insert into public.league_members (league_id, user_id, team_name, joined_at)
select
  context.league_id,
  users.id,
  'Awards Seed ' || users.seed::text,
  now() + (users.seed::text || ' seconds')::interval
from season_awards_context context
join season_awards_users users on true;

insert into public.weekly_matchups (
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
select
  league_id,
  17,
  pg_temp.test_user(1),
  pg_temp.test_user(2),
  60,
  1,
  pg_temp.test_user(1),
  true,
  true
from season_awards_context;

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
select context.league_id, pg_temp.test_user(2), 17, 15, 2, 0, 1, 1200, 1 from season_awards_context context
union all
select context.league_id, pg_temp.test_user(1), 17, 14, 3, 0, 60, 900, 2 from season_awards_context context
union all
select context.league_id, pg_temp.test_user(3), 17, 9, 8, 0, 0, 700, 3 from season_awards_context context
union all
select context.league_id, pg_temp.test_user(4), 17, 8, 9, 0, 0, 600, 4 from season_awards_context context;

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
  is_lock,
  created_at
)
select
  bet.bet_id,
  pg_temp.test_user(bet.user_seed),
  context.league_id,
  bet.week_number,
  bet.bet_type,
  bet.amount,
  bet.odds,
  bet.potential_payout,
  'win'::public.bet_result,
  bet.profit,
  bet.is_lock,
  now() - (bet.created_minutes_ago::text || ' minutes')::interval
from season_awards_context context
join (
  values
    ('00000000-0000-0000-0000-000000022101'::uuid, 1, 1, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 20::numeric, false, 100),
    ('00000000-0000-0000-0000-000000022102'::uuid, 1, 2, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 20::numeric, false, 99),
    ('00000000-0000-0000-0000-000000022103'::uuid, 1, 3, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 20::numeric, false, 98),
    ('00000000-0000-0000-0000-000000022104'::uuid, 1, 4, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 20::numeric, false, 97),
    ('00000000-0000-0000-0000-000000022105'::uuid, 1, 5, 'parlay'::public.bet_type, 20::numeric, 175, 55::numeric, 35::numeric, false, 96),
    ('00000000-0000-0000-0000-000000022201'::uuid, 2, 1, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 20::numeric, false, 95),
    ('00000000-0000-0000-0000-000000022202'::uuid, 2, 6, 'parlay'::public.bet_type, 20::numeric, 250, 70::numeric, 50::numeric, false, 94),
    ('00000000-0000-0000-0000-000000022203'::uuid, 2, 7, 'parlay'::public.bet_type, 20::numeric, 300, 80::numeric, 60::numeric, false, 93),
    ('00000000-0000-0000-0000-000000022301'::uuid, 3, 8, 'straight'::public.bet_type, 35::numeric, 800, 315::numeric, 420::numeric, true, 92),
    ('00000000-0000-0000-0000-000000022401'::uuid, 4, 9, 'parlay'::public.bet_type, 20::numeric, 160, 52::numeric, 32::numeric, false, 91)
) as bet(
  bet_id,
  user_seed,
  week_number,
  bet_type,
  amount,
  odds,
  potential_payout,
  profit,
  is_lock,
  created_minutes_ago
) on true;

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
values
  (
    '00000000-0000-0000-0000-000000022301'::uuid,
    'awards_test_den_kc',
    'moneyline'::public.bet_market,
    'Denver Broncos',
    null,
    null,
    800,
    'win'::public.bet_result,
    now() - interval '30 days',
    true
  );

update public.leagues
set status = 'complete'
where id in (select league_id from season_awards_context);

select pg_temp.record_result(
  '22.1 Season MVP shows highest total profit',
  award.item ->> 'user_id' = pg_temp.test_user(2)::text
    and (award.item ->> 'metric')::numeric = 1200
    and award.item ->> 'value_label' = '+1,200 coins',
  coalesce(award.item::text, 'missing')
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097
left join lateral (
  select item
  from jsonb_array_elements(snapshot.awards) item
  where item ->> 'award_key' = 'season_mvp'
  limit 1
) award on true;

select pg_temp.record_result(
  '22.1 Best Record shows H2H W-L-T leader',
  award.item ->> 'user_id' = pg_temp.test_user(2)::text
    and (award.item ->> 'metric')::numeric = 15
    and award.item ->> 'value_label' = '15-2-0',
  coalesce(award.item::text, 'missing')
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097
left join lateral (
  select item
  from jsonb_array_elements(snapshot.awards) item
  where item ->> 'award_key' = 'best_record'
  limit 1
) award on true;

select pg_temp.record_result(
  '22.1 Parlay King shows most parlay wins',
  award.item ->> 'user_id' = pg_temp.test_user(2)::text
    and (award.item ->> 'metric')::numeric = 2
    and award.item ->> 'value_label' = '2 parlay wins',
  coalesce(award.item::text, 'missing')
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097
left join lateral (
  select item
  from jsonb_array_elements(snapshot.awards) item
  where item ->> 'award_key' = 'parlay_king'
  limit 1
) award on true;

select pg_temp.record_result(
  '22.1 Most Consistent shows most positive-profit weeks',
  award.item ->> 'user_id' = pg_temp.test_user(1)::text
    and (award.item ->> 'metric')::numeric = 5
    and award.item ->> 'value_label' = '5 positive weeks',
  coalesce(award.item::text, 'missing')
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097
left join lateral (
  select item
  from jsonb_array_elements(snapshot.awards) item
  where item ->> 'award_key' = 'most_consistent'
  limit 1
) award on true;

select pg_temp.record_result(
  '22.1 Biggest Single Pick includes profit and pick details',
  award.item ->> 'user_id' = pg_temp.test_user(3)::text
    and (award.item ->> 'metric')::numeric = 420
    and award.item ->> 'value_label' = '+420 coins'
    and award.item ->> 'bet_id' = '00000000-0000-0000-0000-000000022301'
    and award.item #>> '{bet,bet_type}' = 'straight'
    and (award.item #>> '{bet,amount}')::numeric = 35
    and jsonb_array_length(award.item #> '{bet,legs}') = 1
    and award.item #>> '{bet,legs,0,selection}' = 'Denver Broncos',
  coalesce(award.item::text, 'missing')
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097
left join lateral (
  select item
  from jsonb_array_elements(snapshot.awards) item
  where item ->> 'award_key' = 'biggest_single_bet'
  limit 1
) award on true;

select pg_temp.record_result(
  '22.2 Season snapshot exists for completed league',
  snapshot.id is not null
    and league.status = 'complete'
    and snapshot.league_id = context.league_id
    and snapshot.champion_user_id = pg_temp.test_user(1),
  'snapshot=' || coalesce(snapshot.id::text, 'null')
    || ', status=' || coalesce(league.status::text, 'null')
    || ', champion=' || coalesce(snapshot.champion_user_id::text, 'null')
)
from season_awards_context context
join public.leagues league on league.id = context.league_id
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097;

select pg_temp.record_result(
  '22.2 Final standings preserve every member',
  jsonb_array_length(snapshot.final_standings) = 4
    and snapshot.final_standings @> jsonb_build_array(
      jsonb_build_object(
        'user_id', pg_temp.test_user(2),
        'rank', 1,
        'wins', 15,
        'losses', 2,
        'ties', 0,
        'weekly_profit', 1,
        'total_profit', 1200
      )
    ),
  'final_standings_count=' || coalesce(jsonb_array_length(snapshot.final_standings)::text, 'null')
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097;

select pg_temp.record_result(
  '22.2 Championship summary captures matchup result',
  snapshot.championship_summary is not null
    and (snapshot.championship_summary ->> 'week_number')::integer = 17
    and (snapshot.championship_summary ->> 'champion_user_id') = pg_temp.test_user(1)::text
    and (snapshot.championship_summary ->> 'opponent_user_id') = pg_temp.test_user(2)::text
    and (snapshot.championship_summary ->> 'champion_profit')::numeric = 60
    and (snapshot.championship_summary ->> 'opponent_profit')::numeric = 1,
  coalesce(snapshot.championship_summary::text, 'missing')
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097;

select pg_temp.record_result(
  '22.2 Awards snapshot contains all expected award keys',
  jsonb_array_length(snapshot.awards) = 5
    and (
      select array_agg(item ->> 'award_key' order by item ->> 'award_key')
      from jsonb_array_elements(snapshot.awards) item
    ) = array[
      'best_record',
      'biggest_single_bet',
      'most_consistent',
      'parlay_king',
      'season_mvp'
    ],
  coalesce(
    (
      select jsonb_agg(item ->> 'award_key' order by item ->> 'award_key')::text
      from jsonb_array_elements(snapshot.awards) item
    ),
    'missing'
  )
)
from season_awards_context context
left join public.seasons snapshot
  on snapshot.league_id = context.league_id
  and snapshot.season_year = 2097;

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
) as end_of_season_awards_test_summary
from season_awards_test_results;

rollback;
