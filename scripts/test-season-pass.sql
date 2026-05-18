begin;

create temporary table season_pass_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table season_pass_test_users on commit drop as
select id, row_number() over (order by created_at, id) as ordinal
from public.users
order by created_at, id
limit 2;

do $$
begin
  if (select count(*) from season_pass_test_users) < 2 then
    raise exception 'Season Pass tests require at least 2 public.users rows';
  end if;
end;
$$;

create or replace function pg_temp.test_user(p_ordinal integer)
returns uuid
language sql
stable
as $$
  select id from season_pass_test_users where ordinal = p_ordinal
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
  insert into season_pass_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

select public.set_global_sport_week(
  'nfl'::public.league_sport,
  2099,
  1,
  'season pass regression test bootstrap'
);

delete from public.leagues
where id = '00000000-0000-0000-0000-000000024001'::uuid;

delete from public.season_passes
where season_year = 2099
  and user_id in (pg_temp.test_user(1), pg_temp.test_user(2));

delete from public.odds_release_windows
where sport = 'nfl'::public.league_sport
  and season_year = 2099
  and week_number = 1;

insert into public.season_pass_redeem_codes (
  code,
  season_year,
  max_redemptions,
  active
)
values ('QA-SEASON-PASS-2099', 2099, 1, true)
on conflict (code) do update
set active = excluded.active,
    max_redemptions = excluded.max_redemptions,
    redeemed_count = 0,
    season_year = excluded.season_year;

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
  '00000000-0000-0000-0000-000000024001'::uuid,
  'Step 24 Season Pass Regression',
  pg_temp.test_user(1),
  'cumulative',
  'private',
  'S24001',
  4,
  'nfl',
  2099,
  1,
  'active'
);

insert into public.league_members (league_id, user_id, team_name)
values
  ('00000000-0000-0000-0000-000000024001'::uuid, pg_temp.test_user(1), 'Season Pass Holder'),
  ('00000000-0000-0000-0000-000000024001'::uuid, pg_temp.test_user(2), 'Free Tester');

insert into public.odds_release_windows (
  sport,
  season_year,
  week_number,
  odds_available_at
)
values ('nfl'::public.league_sport, 2099, 1, now() - interval '5 minutes')
on conflict (sport, season_year, week_number) do update
set odds_available_at = excluded.odds_available_at;

select pg_temp.record_result(
  '24.6 free user is blocked during early Bet Board window',
  public.can_access_bet_board(
    '00000000-0000-0000-0000-000000024001'::uuid,
    1,
    pg_temp.test_user(2)
  ) = false,
  'free access should open 30 minutes after odds_available_at'
);

select set_config('request.jwt.claim.sub', pg_temp.test_user(1)::text, true);

create temporary table season_pass_redeem_ids on commit drop as
select public.redeem_season_pass(' qa-season-pass-2099 ', 2099) as pass_id;

insert into season_pass_redeem_ids
select public.redeem_season_pass('QA-SEASON-PASS-2099', 2099);

select pg_temp.record_result(
  '24.2 redeem creates one Season Pass row for the current user/year',
  count(*) = 1,
  count(*)::text || ' pass rows found'
)
from public.season_passes
where user_id = pg_temp.test_user(1)
  and season_year = 2099
  and redeemed_code = 'QA-SEASON-PASS-2099';

select pg_temp.record_result(
  '24.2 repeat redeem returns the existing pass without consuming another code',
  (select count(distinct pass_id) from season_pass_redeem_ids) = 1
    and redeemed_count = 1,
  'redeemed_count=' || redeemed_count::text
)
from public.season_pass_redeem_codes
where code = 'QA-SEASON-PASS-2099';

select pg_temp.record_result(
  '24.2 has_season_pass reports holder and free-user status',
  public.has_season_pass(pg_temp.test_user(1), 2099) = true
    and public.has_season_pass(pg_temp.test_user(2), 2099) = false,
  'holder=' || public.has_season_pass(pg_temp.test_user(1), 2099)::text
    || ', free=' || public.has_season_pass(pg_temp.test_user(2), 2099)::text
);

