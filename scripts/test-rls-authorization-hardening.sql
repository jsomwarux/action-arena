begin;

create temporary table rls_authorization_test_results (
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
  insert into rls_authorization_test_results (name, passed, detail)
  values (p_name, p_passed, coalesce(p_detail, ''))
  on conflict (name) do update
  set passed = excluded.passed,
      detail = excluded.detail;
end;
$$;

create temporary table rls_authorization_context on commit drop as
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
  gen_random_uuid() as shared_league_id,
  gen_random_uuid() as outsider_league_id,
  ids[1] as user_a_id,
  ids[2] as user_b_id,
  gen_random_uuid() as user_a_bet_id,
  gen_random_uuid() as user_b_bet_id,
  gen_random_uuid() as outsider_bet_id
from user_ids;

grant all on rls_authorization_test_results to authenticated;
grant select on rls_authorization_context to authenticated;

do $$
begin
  if exists (
    select 1
    from rls_authorization_context
    where user_a_id is null
       or user_b_id is null
  ) then
    raise exception 'RLS authorization tests require at least two public.users rows';
  end if;
end;
$$;

update public.users users
set chat_terms_accepted_at = coalesce(users.chat_terms_accepted_at, now())
from rls_authorization_context context
where users.id in (context.user_a_id, context.user_b_id);

insert into public.cosmetic_catalog (item_id, category, name, coin_cost, is_season_pass_exclusive)
values ('rls_auth_test_logo', 'team_logo', 'RLS Auth Test Logo', 0, false)
on conflict (item_id) do nothing;

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
  shared_league_id,
  'RLS Shared Private Test',
  user_a_id,
  'h2h'::public.league_type,
  'private'::public.league_visibility,
  'RS' || upper(left(replace(shared_league_id::text, '-', ''), 4)),
  4,
  'nfl'::public.league_sport,
  2026,
  1,
  'active'::public.league_status
from rls_authorization_context
union all
select
  outsider_league_id,
  'RLS Outsider Private Test',
  user_a_id,
  'h2h'::public.league_type,
  'private'::public.league_visibility,
  'RO' || upper(left(replace(outsider_league_id::text, '-', ''), 4)),
  4,
  'nfl'::public.league_sport,
  2026,
  1,
  'active'::public.league_status
from rls_authorization_context;

insert into public.league_members (league_id, user_id, team_name)
select shared_league_id, user_a_id, 'RLS User A'
from rls_authorization_context
union all
select shared_league_id, user_b_id, 'RLS User B'
from rls_authorization_context
union all
select outsider_league_id, user_a_id, 'RLS Outsider A'
from rls_authorization_context;

insert into public.standings (league_id, user_id, week_number, rank, wins, losses, ties, weekly_profit, total_profit)
select shared_league_id, user_a_id, 1, 1, 1, 0, 0, 25, 25
from rls_authorization_context
union all
select shared_league_id, user_b_id, 1, 2, 0, 1, 0, -10, -10
from rls_authorization_context
union all
select outsider_league_id, user_a_id, 1, 1, 1, 0, 0, 40, 40
from rls_authorization_context;

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
  is_lock
)
select user_a_bet_id, user_a_id, shared_league_id, 1, 'straight'::public.bet_type, 20, 120, 44, 'pending'::public.bet_result, null::numeric, true
from rls_authorization_context
union all
select user_b_bet_id, user_b_id, shared_league_id, 1, 'straight'::public.bet_type, 20, -110, 38.18, 'loss'::public.bet_result, -20, false
from rls_authorization_context
union all
select outsider_bet_id, user_a_id, outsider_league_id, 1, 'straight'::public.bet_type, 20, 100, 40, 'win'::public.bet_result, 20, true
from rls_authorization_context;

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
select user_a_bet_id, 'RLS-A-FUTURE', 'moneyline'::public.bet_market, 'RLS Future', null::numeric, null::numeric, 120, 'pending'::public.bet_result, now() + interval '3 days', false
from rls_authorization_context
union all
select user_b_bet_id, 'RLS-B-LOCKED', 'spread'::public.bet_market, 'RLS Locked -1.5', -1.5, -1.5, -110, 'loss'::public.bet_result, now() - interval '3 days', true
from rls_authorization_context
union all
select outsider_bet_id, 'RLS-OUTSIDER', 'moneyline'::public.bet_market, 'RLS Outsider', null::numeric, null::numeric, 100, 'win'::public.bet_result, now() - interval '3 days', true
from rls_authorization_context;

