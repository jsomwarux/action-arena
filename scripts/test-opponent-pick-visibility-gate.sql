begin;

create temporary table visibility_gate_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table visibility_gate_context on commit drop as
with selected_users as (
  select id, row_number() over (order by created_at, id) as rn
  from public.users
  order by created_at, id
  limit 2
),
user_ids as (
  select array_agg(id order by rn) as ids
  from selected_users
)
select
  gen_random_uuid() as league_id,
  gen_random_uuid() as current_matchup_id,
  gen_random_uuid() as prior_matchup_id,
  ids[1] as home_user_id,
  ids[2] as away_user_id,
  gen_random_uuid() as home_bet_id,
  gen_random_uuid() as away_bet_id,
  gen_random_uuid() as prior_away_bet_id
from user_ids;

grant all on visibility_gate_test_results to authenticated;
grant select on visibility_gate_context to authenticated;

do $$
begin
  if exists (
    select 1
    from visibility_gate_context
    where home_user_id is null
       or away_user_id is null
  ) then
    raise exception 'Visibility gate tests require at least two public.users rows';
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
  'Visibility Gate Test',
  home_user_id,
  'h2h',
  'private',
  'VG' || upper(left(replace(league_id::text, '-', ''), 4)),
  4,
  'nfl',
  2026,
  2,
  'active'
from visibility_gate_context;

insert into public.league_members (league_id, user_id, team_name)
select league_id, home_user_id, 'Visibility Home'
from visibility_gate_context
union all
select league_id, away_user_id, 'Visibility Away'
from visibility_gate_context;

insert into public.weekly_matchups (
  id,
  league_id,
  week_number,
  home_user_id,
  away_user_id
)
select current_matchup_id, league_id, 2, home_user_id, away_user_id
from visibility_gate_context
union all
select prior_matchup_id, league_id, 1, home_user_id, away_user_id
from visibility_gate_context;

insert into public.standings (league_id, user_id, week_number, rank, wins, losses, ties)
select league_id, home_user_id, 2, 1, 1, 0, 0
from visibility_gate_context
union all
select league_id, away_user_id, 2, 2, 0, 1, 0
from visibility_gate_context
union all
select league_id, home_user_id, 1, 1, 1, 0, 0
from visibility_gate_context
union all
select league_id, away_user_id, 1, 2, 0, 1, 0
from visibility_gate_context;

insert into public.league_week_slate_games (
  league_id,
  week_number,
  game_id,
  commence_time,
  away_team,
  home_team
)
select league_id, 2, 'VG-DAL-PHI', now() + interval '7 days', 'Dallas Cowboys', 'Philadelphia Eagles'
from visibility_gate_context;

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
select home_bet_id, home_user_id, league_id, 2, 'straight'::public.bet_type, 20, 120, 44, 'pending'::public.bet_result, true
from visibility_gate_context
union all
select away_bet_id, away_user_id, league_id, 2, 'straight'::public.bet_type, 20, -140, 34.29, 'pending'::public.bet_result, true
from visibility_gate_context
union all
select prior_away_bet_id, away_user_id, league_id, 1, 'straight'::public.bet_type, 20, -110, 38.18, 'pending'::public.bet_result, true
from visibility_gate_context;

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
select home_bet_id, 'VG-DAL-PHI', 'moneyline'::public.bet_market, 'Dallas Cowboys', null::numeric, null::numeric, 120, 'pending'::public.bet_result, now() + interval '7 days', false
from visibility_gate_context
union all
select away_bet_id, 'VG-DAL-PHI', 'moneyline'::public.bet_market, 'Philadelphia Eagles', null::numeric, null::numeric, -140, 'pending'::public.bet_result, now() + interval '7 days', false
from visibility_gate_context
union all
select prior_away_bet_id, 'VG-PRIOR', 'spread'::public.bet_market, 'Cleveland Browns +2.5', 2.5, 2.5, -110, 'pending'::public.bet_result, now() + interval '7 days', false
from visibility_gate_context;

