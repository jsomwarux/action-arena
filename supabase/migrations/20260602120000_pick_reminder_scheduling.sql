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
  user_id uuid not null references public.users (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_id integer not null check (week_id between 1 and 17),
  reminder_type text not null check (reminder_type in ('early', 'last_call')),
  first_game_starts_at timestamptz not null,
  notification_event_id uuid references public.notification_events (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pick_reminder_sent_log_user_league_week_type_key
    unique (user_id, league_id, week_id, reminder_type)
);

create index if not exists pick_reminder_sent_log_league_week_idx
on public.pick_reminder_sent_log (league_id, week_id, reminder_type, created_at desc);

create index if not exists pick_reminder_sent_log_user_idx
on public.pick_reminder_sent_log (user_id, created_at desc);

alter table public.pick_reminder_sent_log enable row level security;

drop policy if exists "Users can read their pick reminder sent log"
on public.pick_reminder_sent_log;

create policy "Users can read their pick reminder sent log"
on public.pick_reminder_sent_log for select
using (user_id = auth.uid());

drop policy if exists "Service role can manage pick reminder sent log"
on public.pick_reminder_sent_log;

create policy "Service role can manage pick reminder sent log"
on public.pick_reminder_sent_log for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

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
end $$;

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