insert into public.league_chat_messages (league_id, user_id, message_type, body)
select outsider_league_id, user_a_id, 'user'::public.chat_message_type, 'Outsider chat should not be readable'
from rls_authorization_context;

set local role authenticated;

select set_config('request.jwt.claim.sub', user_b_id::text, true)
from rls_authorization_context;

insert into rls_authorization_test_results (name, passed, detail)
select
  'user B cannot read user A current-week pick before lock',
  count(*) = 0,
  'visible rows=' || count(*)::text
from public.bets b
cross join rls_authorization_context c
where b.id = c.user_a_bet_id;

reset role;

update public.bet_legs leg
set game_start_time = now() - interval '1 minute',
    locked = true
from rls_authorization_context c
where leg.bet_id = c.user_a_bet_id;

set local role authenticated;

select set_config('request.jwt.claim.sub', user_b_id::text, true)
from rls_authorization_context;

insert into rls_authorization_test_results (name, passed, detail)
select
  'user B can read user A pick after lock',
  count(*) = 1,
  'visible rows=' || count(*)::text
from public.bets b
cross join rls_authorization_context c
where b.id = c.user_a_bet_id;

do $$
declare
  affected integer := 0;
begin
  begin
    update public.standings s
    set total_profit = 999999
    from rls_authorization_context c
    where s.league_id = c.shared_league_id
      and s.user_id = c.user_b_id;
    get diagnostics affected = row_count;
    perform pg_temp.record_result(
      'user B cannot write standings to fabricate results',
      affected = 0,
      'affected rows=' || affected::text
    );
  exception
    when others then
      perform pg_temp.record_result(
        'user B cannot write standings to fabricate results',
        true,
        sqlerrm
      );
  end;
end;
$$;

do $$
declare
  affected integer := 0;
begin
  begin
    update public.users u
    set arena_coins = 999999
    from rls_authorization_context c
    where u.id = c.user_b_id;
    get diagnostics affected = row_count;
    perform pg_temp.record_result(
      'user B cannot write coin balance',
      affected = 0,
      'affected rows=' || affected::text
    );
  exception
    when others then
      perform pg_temp.record_result('user B cannot write coin balance', true, sqlerrm);
  end;
end;
$$;

do $$
declare
  affected integer := 0;
begin
  begin
    update public.bets b
    set result = 'win'::public.bet_result,
        profit = 999999
    from rls_authorization_context c
    where b.id = c.user_b_bet_id;
    get diagnostics affected = row_count;
    perform pg_temp.record_result(
      'user B cannot write settled bet outcome',
      affected = 0,
      'affected rows=' || affected::text
    );
  exception
    when others then
      perform pg_temp.record_result('user B cannot write settled bet outcome', true, sqlerrm);
  end;
end;
$$;

do $$
begin
  begin
    insert into public.season_passes (user_id, season_year, redeemed_code, source)
    select user_b_id, 2026, 'RLS-FAKE-PASS', 'rls_test'
    from rls_authorization_context;
    perform pg_temp.record_result('user B cannot fabricate season pass', false, 'insert succeeded');
  exception
    when others then
      perform pg_temp.record_result('user B cannot fabricate season pass', true, sqlerrm);
  end;
end;
$$;

do $$
begin
  begin
    insert into public.user_cosmetics (user_id, item_id, category)
    select user_b_id, 'rls_auth_test_logo', 'team_logo'
    from rls_authorization_context;
    perform pg_temp.record_result('user B cannot fabricate cosmetic ownership', false, 'insert succeeded');
  exception
    when others then
      perform pg_temp.record_result('user B cannot fabricate cosmetic ownership', true, sqlerrm);
  end;
end;
$$;

