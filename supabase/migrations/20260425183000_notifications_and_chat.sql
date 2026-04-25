do $$
begin
  create type public.notification_type as enum (
    'odds_available',
    'bet_reminders',
    'bet_results',
    'parlay_leg_updates',
    'parlay_hits',
    'matchup_results',
    'weekly_awards',
    'opponent_bets_locked'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.chat_message_type as enum ('user', 'system', 'bet_share');
exception
  when duplicate_object then null;
end $$;

create table public.notification_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  odds_available boolean not null default true,
  bet_reminders boolean not null default true,
  bet_results boolean not null default true,
  parlay_leg_updates boolean not null default true,
  parlay_hits boolean not null default true,
  matchup_results boolean not null default true,
  weekly_awards boolean not null default true,
  opponent_bets_locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  league_id uuid references public.leagues (id) on delete cascade,
  bet_id uuid references public.bets (id) on delete cascade,
  matchup_id uuid references public.weekly_matchups (id) on delete cascade,
  notification_type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  idempotency_key text unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.league_chat_messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  message_type public.chat_message_type not null default 'user',
  body text not null default '',
  bet_id uuid references public.bets (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (message_type = 'system' and user_id is null)
    or (message_type <> 'system' and user_id is not null)
  )
);

create index notification_events_recipient_status_idx
on public.notification_events (recipient_user_id, status, created_at desc);

create index notification_events_pending_idx
on public.notification_events (status, created_at)
where status = 'pending';

create index league_chat_messages_league_created_idx
on public.league_chat_messages (league_id, created_at desc);

alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;
alter table public.league_chat_messages enable row level security;

create policy "Users can read their notification preferences"
on public.notification_preferences for select
using (user_id = auth.uid());

create policy "Users can create their notification preferences"
on public.notification_preferences for insert
with check (user_id = auth.uid());

create policy "Users can update their notification preferences"
on public.notification_preferences for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can read their queued notifications"
on public.notification_events for select
using (recipient_user_id = auth.uid());

create policy "League members can read league chat"
on public.league_chat_messages for select
using (public.is_league_member(league_id));

create policy "League members can send chat messages"
on public.league_chat_messages for insert
with check (
  user_id = auth.uid()
  and message_type in ('user', 'bet_share')
  and public.is_league_member(league_id)
);

create policy "Users can delete their own chat messages"
on public.league_chat_messages for delete
using (user_id = auth.uid());

create or replace function public.touch_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.touch_notification_preferences_updated_at();

create or replace function public.ensure_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger users_create_notification_preferences
after insert on public.users
for each row execute function public.ensure_notification_preferences();

insert into public.notification_preferences (user_id)
select id from public.users
on conflict (user_id) do nothing;

