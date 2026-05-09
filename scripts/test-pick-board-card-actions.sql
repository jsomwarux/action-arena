begin;

create temporary table pick_board_action_test_results (
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
  insert into pick_board_action_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create temporary table pick_board_action_context on commit drop as
select
  gen_random_uuid() as league_id,
  gen_random_uuid() as first_bet_id,
  gen_random_uuid() as second_bet_id,
  gen_random_uuid() as third_bet_id,
  id as user_id
from public.users
order by created_at, id
limit 1;

do $$
begin
  if (select count(*) from pick_board_action_context) <> 1 then
    raise exception 'Pick board card action tests require at least one public.users row';
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
  'Pick Board Action Test',
  user_id,
  'cumulative',
  'private',
  'PBACTN',
  4,
  'nfl',
  2026,
  1,
  'active'
from pick_board_action_context;

insert into public.league_members (league_id, user_id, team_name)
select league_id, user_id, 'POTW Tester'
from pick_board_action_context;

insert into public.league_week_slate_games (
  league_id,
  week_number,
  game_id,
  commence_time,
  away_team,
  home_team
)
select league_id, 1, 'DAL-PHI', now() + interval '7 days', 'Dallas Cowboys', 'Philadelphia Eagles'
from pick_board_action_context
union all
select league_id, 1, 'KC-LV', now() + interval '7 days', 'Kansas City Chiefs', 'Las Vegas Raiders'
from pick_board_action_context
union all
select league_id, 1, 'MIA-NYJ', now() + interval '8 days', 'Miami Dolphins', 'New York Jets'
from pick_board_action_context;

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
  is_lock
)
select first_bet_id, user_id, league_id, 1, 'straight'::public.bet_type, 20, 120, 44, 'pending'::public.bet_result, null::numeric, true
from pick_board_action_context
union all
select second_bet_id, user_id, league_id, 1, 'straight'::public.bet_type, 20, -110, 38.18, 'pending'::public.bet_result, null::numeric, false
from pick_board_action_context
union all
select third_bet_id, user_id, league_id, 1, 'straight'::public.bet_type, 20, -110, 38.18, 'pending'::public.bet_result, null::numeric, false
from pick_board_action_context;

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
select first_bet_id, 'DAL-PHI', 'moneyline'::public.bet_market, 'Dallas Cowboys', null, null, 120, 'pending'::public.bet_result, now() + interval '7 days', false
from pick_board_action_context
union all
select second_bet_id, 'KC-LV', 'over_under'::public.bet_market, 'Under 44.5', 44.5, 44.5, -110, 'pending'::public.bet_result, now() + interval '7 days', false
from pick_board_action_context
union all
select third_bet_id, 'MIA-NYJ', 'spread'::public.bet_market, 'Miami Dolphins -6.5', -6.5, -6.5, -110, 'pending'::public.bet_result, now() + interval '8 days', true
from pick_board_action_context;

select set_config('request.jwt.claim.sub', user_id::text, true)
from pick_board_action_context;

do $$
declare
  target_league_id uuid;
  target_first_bet_id uuid;
  target_second_bet_id uuid;
  target_third_bet_id uuid;
  new_lock_count integer;
begin
  select league_id, first_bet_id, second_bet_id, third_bet_id
  into target_league_id, target_first_bet_id, target_second_bet_id, target_third_bet_id
  from pick_board_action_context;

  perform public.set_pick_of_week(target_second_bet_id);

  select count(*)
  into new_lock_count
  from public.bets
  where league_id = target_league_id
    and week_number = 1
    and is_lock;

  perform pg_temp.record_result(
    'potw swap keeps exactly one selected pick',
    new_lock_count = 1
      and exists (select 1 from public.bets where id = target_second_bet_id and is_lock)
      and exists (select 1 from public.bets where id = target_first_bet_id and not is_lock),
    'lock_count=' || new_lock_count::text
  );

  begin
    perform public.set_pick_of_week(target_third_bet_id);

    perform pg_temp.record_result(
      'locked target cannot become potw',
      false,
      'unexpectedly allowed locked target'
    );
  exception
    when others then
      perform pg_temp.record_result(
        'locked target cannot become potw',
        sqlerrm like '%locked and cannot become Pick of the Week%',
        sqlerrm
      );
  end;

  update public.bet_legs
  set locked = false
  where bet_id = target_first_bet_id;

  update public.league_week_slate_games
  set commence_time = now() - interval '1 minute'
  where league_id = target_league_id
    and week_number = 1;

  begin
    perform public.set_pick_of_week(target_first_bet_id);

    perform pg_temp.record_result(
      'potw swap rejected after first kickoff',
      false,
      'unexpectedly allowed post-kickoff swap'
    );
  exception
    when others then
      perform pg_temp.record_result(
        'potw swap rejected after first kickoff',
        sqlerrm like '%after first kickoff%',
        sqlerrm
      );
  end;
end;
$$;

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
) as pick_board_card_action_test_summary
from pick_board_action_test_results;

rollback;
