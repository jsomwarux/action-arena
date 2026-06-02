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
limit 4;

do $$
begin
  if (select count(*) from notification_test_users) < 4 then
    raise exception 'Notification tests require at least 4 public.users rows';
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

create table if not exists public.pick_reminder_sent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_id integer not null check (week_id between 1 and 17),
  reminder_type text not null check (reminder_type in ('early', 'last_call')),
  first_game_starts_at timestamptz not null,
  notification_event_id uuid references public.notification_events(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, league_id, week_id, reminder_type)
);

create or replace function public.enqueue_weekly_pick_reminders(
  p_now timestamptz default now(),
  p_first_game_starts_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count integer := 0;
  early_count integer := 0;
  last_call_count integer := 0;
begin
  p_now := coalesce(p_now, now());

  with league_first_games as (
    select
      league.id as league_id,
      league.name as league_name,
      league.current_week as week_id,
      coalesce(
        p_first_game_starts_at,
        min(coalesce(game.commence_time, slate.commence_time))
      ) as first_game_starts_at
    from public.leagues league
    join public.league_week_slate_games slate
      on slate.league_id = league.id
     and slate.week_number = league.current_week
    left join public.games game
      on game.game_id = slate.game_id
    where league.sport = 'nfl'
      and league.status in ('drafting', 'active')
      and lower(coalesce(league.settings ->> 'global_week_exempt', 'false')) <> 'true'
    group by league.id, league.name, league.current_week
  ),
  open_league_thresholds as (
    select
      league_id,
      league_name,
      week_id,
      first_game_starts_at,
      'early'::text as reminder_type
    from league_first_games
    where first_game_starts_at is not null
      and p_now >= first_game_starts_at - interval '24 hours'
      and p_now < first_game_starts_at

    union all

    select
      league_id,
      league_name,
      week_id,
      first_game_starts_at,
      'last_call'::text as reminder_type
    from league_first_games
    where first_game_starts_at is not null
      and p_now >= first_game_starts_at - interval '2 hours'
      and p_now < first_game_starts_at
  ),
  eligible_members as (
    select
      threshold.league_id,
      threshold.league_name,
      threshold.week_id,
      threshold.first_game_starts_at,
      threshold.reminder_type,
      member.user_id
    from open_league_thresholds threshold
    join public.league_members member
      on member.league_id = threshold.league_id
    join public.users profile
      on profile.id = member.user_id
    left join public.notification_preferences preferences
      on preferences.user_id = member.user_id
    where coalesce(preferences.bet_reminders, true)
      and profile.push_token is not null
      and btrim(profile.push_token) <> ''
      and profile.push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
      and not exists (
        select 1
        from public.bets submitted_bet
        where submitted_bet.user_id = member.user_id
          and submitted_bet.league_id = threshold.league_id
          and submitted_bet.week_number = threshold.week_id
      )
      and not exists (
        select 1
        from public.bets locked_bet
        join public.bet_legs locked_leg
          on locked_leg.bet_id = locked_bet.id
        where locked_bet.user_id = member.user_id
          and locked_bet.league_id = threshold.league_id
          and locked_bet.week_number = threshold.week_id
          and (locked_leg.locked or locked_leg.game_start_time <= p_now)
      )
  ),
  inserted_logs as (
    insert into public.pick_reminder_sent_log (
      user_id,
      league_id,
      week_id,
      reminder_type,
      first_game_starts_at
    )
    select
      eligible.user_id,
      eligible.league_id,
      eligible.week_id,
      eligible.reminder_type,
      eligible.first_game_starts_at
    from eligible_members eligible
    on conflict (user_id, league_id, week_id, reminder_type) do nothing
    returning id, user_id, league_id, week_id, reminder_type, first_game_starts_at
  ),
  event_rows as materialized (
    select
      gen_random_uuid() as event_id,
      log.id as log_id,
      log.user_id,
      log.league_id,
      log.week_id,
      log.reminder_type,
      log.first_game_starts_at,
      league.name as league_name
    from inserted_logs log
    join public.leagues league
      on league.id = log.league_id
  ),
  inserted_events as (
    insert into public.notification_events (
      id,
      recipient_user_id,
      league_id,
      notification_type,
      title,
      body,
      data,
      idempotency_key
    )
    select
      event.event_id,
      event.user_id,
      event.league_id,
      'bet_reminders'::public.notification_type,
      case
        when event.reminder_type = 'last_call' then 'Last call for picks'
        else 'Picks still needed'
      end,
      case
        when event.reminder_type = 'last_call' then
          event.league_name || ': last call to submit your Week ' || event.week_id || ' picks before kickoff.'
        else
          event.league_name || ': submit your Week ' || event.week_id || ' picks before kickoff.'
      end,
      jsonb_build_object(
        'type', 'bet_board',
        'leagueId', event.league_id,
        'weekNumber', event.week_id,
        'reminderType', event.reminder_type,
        'firstGameStartsAt', event.first_game_starts_at
      ),
      'bet_reminder:' || event.reminder_type || ':' || event.league_id::text || ':' ||
        event.week_id || ':' || event.user_id::text
    from event_rows event
    on conflict (idempotency_key) do nothing
    returning id
  )
  select
    count(*)::integer,
    count(*) filter (where event.reminder_type = 'early')::integer,
    count(*) filter (where event.reminder_type = 'last_call')::integer
  into total_count, early_count, last_call_count
  from event_rows event
  join inserted_events inserted
    on inserted.id = event.event_id;

  update public.pick_reminder_sent_log log
  set notification_event_id = event.id
  from public.notification_events event
  where log.notification_event_id is null
    and event.idempotency_key = 'bet_reminder:' || log.reminder_type || ':' ||
      log.league_id::text || ':' || log.week_id || ':' || log.user_id::text;

  return jsonb_build_object(
    'enqueued', coalesce(total_count, 0),
    'early', coalesce(early_count, 0),
    'last_call', coalesce(last_call_count, 0)
  );
end;
$$;

insert into public.notification_preferences (user_id)
select id from notification_test_users
on conflict (user_id) do nothing;

insert into public.global_sport_weeks (
  sport,
  season_year,
  current_week,
  updated_by
)
values (
  'nfl',
  2098,
  1,
  'notification regression test'
)
on conflict (sport, season_year) do update
set current_week = excluded.current_week,
    updated_at = now(),
    updated_by = excluded.updated_by;

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
  '00000000-0000-0000-0000-000000019101'::uuid,
  'Step 19 Pick Reminder Regression',
  pg_temp.test_user(1),
  'cumulative',
  'private',
  'S19101',
  4,
  'nfl',
  2098,
  1,
  'active'
);

