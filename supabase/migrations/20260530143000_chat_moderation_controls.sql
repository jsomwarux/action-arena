-- App Store Guideline 1.2 chat moderation controls for league chat.

alter table if exists public.league_chat_messages
drop constraint if exists league_chat_messages_is_hidden_not_null;

drop policy if exists "League members can read league chat" on public.league_chat_messages;
drop policy if exists "League members can read visible unblocked league chat" on public.league_chat_messages;
drop policy if exists "League members can send chat messages" on public.league_chat_messages;
drop policy if exists "Users can read their blocked users" on public.user_blocks;
drop policy if exists "Users can block other users" on public.user_blocks;
drop policy if exists "Users can update their blocked users" on public.user_blocks;
drop policy if exists "Users can unblock users" on public.user_blocks;

alter table public.league_chat_messages
add column if not exists is_hidden boolean not null default false;

alter table public.users
add column if not exists chat_banned boolean not null default false;

alter table public.users
add column if not exists chat_terms_accepted_at timestamptz;

create index if not exists league_chat_messages_moderated_visible_idx
on public.league_chat_messages (league_id, created_at desc)
where is_hidden = false and moderation_status = 'active';

alter table public.user_blocks
add column if not exists id uuid,
add column if not exists blocker_id uuid,
add column if not exists blocked_id uuid,
add column if not exists league_id uuid;

update public.user_blocks
set
  id = coalesce(id, gen_random_uuid()),
  blocker_id = coalesce(blocker_id, blocker_user_id),
  blocked_id = coalesce(blocked_id, blocked_user_id)
where id is null
  or blocker_id is null
  or blocked_id is null;

alter table public.user_blocks
alter column id set default gen_random_uuid(),
alter column id set not null,
alter column blocker_id set not null,
alter column blocked_id set not null;

alter table public.user_blocks
drop constraint if exists user_blocks_pkey,
drop constraint if exists user_blocks_blocker_user_id_fkey,
drop constraint if exists user_blocks_blocked_user_id_fkey,
drop constraint if exists user_blocks_blocker_user_id_blocked_user_id_key,
drop constraint if exists user_blocks_blocker_id_blocked_id_key,
drop constraint if exists user_blocks_not_self_check;

drop index if exists public.user_blocks_blocked_user_idx;

alter table public.user_blocks
add constraint user_blocks_pkey primary key (id),
add constraint user_blocks_blocker_id_fkey
  foreign key (blocker_id) references public.users (id) on delete cascade,
add constraint user_blocks_blocked_id_fkey
  foreign key (blocked_id) references public.users (id) on delete cascade,
add constraint user_blocks_league_id_fkey
  foreign key (league_id) references public.leagues (id) on delete cascade,
add constraint user_blocks_blocker_id_blocked_id_key unique (blocker_id, blocked_id),
add constraint user_blocks_not_self_check check (blocker_id <> blocked_id);

alter table public.user_blocks
drop column if exists blocker_user_id,
drop column if exists blocked_user_id;

create index if not exists user_blocks_blocked_id_idx
on public.user_blocks (blocked_id);

create index if not exists user_blocks_blocker_created_idx
on public.user_blocks (blocker_id, created_at desc);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,
  reported_message_id uuid references public.league_chat_messages (id) on delete set null,
  reported_user_id uuid not null references public.users (id) on delete cascade,
  league_id uuid references public.leagues (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 2 and 80),
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'removed', 'dismissed')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create index if not exists message_reports_reporter_created_idx
on public.message_reports (reporter_id, created_at desc);

create index if not exists message_reports_status_created_idx
on public.message_reports (status, created_at desc);

create index if not exists message_reports_league_status_idx
on public.message_reports (league_id, status, created_at desc);

alter table public.user_blocks enable row level security;
alter table public.message_reports enable row level security;

grant select, insert, delete on table public.user_blocks to authenticated;
grant all on table public.user_blocks to service_role;
grant select, insert on table public.message_reports to authenticated;
grant all on table public.message_reports to service_role;

create policy "Users can read their blocked users"
on public.user_blocks for select
to authenticated
using (blocker_id = auth.uid());

create policy "Users can block other users"
on public.user_blocks for insert
to authenticated
with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

create policy "Users can unblock users"
on public.user_blocks for delete
to authenticated
using (blocker_id = auth.uid());

create policy "Users can create their own message reports"
on public.message_reports for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and reported_user_id <> auth.uid()
  and (
    reported_message_id is null
    or exists (
      select 1
      from public.league_chat_messages message
      where message.id = reported_message_id
        and message.message_type <> 'system'
        and message.user_id = reported_user_id
        and message.is_hidden = false
        and message.moderation_status = 'active'
        and public.is_league_member(message.league_id, auth.uid())
        and (league_id is null or league_id = message.league_id)
    )
  )
);

create policy "Users can read their own message reports"
on public.message_reports for select
to authenticated
using (reporter_id = auth.uid());

