begin;

create temporary table submit_conflict_test_results (
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
  insert into submit_conflict_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create temporary table submit_conflict_context on commit drop as
select
  gen_random_uuid() as allowed_league_id,
  gen_random_uuid() as blocked_league_id,
  id as user_id
from public.users
order by created_at, id
limit 1;

do $$
begin
  if (select count(*) from submit_conflict_context) <> 1 then
    raise exception 'Submit conflict tests require at least one public.users row';
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
  user_id,
  'cumulative',
  'private',
  invite_code,
  4,
  'nfl',
  2026,
  1,
  'active'
from submit_conflict_context
cross join lateral (
  values
    (allowed_league_id, 'Submit Conflict Allowed Test', 'TCALW1'),
    (blocked_league_id, 'Submit Conflict Blocked Test', 'TCBLK1')
) as leagues(league_id, league_name, invite_code);

insert into public.league_members (league_id, user_id, team_name)
select allowed_league_id, user_id, 'Conflict Tester'
from submit_conflict_context
union all
select blocked_league_id, user_id, 'Conflict Tester'
from submit_conflict_context;

select set_config('request.jwt.claim.sub', user_id::text, true)
from submit_conflict_context;

do $$
declare
  target_league_id uuid;
  submitted_ids uuid[];
begin
  select allowed_league_id into target_league_id from submit_conflict_context;

  begin
    select public.submit_bets(
      target_league_id,
      1,
      jsonb_build_array(
        jsonb_build_object(
          'bet_type', 'straight',
          'amount', 20,
          'odds', 120,
          'potential_payout', 44,
          'teaser_points', null,
          'is_lock', false,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'DAL-PHI',
              'market', 'moneyline',
              'selection', 'Dallas Cowboys',
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
          'odds', -110,
          'potential_payout', 38.18,
          'teaser_points', null,
          'is_lock', false,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'KC-LV',
              'market', 'over_under',
              'selection', 'Under 38.5',
              'original_line', 38.5,
              'adjusted_line', 38.5,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        ),
        jsonb_build_object(
          'bet_type', 'straight',
          'amount', 20,
          'odds', -110,
          'potential_payout', 38.18,
          'teaser_points', null,
          'is_lock', false,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'KC-DEN',
              'market', 'spread',
              'selection', 'Kansas City Chiefs -10.5',
              'original_line', -10.5,
              'adjusted_line', -10.5,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        ),
        jsonb_build_object(
          'bet_type', 'parlay',
          'amount', 20,
          'odds', 264,
          'potential_payout', 72.73,
          'teaser_points', null,
          'is_lock', false,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'CIN-CLE',
              'market', 'moneyline',
              'selection', 'Cincinnati Bengals',
              'original_line', null,
              'adjusted_line', null,
              'leg_odds', -125,
              'game_start_time', (now() + interval '7 days')::text
            ),
            jsonb_build_object(
              'game_id', 'BAL-PIT',
              'market', 'moneyline',
              'selection', 'Baltimore Ravens',
              'original_line', null,
              'adjusted_line', null,
              'leg_odds', -155,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        ),
        jsonb_build_object(
          'bet_type', 'teaser',
          'amount', 20,
          'odds', 200,
          'potential_payout', 60,
          'teaser_points', 6.5,
          'is_lock', true,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'PIT-TEN',
              'market', 'spread',
              'selection', 'Pittsburgh Steelers +3',
              'original_line', 3,
              'adjusted_line', 9.5,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            ),
            jsonb_build_object(
              'game_id', 'TEN-HOU',
              'market', 'spread',
              'selection', 'Tennessee Titans +10.5',
              'original_line', 10.5,
              'adjusted_line', 17,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            ),
            jsonb_build_object(
              'game_id', 'MIA-NYJ',
              'market', 'spread',
              'selection', 'Miami Dolphins -6.5',
              'original_line', -6.5,
              'adjusted_line', 0,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            ),
            jsonb_build_object(
              'game_id', 'DAL-PHI',
              'market', 'spread',
              'selection', 'Dallas Cowboys +2.5',
              'original_line', 2.5,
              'adjusted_line', 9,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        )
      )
    )
    into submitted_ids;

    perform pg_temp.record_result(
      'allows Cowboys ML straight plus Cowboys teaser spread',
      coalesce(array_length(submitted_ids, 1), 0) = 5,
      format('submitted ids=%s', coalesce(array_length(submitted_ids, 1), 0))
    );
  exception
    when others then
      perform pg_temp.record_result(
        'allows Cowboys ML straight plus Cowboys teaser spread',
        false,
        sqlerrm
      );
  end;
end;
$$;

do $$
declare
  target_league_id uuid;
  submitted_ids uuid[];
begin
  select blocked_league_id into target_league_id from submit_conflict_context;

  begin
    select public.submit_bets(
      target_league_id,
      1,
      jsonb_build_array(
        jsonb_build_object(
          'bet_type', 'parlay',
          'amount', 20,
          'odds', 260,
          'potential_payout', 72,
          'teaser_points', null,
          'is_lock', false,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'DAL-PHI',
              'market', 'moneyline',
              'selection', 'Dallas Cowboys',
              'original_line', null,
              'adjusted_line', null,
              'leg_odds', 120,
              'game_start_time', (now() + interval '7 days')::text
            ),
            jsonb_build_object(
              'game_id', 'DAL-PHI',
              'market', 'moneyline',
              'selection', 'Philadelphia Eagles',
              'original_line', null,
              'adjusted_line', null,
              'leg_odds', -140,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        ),
        jsonb_build_object(
          'bet_type', 'straight',
          'amount', 20,
          'odds', -110,
          'potential_payout', 38.18,
          'teaser_points', null,
          'is_lock', true,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'KC-LV',
              'market', 'over_under',
              'selection', 'Under 38.5',
              'original_line', 38.5,
              'adjusted_line', 38.5,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        ),
        jsonb_build_object(
          'bet_type', 'straight',
          'amount', 20,
          'odds', -110,
          'potential_payout', 38.18,
          'teaser_points', null,
          'is_lock', false,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'KC-DEN',
              'market', 'spread',
              'selection', 'Kansas City Chiefs -10.5',
              'original_line', -10.5,
              'adjusted_line', -10.5,
              'leg_odds', -110,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        ),
        jsonb_build_object(
          'bet_type', 'straight',
          'amount', 20,
          'odds', 105,
          'potential_payout', 41,
          'teaser_points', null,
          'is_lock', false,
          'legs', jsonb_build_array(
            jsonb_build_object(
              'game_id', 'BUF-NYJ',
              'market', 'moneyline',
              'selection', 'Buffalo Bills',
              'original_line', null,
              'adjusted_line', null,
              'leg_odds', 105,
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
              'game_id', 'DET-GB',
              'market', 'over_under',
              'selection', 'Over 44.5',
              'original_line', 44.5,
              'adjusted_line', 44.5,
              'leg_odds', -115,
              'game_start_time', (now() + interval '7 days')::text
            )
          )
        )
      )
    )
    into submitted_ids;

    perform pg_temp.record_result(
      'blocks both teams moneylines with named conflict',
      false,
      format('unexpectedly submitted ids=%s', coalesce(array_length(submitted_ids, 1), 0))
    );
  exception
    when others then
      perform pg_temp.record_result(
        'blocks both teams moneylines with named conflict',
        sqlerrm like '%Dallas Cowboys +120%'
          and sqlerrm like '%Philadelphia Eagles -140%'
          and sqlerrm like '%both teams cannot win the same game%',
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
) as submit_conflict_test_summary
from submit_conflict_test_results;

rollback;
