begin;

create temporary table notification_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table notification_test_users on commit drop as
select id, row_number() over (order by created_at, id) as ordinal
from public.users
order by created_at, id
limit 3;

do $$
begin
  if (select count(*) from notification_test_users) < 3 then
    raise exception 'Notification tests require at least 3 public.users rows';
  end if;
end;
$$;

create or replace function pg_temp.test_user(p_ordinal integer)
returns uuid
language sql
stable
as $$
  select id from notification_test_users where ordinal = p_ordinal
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
  insert into notification_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create or replace function pg_temp.add_bet(
  p_user_id uuid,
  p_league_id uuid,
  p_week_number integer,
  p_bet_type public.bet_type,
  p_amount numeric,
  p_odds integer,
  p_payout numeric,
  p_is_lock boolean default false
)
returns uuid
language plpgsql
as $$
declare
  new_bet_id uuid;
begin
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
    p_league_id,
    p_week_number,
    p_bet_type,
    p_amount,
    p_odds,
    p_payout,
    'pending',
    null,
    p_is_lock
  )
  returning id into new_bet_id;

  return new_bet_id;
end;
$$;

create or replace function pg_temp.add_leg(
  p_bet_id uuid,
  p_game_id text,
  p_market public.bet_market,
  p_selection text,
  p_line numeric,
  p_odds integer
)
returns uuid
language plpgsql
as $$
declare
  new_leg_id uuid;
begin
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
  values (
    p_bet_id,
    p_game_id,
    p_market,
    p_selection,
    p_line,
    p_line,
    p_odds,
    'pending',
    now() - interval '1 hour',
    true
  )
  returning id into new_leg_id;

  return new_leg_id;
end;
$$;

insert into public.notification_preferences (user_id)
select id from notification_test_users
on conflict (user_id) do nothing;

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
  '00000000-0000-0000-0000-000000019001'::uuid,
  'Step 19 Notification Regression',
  pg_temp.test_user(1),
  'h2h',
  'private',
  'S19001',
  4,
  'nfl',
  2098,
  1,
  'active'
);

insert into public.league_members (league_id, user_id, team_name)
values
  ('00000000-0000-0000-0000-000000019001'::uuid, pg_temp.test_user(1), 'Notification Player 1'),
  ('00000000-0000-0000-0000-000000019001'::uuid, pg_temp.test_user(2), 'Notification Player 2'),
  ('00000000-0000-0000-0000-000000019001'::uuid, pg_temp.test_user(3), 'Notification Player 3');

insert into public.weekly_matchups (
  id,
  league_id,
  week_number,
  home_user_id,
  away_user_id,
  is_playoff,
  is_championship
)
values (
  '00000000-0000-0000-0000-000000019011'::uuid,
  '00000000-0000-0000-0000-000000019001'::uuid,
  1,
  pg_temp.test_user(1),
  pg_temp.test_user(2),
  false,
  false
);

do $$
declare
  straight_bet_id uuid;
  parlay_bet_id uuid;
  parlay_leg_1 uuid;
  parlay_leg_2 uuid;
  parlay_leg_3 uuid;
  submitted_bet_id uuid;
