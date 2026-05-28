do $$
begin
  create type public.content_report_target_type as enum (
    'chat_message',
    'league',
    'league_member',
    'user_profile'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_report_status as enum (
    'pending',
    'reviewed',
    'removed',
    'dismissed'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.league_chat_messages
add column if not exists moderation_status text not null default 'active'
  check (moderation_status in ('active', 'removed')),
add column if not exists removed_at timestamptz,
add column if not exists removed_by uuid references public.users (id) on delete set null,
add column if not exists removal_reason text;

create index if not exists league_chat_messages_visible_league_created_idx
on public.league_chat_messages (league_id, created_at desc)
where moderation_status = 'active';

create table if not exists public.user_blocks (
  blocker_user_id uuid not null references public.users (id) on delete cascade,
  blocked_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create index if not exists user_blocks_blocked_user_idx
on public.user_blocks (blocked_user_id);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users (id) on delete cascade,
  target_type public.content_report_target_type not null,
  target_id uuid not null,
  league_id uuid references public.leagues (id) on delete cascade,
  reported_user_id uuid references public.users (id) on delete set null,
  reason text not null default 'objectionable_content',
  details text,
  content_snapshot jsonb not null default '{}'::jsonb,
  status public.content_report_status not null default 'pending',
  reviewer_user_id uuid references public.users (id) on delete set null,
  review_note text,
  action_taken text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reporter_user_id, target_type, target_id)
);

create index if not exists content_reports_status_created_idx
on public.content_reports (status, created_at desc);

create index if not exists content_reports_league_status_idx
on public.content_reports (league_id, status, created_at desc);

alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

drop policy if exists "League members can read league chat" on public.league_chat_messages;
create policy "League members can read visible unblocked league chat"
on public.league_chat_messages for select
using (
  moderation_status = 'active'
  and public.is_league_member(league_id)
  and (
    user_id is null
    or not exists (
      select 1
      from public.user_blocks ub
      where ub.blocker_user_id = auth.uid()
        and ub.blocked_user_id = league_chat_messages.user_id
    )
  )
);

drop policy if exists "Users can read their blocked users" on public.user_blocks;
create policy "Users can read their blocked users"
on public.user_blocks for select
to authenticated
using (blocker_user_id = auth.uid());

drop policy if exists "Users can block other users" on public.user_blocks;
create policy "Users can block other users"
on public.user_blocks for insert
to authenticated
with check (blocker_user_id = auth.uid() and blocked_user_id <> auth.uid());

drop policy if exists "Users can update their blocked users" on public.user_blocks;
create policy "Users can update their blocked users"
on public.user_blocks for update
to authenticated
using (blocker_user_id = auth.uid())
with check (blocker_user_id = auth.uid() and blocked_user_id <> auth.uid());

drop policy if exists "Users can unblock users" on public.user_blocks;
create policy "Users can unblock users"
on public.user_blocks for delete
to authenticated
using (blocker_user_id = auth.uid());

drop policy if exists "Users can create content reports" on public.content_reports;
create policy "Users can create content reports"
on public.content_reports for insert
to authenticated
with check (
  reporter_user_id = auth.uid()
  and (
    (
      target_type = 'chat_message'
      and exists (
        select 1
        from public.league_chat_messages message
        where message.id = target_id
          and message.message_type <> 'system'
          and message.moderation_status = 'active'
          and message.user_id is not null
          and message.user_id <> auth.uid()
          and public.is_league_member(message.league_id)
          and (league_id is null or league_id = message.league_id)
          and (reported_user_id is null or reported_user_id = message.user_id)
      )
    )
    or (
      target_type = 'league'
      and exists (
        select 1
        from public.leagues league
        where league.id = target_id
          and (league.visibility = 'public' or public.is_league_member(league.id))
          and (league_id is null or league_id = league.id)
          and (reported_user_id is null or reported_user_id = league.commissioner_id)
      )
    )
    or (
      target_type = 'league_member'
      and exists (
        select 1
        from public.league_members member
        where member.id = target_id
          and member.user_id <> auth.uid()
          and public.is_league_member(member.league_id)
          and (league_id is null or league_id = member.league_id)
          and (reported_user_id is null or reported_user_id = member.user_id)
      )
    )
    or (
      target_type = 'user_profile'
      and exists (
        select 1
        from public.users profile
        where profile.id = target_id
          and profile.id <> auth.uid()
          and (reported_user_id is null or reported_user_id = profile.id)
      )
    )
  )
);

drop policy if exists "Users can read their content reports" on public.content_reports;
create policy "Users can read their content reports"
on public.content_reports for select
to authenticated
using (
  reporter_user_id = auth.uid()
  or (league_id is not null and public.is_league_commissioner(league_id))
);

drop policy if exists "Users can update their pending content reports" on public.content_reports;
create policy "Users can update their pending content reports"
on public.content_reports for update
to authenticated
using (reporter_user_id = auth.uid() and status = 'pending')
with check (reporter_user_id = auth.uid() and status = 'pending');

create or replace function public.touch_content_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists content_reports_updated_at on public.content_reports;
create trigger content_reports_updated_at
before update on public.content_reports
for each row execute function public.touch_content_reports_updated_at();

create or replace function public.remove_league_chat_message(
  p_message_id uuid,
  p_reason text default 'Removed after moderation review'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_message public.league_chat_messages;
begin
  select *
  into target_message
  from public.league_chat_messages
  where id = p_message_id;

  if target_message.id is null then
    raise exception 'Chat message not found.';
  end if;

  if target_message.message_type = 'system' then
    raise exception 'System messages cannot be removed through moderation.';
  end if;

  if coalesce(auth.role(), 'anon') <> 'service_role'
    and (
      auth.uid() is null
      or (
        target_message.user_id <> auth.uid()
        and not public.is_league_commissioner(target_message.league_id)
      )
    ) then
    raise exception 'Only the author, league commissioner, or service role can remove this message.';
  end if;

  update public.league_chat_messages
  set
    moderation_status = 'removed',
    body = '[removed]',
    metadata = '{}'::jsonb,
    removed_at = now(),
    removed_by = auth.uid(),
    removal_reason = coalesce(nullif(trim(p_reason), ''), 'Removed after moderation review')
  where id = p_message_id;

  return p_message_id;
end;
$$;

create or replace function public.moderate_content_report(
  p_report_id uuid,
  p_status public.content_report_status,
  p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report public.content_reports;
begin
  select *
  into report
  from public.content_reports
  where id = p_report_id;

  if report.id is null then
    raise exception 'Content report not found.';
  end if;

  if coalesce(auth.role(), 'anon') <> 'service_role'
    and (
      auth.uid() is null
      or
      report.league_id is null
      or not public.is_league_commissioner(report.league_id)
    ) then
    raise exception 'Only a league commissioner or service role can review this report.';
  end if;

  if p_status = 'pending' then
    raise exception 'Use reviewed, removed, or dismissed for completed moderation actions.';
  end if;

  if p_status = 'removed' and report.target_type = 'chat_message' then
    perform public.remove_league_chat_message(report.target_id, p_review_note);
  end if;

  update public.content_reports
  set
    status = p_status,
    reviewer_user_id = auth.uid(),
    review_note = nullif(trim(p_review_note), ''),
    action_taken = case
      when p_status = 'removed' then 'content_removed'
      when p_status = 'dismissed' then 'report_dismissed'
      else 'reviewed'
    end,
    reviewed_at = now()
  where id = p_report_id;

  return p_report_id;
end;
$$;
