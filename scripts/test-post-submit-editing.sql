begin;

create temporary table post_submit_edit_test_results (
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
  insert into post_submit_edit_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create temporary table post_submit_edit_context on commit drop as
select
  gen_random_uuid() as league_id,
  id as user_id
from public.users
order by created_at, id
limit 1;

do $$
begin
  if (select count(*) from post_submit_edit_context) <> 1 then
    raise exception 'Post-submit edit tests require at least one public.users row';
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
  'Post Submit Edit Test',
  user_id,
  'cumulative',
  'private',
  'PSEDIT',
  4,
  'nfl',
  2026,
  1,
  'active'
from post_submit_edit_context;

insert into public.league_members (league_id, user_id, team_name)
select league_id, user_id, 'Edit Tester'
from post_submit_edit_context;

select set_config('request.jwt.claim.sub', user_id::text, true)
from post_submit_edit_context;

do $$
declare
  target_league_id uuid;
  submitted_ids uuid[];
begin
  select league_id into target_league_id from post_submit_edit_context;

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
    'setup submitted editable lineup',
    coalesce(array_length(submitted_ids, 1), 0) = 5,
    format('submitted ids=%s', coalesce(array_length(submitted_ids, 1), 0))
  );
exception
  when others then
    perform pg_temp.record_result('setup submitted editable lineup', false, sqlerrm);
end;
$$;

do $$
declare
  target_league_id uuid;
  straight_bet_id uuid;
  straight_leg_id uuid;
begin
  select league_id into target_league_id from post_submit_edit_context;

  select b.id, bl.id
  into straight_bet_id, straight_leg_id
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  where b.league_id = target_league_id
    and b.bet_type = 'straight'
    and bl.game_id = 'DAL-PHI'
    and bl.market = 'moneyline'
  limit 1;

  begin
    perform public.update_submitted_bet(
      straight_bet_id,
      -140,
      34.29,
      null,
      jsonb_build_array(
        jsonb_build_object(
          'id', straight_leg_id,
          'game_id', 'DAL-PHI',
          'market', 'moneyline',
          'selection', 'Philadelphia Eagles',
          'original_line', null,
          'adjusted_line', null,
          'leg_odds', -140,
          'game_start_time', (now() + interval '7 days')::text
        )
      )
    );

    perform pg_temp.record_result(
      'straight edit swaps same-game moneyline side',
      exists (
        select 1
        from public.bets b
        join public.bet_legs bl on bl.bet_id = b.id
        where b.id = straight_bet_id
          and b.odds = -140
          and b.potential_payout = 34.29
          and bl.selection = 'Philadelphia Eagles'
          and bl.leg_odds = -140
      ),
      'straight bet was updated'
    );
  exception
    when others then
      perform pg_temp.record_result('straight edit swaps same-game moneyline side', false, sqlerrm);
  end;
end;
$$;

do $$
declare
  target_league_id uuid;
  teaser_bet_id uuid;
  teaser_leg_id uuid;
  edited_legs jsonb;
begin
  select league_id into target_league_id from post_submit_edit_context;

  select b.id, bl.id
  into teaser_bet_id, teaser_leg_id
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  where b.league_id = target_league_id
    and b.bet_type = 'teaser'
    and bl.game_id = 'MIA-NYJ'
  limit 1;

  select jsonb_agg(
    case
      when bl.id = teaser_leg_id then
        jsonb_build_object(
          'id', bl.id,
          'game_id', 'SEA-LAR',
          'market', 'spread',
          'selection', 'Seattle Seahawks +1.5',
          'original_line', 1.5,
          'adjusted_line', 8,
          'leg_odds', -110,
          'game_start_time', (now() + interval '7 days')::text
        )
      else
        jsonb_build_object(
          'id', bl.id,
          'game_id', bl.game_id,
          'market', bl.market,
          'selection', bl.selection,
          'original_line', bl.original_line,
          'adjusted_line', bl.adjusted_line,
          'leg_odds', bl.leg_odds,
          'game_start_time', bl.game_start_time::text
        )
    end
    order by bl.id
  )
  into edited_legs
  from public.bet_legs bl
  where bl.bet_id = teaser_bet_id;

  begin
    perform public.update_submitted_bet(teaser_bet_id, 200, 60, 6.5, edited_legs);

    perform pg_temp.record_result(
      'teaser edit swaps unlocked leg',
      exists (
        select 1
        from public.bet_legs
        where id = teaser_leg_id
          and game_id = 'SEA-LAR'
          and selection = 'Seattle Seahawks +1.5'
          and original_line = 1.5
          and adjusted_line = 8
      ),
      'teaser leg was updated'
    );
  exception
    when others then
      perform pg_temp.record_result('teaser edit swaps unlocked leg', false, sqlerrm);
  end;
