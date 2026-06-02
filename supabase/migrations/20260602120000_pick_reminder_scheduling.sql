-- Weekly pick reminder scheduling.
-- Vault secrets are managed out-of-band and must not be hardcoded here:
-- action_arena_process_notifications_url
-- action_arena_process_notifications_bearer_token
-- action_arena_notification_cron_secret

create schema if not exists extensions;
create schema if not exists vault;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

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

create index if not exists pick_reminder_sent_log_user_idx
on public.pick_reminder_sent_log (user_id, created_at desc);

create index if not exists pick_reminder_sent_log_league_week_idx
on public.pick_reminder_sent_log (league_id, week_id, reminder_type);

alter table public.pick_reminder_sent_log enable row level security;

drop policy if exists "Users can read their pick reminder log" on public.pick_reminder_sent_log;
create policy "Users can read their pick reminder log"
on public.pick_reminder_sent_log for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Service role can manage pick reminder log" on public.pick_reminder_sent_log;
create policy "Service role can manage pick reminder log"
on public.pick_reminder_sent_log for all
to service_role
using (true)
with check (true);

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

revoke execute on function public.enqueue_weekly_pick_reminders(timestamptz, timestamptz)
  from anon, authenticated;
grant execute on function public.enqueue_weekly_pick_reminders(timestamptz, timestamptz)
  to service_role;

do $$
declare
  scheduled_job record;
begin
  for scheduled_job in
    select jobid
    from cron.job
    where jobname in (
      'weekly-pick-reminders-every-30-minutes',
      'drain-notification-queue'
    )
  loop
    perform cron.unschedule(scheduled_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'weekly-pick-reminders-every-30-minutes',
  '*/30 * * * *',
  $$ select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'action_arena_process_notifications_url' limit 1), headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'action_arena_process_notifications_bearer_token' limit 1),'x-notification-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'action_arena_notification_cron_secret' limit 1)), body := jsonb_build_object('mode','bet_reminders'), timeout_milliseconds := 5000); $$
);

select cron.schedule(
  'drain-notification-queue',
  '*/2 * * * *',
  $$ select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'action_arena_process_notifications_url' limit 1), headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'action_arena_process_notifications_bearer_token' limit 1),'x-notification-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'action_arena_notification_cron_secret' limit 1)), body := jsonb_build_object('mode','process'), timeout_milliseconds := 5000); $$
);