create or replace function public.enqueue_notification(
  p_recipient_user_id uuid,
  p_notification_type public.notification_type,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb,
  p_league_id uuid default null,
  p_bet_id uuid default null,
  p_matchup_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if p_recipient_user_id is null then
    return null;
  end if;

  insert into public.notification_events (
    recipient_user_id,
    league_id,
    bet_id,
    matchup_id,
    notification_type,
    title,
    body,
    data,
    idempotency_key
  )
  values (
    p_recipient_user_id,
    p_league_id,
    p_bet_id,
    p_matchup_id,
    p_notification_type,
    p_title,
    p_body,
    coalesce(p_data, '{}'::jsonb),
    p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.post_system_chat_message(
  p_league_id uuid,
  p_body text,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  inserted_id uuid;
begin
  if p_idempotency_key is not null then
    select id into existing_id
    from public.league_chat_messages
    where league_id = p_league_id
      and message_type = 'system'
      and metadata ->> 'idempotency_key' = p_idempotency_key
    limit 1;

    if existing_id is not null then
      return existing_id;
    end if;
  end if;

  insert into public.league_chat_messages (league_id, user_id, message_type, body, metadata)
  values (
    p_league_id,
    null,
    'system',
    p_body,
    coalesce(p_metadata, '{}'::jsonb) ||
      case
        when p_idempotency_key is null then '{}'::jsonb
        else jsonb_build_object('idempotency_key', p_idempotency_key)
      end
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.notify_bet_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_leg public.bet_legs;
  notification_kind public.notification_type;
  title text;
  body text;
  profit_text text;
begin
  if old.result = new.result or new.result = 'pending' then
    return new;
  end if;

  select * into first_leg
  from public.bet_legs
  where bet_id = new.id
  order by game_start_time
  limit 1;

  profit_text := case
    when coalesce(new.profit, 0) >= 0 then '+$' || to_char(coalesce(new.profit, 0), 'FM999999990.00')
    else '-$' || to_char(abs(coalesce(new.profit, 0)), 'FM999999990.00')
  end;

  notification_kind := case
    when new.result = 'win' and new.bet_type in ('parlay', 'teaser') then 'parlay_hits'::public.notification_type
    else 'bet_results'::public.notification_type
  end;

  title := case
    when new.result = 'win' and new.bet_type = 'parlay' then 'Parlay hit!'
    when new.result = 'win' and new.bet_type = 'teaser' then 'Teaser hit!'
    when new.result = 'win' then 'Bet won'
    when new.result = 'loss' then 'Bet lost'
    else 'Bet pushed'
  end;

  body := case
    when new.result = 'win' and new.bet_type = 'straight' then
      'Your bet on ' || coalesce(first_leg.selection, 'your pick') || ' hit! ' || profit_text
    when new.result = 'win' and new.bet_type in ('parlay', 'teaser') then
      'Your ' || new.bet_type || ' just hit! ' || profit_text
    when new.result = 'loss' then
      'Your ' || new.bet_type || ' settled as a loss. ' || profit_text
    else
      'Your ' || new.bet_type || ' pushed. $0.00'
  end;

  perform public.enqueue_notification(
    new.user_id,
    notification_kind,
    title,
    body,
    jsonb_build_object('type', 'bet', 'betId', new.id, 'leagueId', new.league_id),
    new.league_id,
    new.id,
    null,
    'bet_result:' || new.id::text || ':' || new.result::text
  );

  return new;
end;
$$;

create trigger bets_notify_result
after update of result on public.bets
for each row execute function public.notify_bet_result();

create or replace function public.notify_multi_leg_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_bet public.bets;
  won_count integer;
  pending_count integer;
  total_count integer;
begin
  if old.result = new.result or new.result = 'pending' then
    return new;
  end if;

  select * into parent_bet from public.bets where id = new.bet_id;

  if parent_bet.id is null or parent_bet.bet_type = 'straight' or parent_bet.result <> 'pending' then
    return new;
  end if;

  select
    count(*) filter (where result = 'win'),
    count(*) filter (where result = 'pending'),
    count(*)
  into won_count, pending_count, total_count
  from public.bet_legs
  where bet_id = new.bet_id;

  perform public.enqueue_notification(
    parent_bet.user_id,
    'parlay_leg_updates',
    initcap(parent_bet.bet_type::text) || ' leg update',
    won_count || ' of ' || total_count || ' ' || parent_bet.bet_type || ' legs hit, ' || pending_count || ' game' ||
      case when pending_count = 1 then '' else 's' end || ' remaining',
    jsonb_build_object('type', 'bet', 'betId', parent_bet.id, 'leagueId', parent_bet.league_id),
    parent_bet.league_id,
    parent_bet.id,
    null,
    'leg_update:' || new.id::text || ':' || new.result::text
  );

  return new;
end;
$$;

create trigger bet_legs_notify_multi_leg_update
after update of result on public.bet_legs
for each row execute function public.notify_multi_leg_update();

create or replace function public.notify_bets_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  placed_count integer;
  profile public.users;
  matchup public.weekly_matchups;
  opponent_id uuid;
begin
  select count(*) into placed_count
  from public.bets
  where user_id = new.user_id
    and league_id = new.league_id
    and week_number = new.week_number;

  if placed_count <> 5 then
    return new;
  end if;

  select * into profile from public.users where id = new.user_id;

  perform public.post_system_chat_message(
    new.league_id,
    coalesce(profile.display_name, 'A player') || ' locked in their bets for Week ' || new.week_number,
    jsonb_build_object('event', 'bets_locked', 'userId', new.user_id, 'weekNumber', new.week_number),
    'bets_locked:' || new.league_id::text || ':' || new.week_number || ':' || new.user_id::text
  );

  select * into matchup
  from public.weekly_matchups
  where league_id = new.league_id
    and week_number = new.week_number
    and (home_user_id = new.user_id or away_user_id = new.user_id)
  limit 1;

  if matchup.id is not null then
    opponent_id := case
      when matchup.home_user_id = new.user_id then matchup.away_user_id
      else matchup.home_user_id
    end;

    if opponent_id is not null then
      perform public.enqueue_notification(
        opponent_id,
        'opponent_bets_locked',
        'Opponent locked in',
        coalesce(profile.display_name, 'Your opponent') || ' locked in their Week ' || new.week_number || ' bets.',
        jsonb_build_object('type', 'matchup', 'matchupId', matchup.id, 'leagueId', new.league_id),
        new.league_id,
        null,
        matchup.id,
        'opponent_locked:' || matchup.id::text || ':' || new.user_id::text
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger bets_notify_locked
after insert on public.bets
for each row execute function public.notify_bets_locked();

create or replace function public.notify_matchup_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  home_profile public.users;
  away_profile public.users;
  home_body text;
  away_body text;
begin
  if new.home_profit is null or new.away_profit is null then
    return new;
  end if;

  if old.home_profit is not null and old.away_profit is not null and old.winner_id is not distinct from new.winner_id then
    return new;
  end if;

  select * into home_profile from public.users where id = new.home_user_id;
  select * into away_profile from public.users where id = new.away_user_id;

  home_body := case
    when new.winner_id = new.home_user_id then 'You beat ' || coalesce(away_profile.display_name, 'your opponent')
    when new.winner_id = new.away_user_id then 'You lost to ' || coalesce(away_profile.display_name, 'your opponent')
    else 'You tied ' || coalesce(away_profile.display_name, 'your opponent')
  end || ' $' || to_char(new.home_profit, 'FM999999990.00') || ' to $' || to_char(new.away_profit, 'FM999999990.00');

  away_body := case
    when new.winner_id = new.away_user_id then 'You beat ' || coalesce(home_profile.display_name, 'your opponent')
    when new.winner_id = new.home_user_id then 'You lost to ' || coalesce(home_profile.display_name, 'your opponent')
    else 'You tied ' || coalesce(home_profile.display_name, 'your opponent')
  end || ' $' || to_char(new.away_profit, 'FM999999990.00') || ' to $' || to_char(new.home_profit, 'FM999999990.00');

  perform public.enqueue_notification(
    new.home_user_id,
    'matchup_results',
    'Weekly matchup result',
    home_body,
    jsonb_build_object('type', 'matchup', 'matchupId', new.id, 'leagueId', new.league_id),
    new.league_id,
    null,
    new.id,
    'matchup_result:' || new.id::text || ':' || new.home_user_id::text
  );

  if new.away_user_id is not null then
    perform public.enqueue_notification(
      new.away_user_id,
      'matchup_results',
      'Weekly matchup result',
      away_body,
      jsonb_build_object('type', 'matchup', 'matchupId', new.id, 'leagueId', new.league_id),
      new.league_id,
      null,
      new.id,
      'matchup_result:' || new.id::text || ':' || new.away_user_id::text
    );
  end if;

  perform public.post_system_chat_message(
    new.league_id,
    'Week ' || new.week_number || ' results are in!',
    jsonb_build_object('event', 'week_results', 'weekNumber', new.week_number, 'matchupId', new.id),
    'week_results:' || new.league_id::text || ':' || new.week_number
  );

  return new;
end;
$$;

create trigger weekly_matchups_notify_result
after update of home_profit, away_profit, winner_id on public.weekly_matchups
for each row execute function public.notify_matchup_result();

create or replace function public.enqueue_weekly_award_notification(
  p_league_id uuid,
  p_week_number integer,
  p_user_id uuid,
  p_award_label text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  profile public.users;
  notification_id uuid;
begin
  select * into profile from public.users where id = p_user_id;

  select public.enqueue_notification(
    p_user_id,
    'weekly_awards',
    'Weekly award won',
    'You won ' || p_award_label || ' this week!',
    jsonb_build_object('type', 'league', 'leagueId', p_league_id, 'weekNumber', p_week_number),
    p_league_id,
    null,
    null,
    'weekly_award:' || p_league_id::text || ':' || p_week_number || ':' || p_award_label || ':' || p_user_id::text
  ) into notification_id;

  perform public.post_system_chat_message(
    p_league_id,
    coalesce(profile.display_name, 'A player') || ' won ' || p_award_label || ' for Week ' || p_week_number,
    jsonb_build_object('event', 'weekly_award', 'weekNumber', p_week_number, 'userId', p_user_id, 'award', p_award_label),
    'weekly_award:' || p_league_id::text || ':' || p_week_number || ':' || p_award_label || ':' || p_user_id::text
  );

  return notification_id;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.league_chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