select pg_temp.record_result(
  '24.5 redeem grants every Season Pass exclusive cosmetic',
  owned.exclusive_count = catalog.exclusive_count,
  'owned=' || owned.exclusive_count::text || ', catalog=' || catalog.exclusive_count::text
)
from (
  select count(*) as exclusive_count
  from public.cosmetic_catalog
  where is_season_pass_exclusive
) catalog
cross join (
  select count(*) as exclusive_count
  from public.user_cosmetics
  where user_id = pg_temp.test_user(1)
    and item_id in (
      select item_id
      from public.cosmetic_catalog
      where is_season_pass_exclusive
    )
) owned;

select pg_temp.record_result(
  '24.6 Season Pass holder can access early Bet Board window',
  public.can_access_bet_board(
    '00000000-0000-0000-0000-000000024001'::uuid,
    1,
    pg_temp.test_user(1)
  ) = true,
  'pass holders bypass the 30-minute release delay'
);

select set_config('request.jwt.claim.sub', pg_temp.test_user(2)::text, true);

do $$
begin
  perform public.redeem_season_pass('QA-SEASON-PASS-2099', 2099);

  perform pg_temp.record_result(
    '24.2 exhausted redeem code is blocked for another user',
    false,
    'redeem unexpectedly succeeded'
  );
exception
  when others then
    perform pg_temp.record_result(
      '24.2 exhausted redeem code is blocked for another user',
      sqlerrm like '%Invalid or expired Season Pass code%',
      sqlerrm
    );
end;
$$;

do $$
begin
  perform public.purchase_cosmetic('s1_logo_founder');

  perform pg_temp.record_result(
    '24.5 free user cannot purchase Season Pass exclusive cosmetic',
    false,
    'purchase unexpectedly succeeded'
  );
exception
  when others then
    perform pg_temp.record_result(
      '24.5 free user cannot purchase Season Pass exclusive cosmetic',
      sqlerrm like '%exclusive to the Season Pass%',
      sqlerrm
    );
end;
$$;

do $$
begin
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
  values (
    '00000000-0000-0000-0000-000000024101'::uuid,
    pg_temp.test_user(2),
    '00000000-0000-0000-0000-000000024001'::uuid,
    1,
    'straight'::public.bet_type,
    10,
    -110,
    19.09,
    'pending'::public.bet_result,
    true
  );

  perform pg_temp.record_result(
    '24.6 free user bet insert is blocked during early access',
    false,
    'insert unexpectedly succeeded'
  );
exception
  when others then
    perform pg_temp.record_result(
      '24.6 free user bet insert is blocked during early access',
      sqlerrm like '%Season Pass holders get the first 30 minutes%',
      sqlerrm
    );
end;
$$;

update public.odds_release_windows
set odds_available_at = now() - interval '31 minutes'
where sport = 'nfl'::public.league_sport
  and season_year = 2099
  and week_number = 1;

select pg_temp.record_result(
  '24.6 free user gains Bet Board access after 30 minutes',
  public.can_access_bet_board(
    '00000000-0000-0000-0000-000000024001'::uuid,
    1,
    pg_temp.test_user(2)
  ) = true,
  'free access should open after the release delay'
);

select set_config('request.jwt.claim.sub', pg_temp.test_user(1)::text, true);
select public.equip_cosmetic('s1_logo_founder');

select pg_temp.record_result(
  '24.5 Season Pass holder can equip exclusive cosmetic',
  exists (
    select 1
    from public.user_cosmetics
    where user_id = pg_temp.test_user(1)
      and item_id = 's1_logo_founder'
      and is_equipped
  ),
  'exclusive founder logo should be equipped'
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
) as season_pass_test_summary
from season_pass_test_results;

do $$
begin
  if exists (select 1 from season_pass_test_results where not passed) then
    raise exception 'Season Pass regression failed';
  end if;
end;
$$;

rollback;
