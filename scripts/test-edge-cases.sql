begin;

create temporary table edge_case_test_results (
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
  insert into edge_case_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create temporary table edge_case_context on commit drop as
with selected_users as (
  select id, row_number() over (order by created_at, id) as rn
  from public.users
  order by created_at, id
  limit 2
)
select
  gen_random_uuid() as duplicate_league_id,
  gen_random_uuid() as leave_league_id,
  coalesce(
    (
      select current_week
      from public.global_sport_weeks
      where sport = 'nfl'
        and season_year = 2026
      limit 1
    ),
    1
  ) as week_number,
  (select id from selected_users where rn = 1) as user_one_id,
  (select id from selected_users where rn = 2) as user_two_id
;

do $$
begin
  if exists (
    select 1
    from edge_case_context
    where user_one_id is null
       or user_two_id is null
  ) then
    raise exception 'Test 27 Edge Cases requires at least two public.users rows';
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
  league_id,
  league_name,
  user_one_id,
  league_type::public.league_type,
  'private',
  invite_code,
  4,
  'nfl',
  2026,
  week_number,
  'active'
from edge_case_context
cross join lateral (
  values
    (duplicate_league_id, 'Test 27 Duplicate Submit', 'T27A01', 'cumulative'),
    (leave_league_id, 'Test 27 Leave League', 'T27A02', 'h2h')
) as leagues(league_id, league_name, invite_code, league_type);

insert into public.league_members (league_id, user_id, team_name)
select duplicate_league_id, user_one_id, 'Edge Submitter'
from edge_case_context
union all
select leave_league_id, user_one_id, 'Remaining Player'
from edge_case_context
union all
select leave_league_id, user_two_id, 'Leaving Player With A Very Long Display Name For Regression'
from edge_case_context;

create or replace function pg_temp.edge_submission(p_prefix text)
returns jsonb
language sql
as $$
  select jsonb_build_array(
    jsonb_build_object(
      'bet_type', 'straight',
      'amount', 20,
      'odds', -110,
      'potential_payout', 38.18,
      'teaser_points', null,
      'is_lock', true,
      'legs', jsonb_build_array(
        jsonb_build_object(
          'game_id', p_prefix || '-GAME-1',
          'market', 'moneyline',
          'selection', p_prefix || ' Home 1',
          'original_line', null,
          'adjusted_line', null,
          'leg_odds', -110,
          'game_start_time', (now() + interval '7 days')::text
        )
      )
    ),
    jsonb_build_object(
      'bet_type', 'straight',
      'amount', 20,
      'odds', 120,
      'potential_payout', 44,
      'teaser_points', null,
      'is_lock', false,
      'legs', jsonb_build_array(
        jsonb_build_object(
          'game_id', p_prefix || '-GAME-2',
          'market', 'moneyline',
          'selection', p_prefix || ' Away 2',
          'original_line', null,
          'adjusted_line', null,
          'leg_odds', 120,
          'game_start_time', (now() + interval '7 days')::text
        )
      )
    ),
    jsonb_build_object(
      'bet_type', 'straight',
      'amount', 20,
      'odds', -105,
      'potential_payout', 39.05,
      'teaser_points', null,
      'is_lock', false,
      'legs', jsonb_build_array(
        jsonb_build_object(
          'game_id', p_prefix || '-GAME-3',
          'market', 'spread',
          'selection', p_prefix || ' Favorite -2.5',
          'original_line', -2.5,
          'adjusted_line', -2.5,
          'leg_odds', -105,
          'game_start_time', (now() + interval '7 days')::text
        )
      )
    ),
    jsonb_build_object(
      'bet_type', 'straight',
      'amount', 20,
      'odds', -115,
      'potential_payout', 37.39,
      'teaser_points', null,
      'is_lock', false,
      'legs', jsonb_build_array(
        jsonb_build_object(
          'game_id', p_prefix || '-GAME-4',
          'market', 'over_under',
          'selection', 'Over 44.5',
          'original_line', 44.5,
          'adjusted_line', 44.5,
          'leg_odds', -115,
          'game_start_time', (now() + interval '7 days')::text
        )
      )
    ),
    jsonb_build_object(
      'bet_type', 'straight',
      'amount', 20,
      'odds', 100,
      'potential_payout', 40,
      'teaser_points', null,
      'is_lock', false,
      'legs', jsonb_build_array(
        jsonb_build_object(
          'game_id', p_prefix || '-GAME-5',
          'market', 'over_under',
          'selection', 'Under 41.5',
          'original_line', 41.5,
          'adjusted_line', 41.5,
          'leg_odds', 100,
          'game_start_time', (now() + interval '7 days')::text
        )
      )
    )
  );
$$;

select set_config('request.jwt.claim.sub', user_one_id::text, true)
from edge_case_context;

do $$
declare
  submitted_ids uuid[];
  target_league_id uuid;
  target_week integer;
begin
  select duplicate_league_id, week_number
  into target_league_id, target_week
  from edge_case_context;

  begin
    select public.submit_bets(target_league_id, target_week, pg_temp.edge_submission('T27A'))
    into submitted_ids;

    perform pg_temp.record_result(
      '27.6 first weekly submission succeeds',
      coalesce(array_length(submitted_ids, 1), 0) = 5,
      format('submitted ids=%s', coalesce(array_length(submitted_ids, 1), 0))
    );
  exception
    when others then
      perform pg_temp.record_result('27.6 first weekly submission succeeds', false, sqlerrm);
  end;

  begin
    select public.submit_bets(target_league_id, target_week, pg_temp.edge_submission('T27B'))
    into submitted_ids;

    perform pg_temp.record_result(
      '27.6 second weekly submission is rejected',
      false,
      format('unexpectedly submitted ids=%s', coalesce(array_length(submitted_ids, 1), 0))
    );
  exception
    when others then
      perform pg_temp.record_result(
        '27.6 second weekly submission is rejected',
        sqlerrm like '%already been submitted for this week%',
        sqlerrm
      );
  end;
end;
$$;

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
  leave_league_id,
  week_number,
  user_one_id,
  user_two_id,
  24,
  -6,
  user_one_id,
  false,
  false
from edge_case_context;

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
select leave_league_id, user_one_id, week_number, 1, 0, 0, 24, 24, 1
from edge_case_context
union all
select leave_league_id, user_two_id, week_number, 0, 1, 0, -6, -6, 2
from edge_case_context;

select set_config('request.jwt.claim.sub', user_two_id::text, true)
from edge_case_context;

delete from public.league_members lm
using edge_case_context ctx
where lm.league_id = ctx.leave_league_id
  and lm.user_id = ctx.user_two_id;

select pg_temp.record_result(
  '27.4 leaving player membership is removed',
  not exists (
    select 1
    from public.league_members lm
    join edge_case_context ctx
      on ctx.leave_league_id = lm.league_id
     and ctx.user_two_id = lm.user_id
  ),
  'league_members should no longer contain the leaving user'
);

select pg_temp.record_result(
  '27.4 active standings exclude leaving player',
  not exists (
    select 1
    from public.standings s
    join edge_case_context ctx
      on ctx.leave_league_id = s.league_id
     and ctx.user_two_id = s.user_id
    join public.league_members lm
      on lm.league_id = s.league_id
     and lm.user_id = s.user_id
  ),
  'standings joined through active membership should omit the leaving user'
);

select pg_temp.record_result(
  '27.4 historical matchup remains viewable after leave',
  exists (
    select 1
    from public.weekly_matchups wm
    join edge_case_context ctx
      on ctx.leave_league_id = wm.league_id
     and ctx.user_two_id in (wm.home_user_id, wm.away_user_id)
  ),
  'weekly_matchups should preserve past pairings'
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
) as edge_case_test_summary
from edge_case_test_results;

do $$
begin
  if exists (select 1 from edge_case_test_results where not passed) then
    raise exception 'Test 27 Edge Cases regression failed';
  end if;
end;
$$;

rollback;
