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

select set_config('request.jwt.claim.sub', user_id::text, true)
from submit_conflict_context;

create or replace function pg_temp.create_conflict_league(p_name text)
returns uuid
language plpgsql
as $$
declare
  target_league_id uuid := gen_random_uuid();
  target_user_id uuid;
begin
  select user_id into target_user_id from submit_conflict_context;

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
    target_league_id,
    p_name,
    target_user_id,
    'cumulative',
    'private',
    upper(substr(replace(target_league_id::text, '-', ''), 1, 6)),
    4,
    'nfl',
    2026,
    1,
    'active'
  );

  insert into public.league_members (league_id, user_id, team_name)
  values (target_league_id, target_user_id, 'Conflict Tester');

  return target_league_id;
end;
$$;

create or replace function pg_temp.leg(
  p_game_id text,
  p_market text,
  p_selection text,
  p_original_line numeric default null,
  p_adjusted_line numeric default null,
  p_leg_odds integer default -110
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'game_id', p_game_id,
    'market', p_market,
    'selection', p_selection,
    'original_line', p_original_line,
    'adjusted_line', p_adjusted_line,
    'leg_odds', p_leg_odds,
    'game_start_time', (now() + interval '7 days')::text
  )
$$;

create or replace function pg_temp.bet(
  p_bet_type text,
  p_amount numeric,
  p_is_lock boolean,
  p_legs jsonb,
  p_odds integer default -110,
  p_potential_payout numeric default 38.18,
  p_teaser_points numeric default null
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'bet_type', p_bet_type,
    'amount', p_amount,
    'odds', p_odds,
    'potential_payout', p_potential_payout,
    'teaser_points', p_teaser_points,
    'is_lock', p_is_lock,
    'legs', p_legs
  )
$$;

create or replace function pg_temp.straight(
  p_game_id text,
  p_market text,
  p_selection text,
  p_original_line numeric default null,
  p_adjusted_line numeric default null,
  p_leg_odds integer default -110,
  p_is_lock boolean default false
)
returns jsonb
language sql
as $$
  select pg_temp.bet(
    'straight',
    20,
    p_is_lock,
    jsonb_build_array(
      pg_temp.leg(
        p_game_id,
        p_market,
        p_selection,
        p_original_line,
        p_adjusted_line,
        p_leg_odds
      )
    ),
    p_leg_odds,
    case when p_leg_odds > 0 then 20 * ((p_leg_odds::numeric / 100) + 1) else 20 * ((100 / abs(p_leg_odds::numeric)) + 1) end,
    null
  )
$$;

create or replace function pg_temp.filler_bet(
  p_index integer,
  p_is_lock boolean default false
)
returns jsonb
language sql
as $$
  select case p_index
    when 1 then pg_temp.straight('KC-LV', 'over_under', 'Under 38.5', 38.5, 38.5, -110, p_is_lock)
    when 2 then pg_temp.straight('BUF-NYJ', 'moneyline', 'Buffalo Bills', null, null, 105, p_is_lock)
    when 3 then pg_temp.straight('DET-GB', 'over_under', 'Over 44.5', 44.5, 44.5, -115, p_is_lock)
    when 4 then pg_temp.straight('MIA-NE', 'spread', 'Miami Dolphins -3.5', -3.5, -3.5, -110, p_is_lock)
    else pg_temp.straight('BAL-PIT', 'moneyline', 'Baltimore Ravens', null, null, -155, p_is_lock)
  end
$$;

create or replace function pg_temp.expect_submission(
  p_name text,
  p_bets jsonb,
  p_should_pass boolean,
  p_expected_fragments text[] default array[]::text[]
)
returns void
language plpgsql
as $$
declare
  target_league_id uuid;
  submitted_ids uuid[];
  expected_fragment text;
  matched boolean := true;
begin
  target_league_id := pg_temp.create_conflict_league(p_name);

  begin
    select public.submit_bets(target_league_id, 1, p_bets)
    into submitted_ids;

    if p_should_pass then
      perform pg_temp.record_result(
        p_name,
        coalesce(array_length(submitted_ids, 1), 0) = jsonb_array_length(p_bets),
        format('submitted ids=%s', coalesce(array_length(submitted_ids, 1), 0))
      );
    else
      perform pg_temp.record_result(
        p_name,
        false,
        format('unexpectedly submitted ids=%s', coalesce(array_length(submitted_ids, 1), 0))
      );
    end if;
  exception
    when others then
      if p_should_pass then
        perform pg_temp.record_result(p_name, false, sqlerrm);
      else
        foreach expected_fragment in array p_expected_fragments loop
          matched := matched and sqlerrm like ('%' || expected_fragment || '%');
        end loop;

        perform pg_temp.record_result(p_name, matched, sqlerrm);
      end if;
  end;