insert into public.league_members (league_id, user_id, team_name)
values
  ('00000000-0000-0000-0000-000000019101'::uuid, pg_temp.test_user(1), 'Reminder Eligible'),
  ('00000000-0000-0000-0000-000000019101'::uuid, pg_temp.test_user(2), 'Reminder Submitted'),
  ('00000000-0000-0000-0000-000000019101'::uuid, pg_temp.test_user(3), 'Reminder No Token'),
  ('00000000-0000-0000-0000-000000019101'::uuid, pg_temp.test_user(4), 'Reminder Opted Out');

insert into public.games (
  game_id,
  sport,
  season_year,
  week_number,
  commence_time,
  away_team,
  home_team
)
values (
  'notify_reminder_week1_game',
  'nfl',
  2098,
  1,
  '2026-09-08 16:00:00+00'::timestamptz,
  'Away Reminder',
  'Home Reminder'
)
on conflict (game_id) do update
set commence_time = excluded.commence_time,
    away_team = excluded.away_team,
    home_team = excluded.home_team;

insert into public.league_week_slate_games (
  league_id,
  week_number,
  game_id,
  commence_time,
  away_team,
  home_team
)
values (
  '00000000-0000-0000-0000-000000019101'::uuid,
  1,
  'notify_reminder_week1_game',
  '2026-09-08 16:00:00+00'::timestamptz,
  'Away Reminder',
  'Home Reminder'
)
on conflict (league_id, week_number, game_id) do update
set commence_time = excluded.commence_time,
    away_team = excluded.away_team,
    home_team = excluded.home_team;

update public.users
set push_token = case id
  when pg_temp.test_user(1) then 'ExponentPushToken[remindereligible]'
  when pg_temp.test_user(2) then 'ExpoPushToken[remindersubmitted]'
  when pg_temp.test_user(3) then null
  when pg_temp.test_user(4) then 'ExponentPushToken[reminderoptedout]'
  else push_token