select pg_temp.record_result(
  'user B cannot call internal season pass cosmetic grant',
  not has_function_privilege(
    'authenticated',
    'public.grant_season_pass_cosmetics(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated execute privilege=' ||
    has_function_privilege(
      'authenticated',
      'public.grant_season_pass_cosmetics(uuid,integer)',
      'EXECUTE'
    )::text
);

insert into rls_authorization_test_results (name, passed, detail)
select
  'user B cannot read picks from a league they are not in',
  count(*) = 0,
  'visible rows=' || count(*)::text
from public.bets b
cross join rls_authorization_context c
where b.league_id = c.outsider_league_id;

insert into rls_authorization_test_results (name, passed, detail)
select
  'user B cannot read chat from a league they are not in',
  count(*) = 0,
  'visible rows=' || count(*)::text
from public.league_chat_messages m
cross join rls_authorization_context c
where m.league_id = c.outsider_league_id;

insert into rls_authorization_test_results (name, passed, detail)
select
  'user B cannot read standings from a league they are not in',
  count(*) = 0,
  'visible rows=' || count(*)::text
from public.standings s
cross join rls_authorization_context c
where s.league_id = c.outsider_league_id;

do $$
begin
  begin
    insert into public.bets (
      user_id,
      league_id,
      week_number,
      bet_type,
      amount,
      odds,
      potential_payout,
      result
    )
    select user_a_id, shared_league_id, 1, 'straight'::public.bet_type, 10, 100, 20, 'pending'::public.bet_result
    from rls_authorization_context;
    perform pg_temp.record_result('user B cannot insert a pick as user A', false, 'insert succeeded');
  exception
    when others then
      perform pg_temp.record_result('user B cannot insert a pick as user A', true, sqlerrm);
  end;
end;
$$;

do $$
begin
  begin
    insert into public.bets (
      user_id,
      league_id,
      week_number,
      bet_type,
      amount,
      odds,
      potential_payout,
      result
    )
    select user_b_id, outsider_league_id, 1, 'straight'::public.bet_type, 10, 100, 20, 'pending'::public.bet_result
    from rls_authorization_context;
    perform pg_temp.record_result('user B cannot insert a pick into a league they are not in', false, 'insert succeeded');
  exception
    when others then
      perform pg_temp.record_result(
        'user B cannot insert a pick into a league they are not in',
        true,
        sqlerrm
      );
  end;
end;
$$;

do $$
begin
  begin
    insert into public.league_chat_messages (league_id, user_id, message_type, body)
    select shared_league_id, user_a_id, 'user'::public.chat_message_type, 'Forged user A chat'
    from rls_authorization_context;
    perform pg_temp.record_result('user B cannot insert chat as user A', false, 'insert succeeded');
  exception
    when others then
      perform pg_temp.record_result('user B cannot insert chat as user A', true, sqlerrm);
  end;
end;
$$;

do $$
begin
  begin
    insert into public.league_chat_messages (league_id, user_id, message_type, body)
    select outsider_league_id, user_b_id, 'user'::public.chat_message_type, 'Outsider chat'
    from rls_authorization_context;
    perform pg_temp.record_result(
      'user B cannot insert chat into a league they are not in',
      false,
      'insert succeeded'
    );
  exception
    when others then
      perform pg_temp.record_result(
        'user B cannot insert chat into a league they are not in',
        true,
        sqlerrm
      );
  end;
end;
$$;

do $$
begin
  begin
    insert into public.league_members (league_id, user_id, team_name)
    select outsider_league_id, user_b_id, 'Forged Private Join'
    from rls_authorization_context;
    perform pg_temp.record_result('user B cannot directly join private league by id', false, 'insert succeeded');
  exception
    when others then
      perform pg_temp.record_result('user B cannot directly join private league by id', true, sqlerrm);
  end;
end;
$$;

do $$
declare
  target_league_id uuid;
begin
  select outsider_league_id
  into target_league_id
  from rls_authorization_context;

  begin
    perform public.join_league(target_league_id);
    perform pg_temp.record_result('user B cannot use public join RPC for private league', false, 'join succeeded');
  exception
    when others then
      perform pg_temp.record_result('user B cannot use public join RPC for private league', true, sqlerrm);
  end;
end;
$$;

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
) as rls_authorization_test_summary
from rls_authorization_test_results;

do $$
begin
  if exists (select 1 from rls_authorization_test_results where not passed) then
    raise exception 'RLS authorization hardening tests failed';
  end if;
end;
$$;

rollback;
