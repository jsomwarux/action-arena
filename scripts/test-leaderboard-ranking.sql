begin;

create temporary table leaderboard_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table leaderboard_test_users on commit drop as
select id, row_number() over (order by created_at, id) as ordinal
from public.users
order by created_at, id
limit 3;

do $$
begin
  if (select count(*) from leaderboard_test_users) < 3 then
    raise exception 'Leaderboard tests require at least 3 public.users rows';
  end if;
end;
$$;

create or replace function pg_temp.test_user(p_ordinal integer)
returns uuid
language sql
stable
as $$
  select id from leaderboard_test_users where ordinal = p_ordinal
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
  insert into leaderboard_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create or replace function pg_temp.add_resolved_bet(
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
    '00000000-0000-0000-0000-000000017001'::uuid,
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

select public.set_global_sport_week('nfl'::public.league_sport, 2097, 1, 'leaderboard regression test bootstrap');

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
values (
  '00000000-0000-0000-0000-000000017001'::uuid,
  'Step 17 Leaderboard Regression',
  pg_temp.test_user(1),
  'cumulative',
  'private',
  'S17001',
  4,
  'nfl',
  2097,
  1,
  'active'
);

insert into public.league_members (league_id, user_id, team_name)
select '00000000-0000-0000-0000-000000017001'::uuid, user_id, team_name
from (
  values
    (pg_temp.test_user(1), 'Leaderboard Player 1'),
    (pg_temp.test_user(2), 'Leaderboard Player 2'),
    (pg_temp.test_user(3), 'Leaderboard Player 3')
) as members(user_id, team_name);

-- Week 1: Player 2 submits no picks and must receive the -100 weekly penalty.
select pg_temp.add_resolved_bet(pg_temp.test_user(1), 1, 50);
select pg_temp.add_resolved_bet(pg_temp.test_user(3), 1, 10);
select public.resolve_league_week('00000000-0000-0000-0000-000000017001'::uuid, 1);

-- Week 2: Player 2 rockets to first, Player 1 moves down, Player 3 misses the week.
select pg_temp.add_resolved_bet(pg_temp.test_user(1), 2, -10, 'loss'::public.bet_result);
select pg_temp.add_resolved_bet(pg_temp.test_user(2), 2, 200);
select public.resolve_league_week('00000000-0000-0000-0000-000000017001'::uuid, 2);

select pg_temp.record_result(
  '17.1 season leaderboard ranks by total profit',
  count(*) = 3
    and bool_and(
      (user_id = pg_temp.test_user(2) and total_profit = 100 and rank = 1)
      or (user_id = pg_temp.test_user(1) and total_profit = 40 and rank = 2)
      or (user_id = pg_temp.test_user(3) and total_profit = -90 and rank = 3)
    ),
  coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'rank', rank, 'weekly', weekly_profit, 'total', total_profit) order by rank)::text, '[]')
)
from public.standings
where league_id = '00000000-0000-0000-0000-000000017001'::uuid
  and week_number = 2;

select pg_temp.record_result(
  '17.2 weekly leaderboard uses only current week profit',
  count(*) = 3
    and bool_and(
      (user_id = pg_temp.test_user(2) and weekly_profit = 200)
      or (user_id = pg_temp.test_user(1) and weekly_profit = -10)
      or (user_id = pg_temp.test_user(3) and weekly_profit = -100)
    ),
  coalesce(jsonb_agg(jsonb_build_object('user', user_id, 'weekly', weekly_profit) order by weekly_profit desc)::text, '[]')
)
from public.standings
where league_id = '00000000-0000-0000-0000-000000017001'::uuid
  and week_number = 2;

select pg_temp.record_result(
  '17.3 trend direction follows rank movement since previous week',
  count(*) = 3
    and bool_and(
      (current_week.user_id = pg_temp.test_user(2) and previous_week.rank = 3 and current_week.rank = 1)
      or (current_week.user_id = pg_temp.test_user(1) and previous_week.rank = 1 and current_week.rank = 2)
      or (current_week.user_id = pg_temp.test_user(3) and previous_week.rank = 2 and current_week.rank = 3)
    ),
  coalesce(jsonb_agg(jsonb_build_object('user', current_week.user_id, 'previous', previous_week.rank, 'current', current_week.rank) order by current_week.rank)::text, '[]')
)
from public.standings current_week
join public.standings previous_week
  on previous_week.league_id = current_week.league_id
  and previous_week.user_id = current_week.user_id
  and previous_week.week_number = 1
where current_week.league_id = '00000000-0000-0000-0000-000000017001'::uuid
  and current_week.week_number = 2;

select pg_temp.record_result(
  '17.no-pick weekly penalty is -100',
  exists (
    select 1
    from public.standings
    where league_id = '00000000-0000-0000-0000-000000017001'::uuid
      and user_id = pg_temp.test_user(2)
      and week_number = 1
      and weekly_profit = -100
      and total_profit = -100
  )
  and exists (
    select 1
    from public.standings
    where league_id = '00000000-0000-0000-0000-000000017001'::uuid
      and user_id = pg_temp.test_user(3)
      and week_number = 2
      and weekly_profit = -100
      and total_profit = -90
  ),
  'expected missed cards to count as -100 in weekly and season totals'
);

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
) as leaderboard_test_summary
from leaderboard_test_results;

rollback;