create policy "Service role can read all message reports"
on public.message_reports for select
to service_role
using (true);

create or replace function public.is_chat_banned(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.chat_banned
      from public.users u
      where u.id = target_user_id
    ),
    false
  )
$$;

create or replace function public.has_accepted_chat_terms(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = target_user_id
      and u.chat_terms_accepted_at is not null
  )
$$;

create or replace function public.accept_chat_terms()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.users
  set chat_terms_accepted_at = coalesce(chat_terms_accepted_at, now())
  where id = auth.uid()
  returning chat_terms_accepted_at into accepted_at;

  if accepted_at is null then
    raise exception 'User profile not found';
  end if;

  return accepted_at;
end;
$$;

create or replace function public.get_my_chat_moderation_status()
returns table (
  chat_banned boolean,
  chat_terms_accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select u.chat_banned, u.chat_terms_accepted_at
  from public.users u
  where u.id = auth.uid();
end;
$$;

grant execute on function public.accept_chat_terms() to authenticated;
grant execute on function public.get_my_chat_moderation_status() to authenticated;

create or replace function public.chat_filter_normalize(p_text text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(p_text, '')), '[^[:alnum:]]+', ' ', 'g'))
$$;

create or replace function public.chat_banned_terms()
returns text[]
language sql
immutable
as $$
  select array[
    'kys',
    'kill yourself',
    'rape',
    'porn',
    'onlyfans',
    'nazi',
    'dox',
    'doxx',
    'scam link'
  ]::text[]
$$;

create or replace function public.chat_text_contains_banned_term(p_text text)
returns boolean
language sql
immutable
as $$
  with normalized_message as (
    select (' ' || public.chat_filter_normalize(p_text) || ' ') as value
  )
  select exists (
    select 1
    from normalized_message message,
      unnest(public.chat_banned_terms()) as term
    where message.value like ('% ' || public.chat_filter_normalize(term) || ' %')
  )
$$;

create or replace function public.enforce_league_chat_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_type <> 'system' then
    if new.user_id is null then
      raise exception 'Chat author is required.';
    end if;

    if public.is_chat_banned(new.user_id) then
      raise exception 'This account is not allowed to post in chat.';
    end if;

    if not public.has_accepted_chat_terms(new.user_id) then
      raise exception 'Accept the chat terms before posting.';
    end if;

    if public.chat_text_contains_banned_term(new.body) then
      raise exception 'Message contains objectionable content. Please revise and try again.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_league_chat_moderation on public.league_chat_messages;
create trigger enforce_league_chat_moderation
before insert on public.league_chat_messages
for each row execute function public.enforce_league_chat_moderation();

create policy "League members can read visible unblocked league chat"
on public.league_chat_messages for select
to authenticated
using (
  is_hidden = false
  and moderation_status = 'active'
  and public.is_league_member(league_id, auth.uid())
  and (
    user_id is null
    or (
      not public.is_chat_banned(user_id)
      and not exists (
        select 1
        from public.user_blocks ub
        where ub.blocker_id = auth.uid()
          and ub.blocked_id = league_chat_messages.user_id
      )
    )
  )
);

create policy "League members can send chat messages"
on public.league_chat_messages for insert
to authenticated
with check (
  user_id = auth.uid()
  and message_type in ('user', 'bet_share', 'sticker')
  and public.is_league_member(league_id, auth.uid())
  and not public.is_chat_banned(auth.uid())
  and public.has_accepted_chat_terms(auth.uid())
);

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
        and not public.is_league_commissioner(target_message.league_id, auth.uid())
      )
    ) then
    raise exception 'Only the author, league commissioner, or service role can remove this message.';
  end if;

  update public.league_chat_messages
  set
    is_hidden = true,
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

create or replace function public.moderate_message_report(
  p_report_id uuid,
  p_status text,
  p_hide_message boolean default false,
  p_ban_user boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  report public.message_reports;
begin
  select *
  into report
  from public.message_reports
  where id = p_report_id;

  if report.id is null then
    raise exception 'Message report not found.';
  end if;

  if p_status not in ('reviewed', 'removed', 'dismissed') then
    raise exception 'Use reviewed, removed, or dismissed for completed moderation actions.';
  end if;

  if coalesce(auth.role(), 'anon') <> 'service_role'
    and (
      auth.uid() is null
      or report.league_id is null
      or not public.is_league_commissioner(report.league_id, auth.uid())
    ) then
    raise exception 'Only a league commissioner or service role can review this report.';
  end if;

  if p_hide_message and report.reported_message_id is not null then
    perform public.remove_league_chat_message(report.reported_message_id, 'Removed after message report review');
  end if;

  if p_ban_user then
    update public.users
    set chat_banned = true
    where id = report.reported_user_id;
  end if;

  update public.message_reports
  set status = p_status
  where id = p_report_id;

  return p_report_id;
end;
$$;