end
where id in (
  pg_temp.test_user(1),
  pg_temp.test_user(2),
  pg_temp.test_user(3),
  pg_temp.test_user(4)
);

update public.notification_preferences
set bet_reminders = case
  when user_id = pg_temp.test_user(4) then false
  else true
end
where user_id in (
  pg_temp.test_user(1),
  pg_temp.test_user(2),
  pg_temp.test_user(3),
  pg_temp.test_user(4)
);

do $$
declare
  submitted_reminder_bet_id uuid;
  early_result jsonb;
  early_repeat_result jsonb;
  last_call_result jsonb;
  last_call_repeat_result jsonb;
  started_result jsonb;
begin
  submitted_reminder_bet_id := pg_temp.add_bet(
    pg_temp.test_user(2),
    '00000000-0000-0000-0000-000000019101'::uuid,
    1,
    'straight'::public.bet_type,
    20,
    -110,
    38.18
  );

  early_result := public.enqueue_weekly_pick_reminders('2026-09-07 17:00:00+00'::timestamptz);
  early_repeat_result := public.enqueue_weekly_pick_reminders('2026-09-07 17:30:00+00'::timestamptz);

  perform pg_temp.record_result(
    '19.4a early pick reminder queues once for eligible unsubmitted users only',
    (early_result ->> 'enqueued')::integer = 1
      and (early_result ->> 'early')::integer = 1
      and (early_repeat_result ->> 'enqueued')::integer = 0
      and (
        select count(*)
        from public.notification_events
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and notification_type = 'bet_reminders'
          and data ->> 'reminderType' = 'early'
      ) = 1
      and exists (
        select 1
        from public.notification_events
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and notification_type = 'bet_reminders'
          and recipient_user_id = pg_temp.test_user(1)
          and title = 'Picks still needed'
          and body = 'Step 19 Pick Reminder Regression: submit your Week 1 picks before kickoff.'
          and data ->> 'type' = 'bet_board'
          and data ->> 'weekNumber' = '1'
      )
      and not exists (
        select 1
        from public.notification_events
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and notification_type = 'bet_reminders'
          and recipient_user_id in (pg_temp.test_user(2), pg_temp.test_user(3), pg_temp.test_user(4))
      ),
    jsonb_build_object(
      'early', early_result,
      'repeat', early_repeat_result,
      'events', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'recipient', recipient_user_id,
          'title', title,
          'body', body,
          'data', data
        )), '[]'::jsonb)
        from public.notification_events
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and notification_type = 'bet_reminders'
      )
    )::text
  );

  last_call_result := public.enqueue_weekly_pick_reminders('2026-09-08 14:30:00+00'::timestamptz);
  last_call_repeat_result := public.enqueue_weekly_pick_reminders('2026-09-08 15:00:00+00'::timestamptz);
  started_result := public.enqueue_weekly_pick_reminders('2026-09-08 16:01:00+00'::timestamptz);

  perform pg_temp.record_result(
    '19.4b last-call reminder queues once and started weeks queue nothing',
    (last_call_result ->> 'enqueued')::integer = 1
      and (last_call_result ->> 'last_call')::integer = 1
      and (last_call_repeat_result ->> 'enqueued')::integer = 0
      and (started_result ->> 'enqueued')::integer = 0
      and (
        select count(*)
        from public.notification_events
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and notification_type = 'bet_reminders'
      ) = 2
      and exists (
        select 1
        from public.notification_events
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and notification_type = 'bet_reminders'
          and recipient_user_id = pg_temp.test_user(1)
          and title = 'Last call for picks'
          and data ->> 'reminderType' = 'last_call'
      )
      and (
        select count(*)
        from public.pick_reminder_sent_log
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and user_id = pg_temp.test_user(1)
      ) = 2,
    jsonb_build_object(
      'lastCall', last_call_result,
      'repeat', last_call_repeat_result,
      'started', started_result,
      'events', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'recipient', recipient_user_id,
          'title', title,
          'body', body,
          'data', data
        ) order by created_at), '[]'::jsonb)
        from public.notification_events
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
          and notification_type = 'bet_reminders'
      ),
      'logs', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'user', user_id,
          'type', reminder_type,
          'event', notification_event_id
        ) order by reminder_type), '[]'::jsonb)
        from public.pick_reminder_sent_log
        where league_id = '00000000-0000-0000-0000-000000019101'::uuid
      )
    )::text
  );
end;
$$;

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