begin
  straight_bet_id := pg_temp.add_bet(
    pg_temp.test_user(1),
    '00000000-0000-0000-0000-000000019001'::uuid,
    1,
    'straight'::public.bet_type,
    15,
    -110,
    28.64
  );
  perform pg_temp.add_leg(straight_bet_id, 'notify_straight_win', 'spread'::public.bet_market, 'Kansas City Chiefs -2.5', -2.5, -110);

  update public.bets
  set result = 'win', profit = 13.64
  where id = straight_bet_id;

  perform pg_temp.record_result(
    '19.1 pick win queues App Store-safe result notification',
    exists (
      select 1
      from public.notification_events
      where bet_id = straight_bet_id
        and recipient_user_id = pg_temp.test_user(1)
        and notification_type = 'bet_results'
        and title = 'Pick won'
        and body like 'Your Kansas City Chiefs -2.5 pick hit.%coins'
        and body not like '%$%'
        and data ->> 'type' = 'bet'
        and data ->> 'betId' = straight_bet_id::text
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object('title', title, 'body', body, 'data', data))::text
      from public.notification_events
      where bet_id = straight_bet_id
    ), '[]')
  );

  parlay_bet_id := pg_temp.add_bet(
    pg_temp.test_user(1),
    '00000000-0000-0000-0000-000000019001'::uuid,
    1,
    'parlay'::public.bet_type,
    25,
    701,
    200
  );
  parlay_leg_1 := pg_temp.add_leg(parlay_bet_id, 'notify_parlay_1', 'moneyline'::public.bet_market, 'Jacksonville Jaguars', null, 120);
  parlay_leg_2 := pg_temp.add_leg(parlay_bet_id, 'notify_parlay_2', 'over_under'::public.bet_market, 'Over 43.5', 43.5, -110);
  parlay_leg_3 := pg_temp.add_leg(parlay_bet_id, 'notify_parlay_3', 'spread'::public.bet_market, 'Detroit Lions -4.5', -4.5, -105);

  update public.bet_legs set result = 'win' where id = parlay_leg_1;
  update public.bet_legs set result = 'win' where id = parlay_leg_2;
  update public.bet_legs set result = 'win' where id = parlay_leg_3;
  update public.bets set result = 'win', profit = 175 where id = parlay_bet_id;

  perform pg_temp.record_result(
    '19.2 parlay progress queues only actionable leg updates',
    (select count(*) from public.notification_events where bet_id = parlay_bet_id and notification_type = 'parlay_leg_updates') = 2
      and exists (
        select 1 from public.notification_events
        where bet_id = parlay_bet_id
          and notification_type = 'parlay_leg_updates'
          and body = '1 of 3 parlay legs hit, 2 games remaining'
      )
      and exists (
        select 1 from public.notification_events
        where bet_id = parlay_bet_id
          and notification_type = 'parlay_leg_updates'
          and body = '2 of 3 parlay legs hit, 1 game remaining'
      )
      and not exists (
        select 1 from public.notification_events
        where bet_id = parlay_bet_id
          and notification_type = 'parlay_leg_updates'
          and body like '%0 games remaining%'
      )
      and exists (
        select 1 from public.notification_events
        where bet_id = parlay_bet_id
          and notification_type = 'parlay_hits'
          and title = 'Parlay hit'
          and body = 'Your 3-leg parlay hit. +175 coins'
      ),
    coalesce((
      select jsonb_agg(jsonb_build_object('type', notification_type, 'title', title, 'body', body) order by created_at)::text
      from public.notification_events
      where bet_id = parlay_bet_id
    ), '[]')
  );

  update public.weekly_matchups
  set home_profit = 52, away_profit = -18, winner_id = pg_temp.test_user(1)
  where id = '00000000-0000-0000-0000-000000019011'::uuid;

  perform pg_temp.record_result(
    '19.3 matchup result queues both player notifications',
    (select count(*) from public.notification_events where matchup_id = '00000000-0000-0000-0000-000000019011'::uuid and notification_type = 'matchup_results') = 2
      and exists (
        select 1 from public.notification_events
        where matchup_id = '00000000-0000-0000-0000-000000019011'::uuid
          and recipient_user_id = pg_temp.test_user(1)
          and body like 'You beat % 52 coins to -18 coins'
      )
      and exists (
        select 1 from public.notification_events
        where matchup_id = '00000000-0000-0000-0000-000000019011'::uuid
          and recipient_user_id = pg_temp.test_user(2)
          and body like 'You lost to % -18 coins to 52 coins'
      ),
    coalesce((
      select jsonb_agg(jsonb_build_object('recipient', recipient_user_id, 'body', body) order by recipient_user_id)::text
      from public.notification_events
      where matchup_id = '00000000-0000-0000-0000-000000019011'::uuid
        and notification_type = 'matchup_results'
    ), '[]')
  );

  for i in 1..5 loop
    submitted_bet_id := pg_temp.add_bet(
      pg_temp.test_user(2),
      '00000000-0000-0000-0000-000000019001'::uuid,
      1,
      'straight'::public.bet_type,
      20,
      -110,
      38.18,
      i = 1
    );
    perform pg_temp.add_leg(submitted_bet_id, 'notify_submitted_' || i, 'moneyline'::public.bet_market, 'Home Team ' || i, null, -110);
  end loop;

  perform pg_temp.record_result(
    '19.5 opponent submitted picks notification queues once',
    (select count(*) from public.notification_events where matchup_id = '00000000-0000-0000-0000-000000019011'::uuid and notification_type = 'opponent_bets_locked') = 1
      and exists (
        select 1 from public.notification_events
        where matchup_id = '00000000-0000-0000-0000-000000019011'::uuid
          and notification_type = 'opponent_bets_locked'
          and recipient_user_id = pg_temp.test_user(1)
          and title = 'Opponent submitted picks'
          and body like '% submitted their Week 1 picks.'
      ),
    coalesce((
      select jsonb_agg(jsonb_build_object('title', title, 'body', body, 'recipient', recipient_user_id))::text
      from public.notification_events
      where matchup_id = '00000000-0000-0000-0000-000000019011'::uuid
        and notification_type = 'opponent_bets_locked'
    ), '[]')
  );
end;
$$;

update public.notification_preferences
set bet_results = false,
    parlay_leg_updates = false
where user_id = pg_temp.test_user(3);

select pg_temp.record_result(
  '19.6 notification preferences persist per notification type',
  exists (
    select 1
    from public.notification_preferences
    where user_id = pg_temp.test_user(3)
      and bet_results = false
      and parlay_leg_updates = false
      and bet_reminders = true
      and matchup_results = true
  ),
  coalesce((
    select row_to_json(notification_preferences)::text
    from public.notification_preferences
    where user_id = pg_temp.test_user(3)
  ), '{}')
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
) as notification_test_summary
from notification_test_results;

rollback;