end;
$$;

do $$
begin
  perform pg_temp.expect_submission(
    'blocks Team A ML then Team A spread',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'moneyline', 'Dallas Cowboys', null, null, 120),
      pg_temp.straight('DAL-PHI', 'spread', 'Dallas Cowboys -1.5', -1.5, -1.5, -110),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    false,
    array['same-team moneyline and spread']
  );

  perform pg_temp.expect_submission(
    'blocks Team A spread then Team A ML',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'spread', 'Dallas Cowboys -1.5', -1.5, -1.5, -110),
      pg_temp.straight('DAL-PHI', 'moneyline', 'Dallas Cowboys', null, null, 120),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    false,
    array['same-team moneyline and spread']
  );

  perform pg_temp.expect_submission(
    'allows Team A ML plus game total over',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'moneyline', 'Dallas Cowboys', null, null, 120),
      pg_temp.straight('DAL-PHI', 'over_under', 'Over 44.5', 44.5, 44.5, -110),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    true
  );

  perform pg_temp.expect_submission(
    'allows Team A spread plus game total over',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'spread', 'Dallas Cowboys -1.5', -1.5, -1.5, -110),
      pg_temp.straight('DAL-PHI', 'over_under', 'Over 44.5', 44.5, 44.5, -110),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    true
  );

  perform pg_temp.expect_submission(
    'blocks Team A ML then Team B ML',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'moneyline', 'Dallas Cowboys', null, null, 120),
      pg_temp.straight('DAL-PHI', 'moneyline', 'Philadelphia Eagles', null, null, -140),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    false,
    array['both teams cannot win the same game']
  );

  perform pg_temp.expect_submission(
    'blocks favorite spread then opposing underdog spread',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'spread', 'Dallas Cowboys -1.5', -1.5, -1.5, -110),
      pg_temp.straight('DAL-PHI', 'spread', 'Philadelphia Eagles +1.5', 1.5, 1.5, -110),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    false,
    array['opposite sides of the same']
  );

  perform pg_temp.expect_submission(
    'blocks same-team ML and spread inside one parlay',
    jsonb_build_array(
      pg_temp.bet(
        'parlay',
        20,
        false,
        jsonb_build_array(
          pg_temp.leg('DAL-PHI', 'moneyline', 'Dallas Cowboys', null, null, 120),
          pg_temp.leg('DAL-PHI', 'spread', 'Dallas Cowboys -1.5', -1.5, -1.5, -110)
        ),
        264,
        72.73,
        null
      ),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3),
      pg_temp.filler_bet(4)
    ),
    false,
    array['same-team moneyline and spread']
  );

  perform pg_temp.expect_submission(
    'blocks same-team ML straight plus teaser spread leg',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'moneyline', 'Dallas Cowboys', null, null, 120),
      pg_temp.bet(
        'teaser',
        20,
        false,
        jsonb_build_array(
          pg_temp.leg('DAL-PHI', 'spread', 'Dallas Cowboys -1.5', -1.5, 5, -110),
          pg_temp.leg('BAL-PIT', 'spread', 'Baltimore Ravens -2.5', -2.5, 4, -110)
        ),
        -120,
        36.67,
        6.5
      ),
      pg_temp.filler_bet(1, true),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    false,
    array['same-team moneyline and spread']
  );

  perform pg_temp.expect_submission(
    'blocks POTW Team A ML plus Team A spread straight',
    jsonb_build_array(
      pg_temp.straight('DAL-PHI', 'moneyline', 'Dallas Cowboys', null, null, 120, true),
      pg_temp.straight('DAL-PHI', 'spread', 'Dallas Cowboys -1.5', -1.5, -1.5, -110),
      pg_temp.filler_bet(1),
      pg_temp.filler_bet(2),
      pg_temp.filler_bet(3)
    ),
    false,
    array['same-team moneyline and spread']
  );
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