end;
$$;

do $$
declare
  target_league_id uuid;
  parlay_bet_id uuid;
  edited_leg_id uuid;
  edited_legs jsonb;
begin
  select league_id into target_league_id from post_submit_edit_context;

  select b.id, bl.id
  into parlay_bet_id, edited_leg_id
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  where b.league_id = target_league_id
    and b.bet_type = 'parlay'
    and bl.game_id = 'CIN-CLE'
  limit 1;

  select jsonb_agg(
    case
      when bl.id = edited_leg_id then
        jsonb_build_object(
          'id', bl.id,
          'game_id', 'BAL-PIT',
          'market', 'moneyline',
          'selection', 'Pittsburgh Steelers',
          'original_line', null,
          'adjusted_line', null,
          'leg_odds', 130,
          'game_start_time', (now() + interval '7 days')::text
        )
      else
        jsonb_build_object(
          'id', bl.id,
          'game_id', bl.game_id,
          'market', bl.market,
          'selection', bl.selection,
          'original_line', bl.original_line,
          'adjusted_line', bl.adjusted_line,
          'leg_odds', bl.leg_odds,
          'game_start_time', bl.game_start_time::text
        )
    end
    order by bl.id
  )
  into edited_legs
  from public.bet_legs bl
  where bl.bet_id = parlay_bet_id;

  begin
    perform public.update_submitted_bet(parlay_bet_id, 310, 82, null, edited_legs);

    perform pg_temp.record_result(
      'edit blocks direct moneyline contradiction',
      false,
      'unexpectedly allowed Pittsburgh Steelers and Baltimore Ravens moneylines'
    );
  exception
    when others then
      perform pg_temp.record_result(
        'edit blocks direct moneyline contradiction',
        sqlerrm like '%Pittsburgh Steelers +130%'
          and sqlerrm like '%Baltimore Ravens -155%'
          and sqlerrm like '%both teams cannot win the same game%',
        sqlerrm
      );
  end;
end;
$$;

do $$
declare
  target_league_id uuid;
  teaser_bet_id uuid;
  edited_legs jsonb;
begin
  select league_id into target_league_id from post_submit_edit_context;

  select b.id
  into teaser_bet_id
  from public.bets b
  where b.league_id = target_league_id
    and b.bet_type = 'teaser'
  limit 1;

  update public.bet_legs
  set locked = true
  where bet_id = teaser_bet_id
    and game_id = 'SEA-LAR';

  select jsonb_agg(
    jsonb_build_object(
      'id', bl.id,
      'game_id', bl.game_id,
      'market', bl.market,
      'selection', bl.selection,
      'original_line', bl.original_line,
      'adjusted_line', bl.adjusted_line,
      'leg_odds', bl.leg_odds,
      'game_start_time', bl.game_start_time::text
    )
    order by bl.id
  )
  into edited_legs
  from public.bet_legs bl
  where bl.bet_id = teaser_bet_id;

  begin
    perform public.update_submitted_bet(teaser_bet_id, 200, 60, 6.5, edited_legs);

    perform pg_temp.record_result(
      'locked multi-pick cannot be edited',
      false,
      'unexpectedly allowed edit after a leg locked'
    );
  exception
    when others then
      perform pg_temp.record_result(
        'locked multi-pick cannot be edited',
        sqlerrm like '%locked because one of its games has started%',
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
) as post_submit_edit_test_summary
from post_submit_edit_test_results;

rollback;