insert into public.league_chat_messages (
  league_id,
  user_id,
  bet_id,
  message_type,
  body,
  metadata
)
select
  league_id,
  away_user_id,
  away_bet_id,
  'bet_share'::public.chat_message_type,
  'Shared a Pick of the Week: Philadelphia Eagles',
  jsonb_build_object(
    'amount', 20,
    'betType', 'straight',
    'isLock', true,
    'legs', jsonb_build_array(
      jsonb_build_object(
        'adjustedLine', null,
        'market', 'moneyline',
        'odds', -140,
        'originalLine', null,
        'result', 'pending',
        'selection', 'Philadelphia Eagles'
      )
    ),
    'odds', -140,
    'potentialReward', 34.29,
    'result', 'pending',
    'weekNumber', 2
  )
from visibility_gate_context;

set local role authenticated;

select set_config('request.jwt.claim.sub', home_user_id::text, true)
from visibility_gate_context;

insert into visibility_gate_test_results (name, passed, detail)
select
  'before reveal rpc redacts opponent pick details',
  (payload #> '{awayBets}') = '[]'::jsonb
    and payload #>> '{awayPickVisibility,isSubmitted}' = 'true'
    and payload #>> '{awayPickVisibility,isVisible}' = 'false'
    and payload::text not like '%Philadelphia Eagles%',
  payload::text
from (
  select public.get_matchup_detail(current_matchup_id) as payload
  from visibility_gate_context
) detail;

insert into visibility_gate_test_results (name, passed, detail)
select
  'before reveal direct opponent bets are hidden by rls',
  count(*) = 0,
  'visible opponent current-week bets=' || count(*)::text
from public.bets b
cross join visibility_gate_context c
where b.league_id = c.league_id
  and b.week_number = 2
  and b.user_id = c.away_user_id;

insert into visibility_gate_test_results (name, passed, detail)
select
  'own current-week card remains visible before reveal',
  (payload #>> '{homeBets,0,bet_legs,0,selection}') = 'Dallas Cowboys',
  payload::text
from (
  select public.get_matchup_detail(current_matchup_id) as payload
  from visibility_gate_context
) detail;

insert into visibility_gate_test_results (name, passed, detail)
select
  'voluntary chat share remains visible before reveal',
  count(*) = 1
    and coalesce(jsonb_agg(message.metadata)::text, '') like '%Philadelphia Eagles%',
  coalesce(jsonb_agg(message.metadata)::text, '')
from public.league_chat_messages message
cross join visibility_gate_context c
where message.league_id = c.league_id
  and message.message_type = 'bet_share';

insert into visibility_gate_test_results (name, passed, detail)
select
  'prior-week opponent bets remain visible before current reveal',
  count(*) = 1,
  'visible prior-week opponent bets=' || count(*)::text
from public.bets b
cross join visibility_gate_context c
where b.league_id = c.league_id
  and b.week_number = 1
  and b.user_id = c.away_user_id;

reset role;

update public.league_week_slate_games slate
set commence_time = now() - interval '1 minute'
from visibility_gate_context c
where slate.league_id = c.league_id
  and slate.week_number = 2;

set local role authenticated;

select set_config('request.jwt.claim.sub', home_user_id::text, true)
from visibility_gate_context;

insert into visibility_gate_test_results (name, passed, detail)
select
  'after reveal rpc returns opponent pick details',
  jsonb_array_length(payload #> '{awayBets}') = 1
    and payload #>> '{awayBets,0,bet_legs,0,selection}' = 'Philadelphia Eagles'
    and payload #>> '{awayPickVisibility,isVisible}' = 'true',
  payload::text
from (
  select public.get_matchup_detail(current_matchup_id) as payload
  from visibility_gate_context
) detail;

insert into visibility_gate_test_results (name, passed, detail)
select
  'after reveal direct opponent bets are visible by rls',
  count(*) = 1,
  'visible opponent current-week bets=' || count(*)::text
from public.bets b
cross join visibility_gate_context c
where b.league_id = c.league_id
  and b.week_number = 2
  and b.user_id = c.away_user_id;

reset role;

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
) as visibility_gate_test_summary
from visibility_gate_test_results;

rollback;
