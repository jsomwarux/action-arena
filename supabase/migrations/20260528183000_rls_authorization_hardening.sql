-- Harden direct Supabase API access for user, league, pick, result, and economy data.

alter table if exists public.users enable row level security;
alter table if exists public.leagues enable row level security;
alter table if exists public.league_members enable row level security;
alter table if exists public.weekly_matchups enable row level security;
alter table if exists public.bets enable row level security;
alter table if exists public.bet_legs enable row level security;
alter table if exists public.standings enable row level security;
alter table if exists public.seasons enable row level security;
alter table if exists public.user_achievements enable row level security;
alter table if exists public.cosmetic_catalog enable row level security;
alter table if exists public.user_cosmetics enable row level security;
alter table if exists public.season_passes enable row level security;
alter table if exists public.season_pass_redeem_codes enable row level security;
alter table if exists public.odds_release_windows enable row level security;
alter table if exists public.notification_preferences enable row level security;
alter table if exists public.notification_events enable row level security;
alter table if exists public.league_chat_messages enable row level security;
alter table if exists public.league_week_slate_games enable row level security;
alter table if exists public.games enable row level security;
alter table if exists public.live_game_states enable row level security;
alter table if exists public.global_sport_weeks enable row level security;
alter table if exists public.user_blocks enable row level security;
alter table if exists public.content_reports enable row level security;

revoke select on table public.users from anon, authenticated;
grant select (id, display_name, avatar_url, is_premium, created_at)
on table public.users to authenticated;

revoke update on table public.users from anon, authenticated;
grant update (display_name, avatar_url, push_token)
on table public.users to authenticated;

revoke insert on table public.league_members from anon, authenticated;
revoke update on table public.league_members from anon, authenticated;
grant update (team_name) on table public.league_members to authenticated;

revoke insert, update, delete on table public.weekly_matchups from anon, authenticated;
revoke insert, update, delete on table public.standings from anon, authenticated;
revoke insert, update, delete on table public.bets from anon, authenticated;
revoke insert, update, delete on table public.bet_legs from anon, authenticated;
revoke insert, update, delete on table public.user_achievements from anon, authenticated;
revoke insert, update, delete on table public.user_cosmetics from anon, authenticated;
revoke insert, update, delete on table public.season_passes from anon, authenticated;

create or replace function public.public_user_json(p_user public.users)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', p_user.id,
    'display_name', p_user.display_name,
    'avatar_url', p_user.avatar_url,
    'is_premium', p_user.is_premium,
    'created_at', p_user.created_at
  );
end;
$$;

create or replace function public.get_my_arena_coin_balance()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  balance integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select arena_coins
  into balance
  from public.users
  where id = auth.uid();

  if balance is null then
    raise exception 'User profile not found';
  end if;

  return balance;
end;
$$;

create or replace function public.public_league_member_counts(p_league_ids uuid[])
returns table (league_id uuid, member_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id as league_id,
    count(lm.user_id)::integer as member_count
  from public.leagues l
  left join public.league_members lm on lm.league_id = l.id
  where l.visibility = 'public'
    and l.id = any(coalesce(p_league_ids, array[]::uuid[]))
  group by l.id
$$;

create or replace function public.bet_is_locked(p_bet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bet_legs bl
    where bl.bet_id = p_bet_id
  )
  and not exists (
    select 1
    from public.bet_legs bl
    where bl.bet_id = p_bet_id
      and not (bl.locked or bl.game_start_time <= now())
  )
$$;

create or replace function public.can_view_bet(p_bet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bets b
    where b.id = p_bet_id
      and auth.uid() is not null
      and (
        b.user_id = auth.uid()
        or (
          public.is_league_member(b.league_id, auth.uid())
          and public.bet_is_locked(b.id)
        )
      )
  )
$$;

create or replace function public.can_view_bet_details(
  p_league_id uuid,
  p_bet_user_id uuid,
  p_week_number integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_bet_user_id = auth.uid() then
    return true;
  end if;

  if not public.is_league_member(p_league_id, auth.uid()) then
    return false;
  end if;

  return exists (
    select 1
    from public.bets b
    where b.league_id = p_league_id
      and b.user_id = p_bet_user_id
      and b.week_number = p_week_number
  )
  and not exists (
    select 1
    from public.bets b
    where b.league_id = p_league_id
      and b.user_id = p_bet_user_id
      and b.week_number = p_week_number
      and not public.bet_is_locked(b.id)
  );
end;
$$;

create or replace function public.can_view_bet_leg_details(p_bet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_bet(p_bet_id)
$$;

create or replace function public.visible_bets_json(
  p_league_id uuid,
  p_week_number integer,
  p_user_id uuid,
  p_visible boolean
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null
      or not p_visible
      or not public.can_view_bet_details(p_league_id, p_user_id, p_week_number)
    then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(public.bet_with_legs_json(b) order by b.created_at, b.id)
        from public.bets b
        where b.league_id = p_league_id
          and b.week_number = p_week_number
          and b.user_id = p_user_id
          and public.can_view_bet(b.id)
      ),
      '[]'::jsonb
    )
  end
$$;

create or replace function public.get_matchup_detail(p_matchup_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  matchup_record public.weekly_matchups%rowtype;
  league_record public.leagues%rowtype;
  home_user_record public.users%rowtype;
  away_user_record public.users%rowtype;
  home_standing_record public.standings%rowtype;
  away_standing_record public.standings%rowtype;
  home_visibility jsonb;
  away_visibility jsonb;
  reveal_time timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into matchup_record
  from public.weekly_matchups
  where id = p_matchup_id;

  if matchup_record.id is null then
    raise exception 'Matchup not found';
  end if;

  if not public.is_league_member(matchup_record.league_id, auth.uid()) then
    raise exception 'Join this league before viewing matchup details';
  end if;

  select *
  into league_record
  from public.leagues
  where id = matchup_record.league_id;

  select *
  into home_user_record
  from public.users
  where id = matchup_record.home_user_id;

  if matchup_record.away_user_id is not null then
    select *
    into away_user_record
    from public.users
    where id = matchup_record.away_user_id;
  end if;

  select *
  into home_standing_record
  from public.standings
  where league_id = matchup_record.league_id
    and week_number = matchup_record.week_number
    and user_id = matchup_record.home_user_id
  limit 1;

  if matchup_record.away_user_id is not null then
    select *
    into away_standing_record
    from public.standings
    where league_id = matchup_record.league_id
      and week_number = matchup_record.week_number
      and user_id = matchup_record.away_user_id
    limit 1;
  end if;

  reveal_time := public.league_week_reveal_time(matchup_record.league_id, matchup_record.week_number);
  home_visibility := public.matchup_card_visibility_json(
    matchup_record.league_id,
    matchup_record.week_number,
    matchup_record.home_user_id,
    reveal_time
  );
  away_visibility := public.matchup_card_visibility_json(
    matchup_record.league_id,
    matchup_record.week_number,
    matchup_record.away_user_id,
    reveal_time
  );

  return jsonb_build_object(
    'awayBets',
    public.visible_bets_json(
      matchup_record.league_id,
      matchup_record.week_number,
      matchup_record.away_user_id,
      coalesce((away_visibility ->> 'isVisible')::boolean, false)
    ),
    'awayPickVisibility', away_visibility,
    'awayStanding', case when away_standing_record.id is null then null else to_jsonb(away_standing_record) end,
    'awayUser', public.public_user_json(away_user_record),
    'homeBets',
    public.visible_bets_json(
      matchup_record.league_id,
      matchup_record.week_number,
      matchup_record.home_user_id,
      coalesce((home_visibility ->> 'isVisible')::boolean, false)
    ),
    'homePickVisibility', home_visibility,
    'homeStanding', case when home_standing_record.id is null then null else to_jsonb(home_standing_record) end,
    'homeUser', public.public_user_json(home_user_record),
    'league', to_jsonb(league_record),
    'matchup', to_jsonb(matchup_record),
    'revealAt', reveal_time
  );
end;
$$;

drop policy if exists "Users can read authenticated profiles" on public.users;
create policy "Users can read own and display profiles"
on public.users for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.league_members viewer_member
    join public.league_members profile_member
      on profile_member.league_id = viewer_member.league_id
    where viewer_member.user_id = auth.uid()
      and profile_member.user_id = users.id
  )
  or exists (
    select 1
    from public.leagues l
    where l.commissioner_id = users.id
      and l.visibility = 'public'
  )
);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own public profile fields"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "League members can read membership" on public.league_members;
create policy "League members can read membership"
on public.league_members for select
to authenticated
using (user_id = auth.uid() or public.is_league_member(league_id));

drop policy if exists "Users can join as themselves" on public.league_members;

drop policy if exists "Service role can manage league memberships" on public.league_members;
create policy "Service role can manage league memberships"
on public.league_members for all
to service_role
using (true)
with check (true);

drop policy if exists "Commissioners can manage matchups" on public.weekly_matchups;
drop policy if exists "Service role can manage matchups" on public.weekly_matchups;
create policy "Service role can manage matchups"
on public.weekly_matchups for all
to service_role
using (true)
with check (true);

drop policy if exists "Users can create their own standing rows" on public.standings;
drop policy if exists "Commissioners can manage standings" on public.standings;
drop policy if exists "Service role can manage standings" on public.standings;
create policy "Service role can manage standings"
on public.standings for all
to service_role
using (true)
with check (true);

drop policy if exists "League members can read league bets" on public.bets;
drop policy if exists "League members can read visible bet details" on public.bets;
create policy "League members can read locked bet details"
on public.bets for select
to authenticated
using (public.can_view_bet(id));

drop policy if exists "Users can create their own bets" on public.bets;
drop policy if exists "Users can update their own bets" on public.bets;
drop policy if exists "Users can delete their own bets" on public.bets;
drop policy if exists "Service role can manage bets" on public.bets;
create policy "Service role can manage bets"
on public.bets for all
to service_role
using (true)
with check (true);

drop policy if exists "League members can read bet legs" on public.bet_legs;
drop policy if exists "League members can read visible bet legs" on public.bet_legs;
create policy "League members can read locked bet legs"
on public.bet_legs for select
to authenticated
using (public.can_view_bet_leg_details(bet_id));

drop policy if exists "Users can create legs for their own bets" on public.bet_legs;
drop policy if exists "Users can update legs for their own bets" on public.bet_legs;
drop policy if exists "Users can delete legs for their own bets" on public.bet_legs;
drop policy if exists "Service role can manage bet legs" on public.bet_legs;
create policy "Service role can manage bet legs"
on public.bet_legs for all
to service_role
using (true)
with check (true);

drop policy if exists "Users can store their own achievements" on public.user_achievements;
drop policy if exists "Users can refresh their own achievements" on public.user_achievements;
drop policy if exists "Service role can manage achievements" on public.user_achievements;
create policy "Service role can manage achievements"
on public.user_achievements for all
to service_role
using (true)
with check (true);

drop policy if exists "Authenticated users can read equipped cosmetics" on public.user_cosmetics;
create policy "Users can read own and equipped cosmetics"
on public.user_cosmetics for select
to authenticated
using (user_id = auth.uid() or is_equipped);

drop policy if exists "Service role can manage user cosmetics" on public.user_cosmetics;
create policy "Service role can manage user cosmetics"
on public.user_cosmetics for all
to service_role
using (true)
with check (true);

create or replace function public.join_league_internal(
  p_league_id uuid,
  p_allow_private boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league public.leagues;
  profile public.users;
  member_count integer;
  updated_member_count integer;
  existing_matchup_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_league
  from public.leagues
  where id = p_league_id
  for update;

  if target_league.id is null then
    raise exception 'League not found';
  end if;

  if target_league.visibility = 'private' and not p_allow_private then
    raise exception 'Invite code required to join this private league';
  end if;

  if exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = auth.uid()
  ) then
    return p_league_id;
  end if;

  select count(*) into member_count
  from public.league_members
  where league_id = p_league_id;

  if member_count >= target_league.max_members then
    raise exception 'League is full';
  end if;

  select * into profile from public.users where id = auth.uid();
  if profile.id is null then
    raise exception 'User profile not found';
  end if;

  insert into public.league_members (league_id, user_id, team_name)
  values (p_league_id, auth.uid(), profile.display_name);

  updated_member_count := member_count + 1;

  insert into public.standings (league_id, user_id, week_number, rank)
  values (p_league_id, auth.uid(), target_league.current_week, updated_member_count)
  on conflict (league_id, user_id, week_number) do nothing;

  select count(*)
  into existing_matchup_count
  from public.weekly_matchups
  where league_id = p_league_id;

  if target_league.type = 'h2h'
    and target_league.status in ('drafting', 'active')
    and updated_member_count >= target_league.max_members
    and existing_matchup_count = 0
  then
    perform public.activate_league_and_generate_schedule(p_league_id);
  end if;

  return p_league_id;
end;
$$;

create or replace function public.join_league(p_league_id uuid)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.join_league_internal(p_league_id, false)
$$;

create or replace function public.join_league_by_invite_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league_id uuid;
begin
  select id into target_league_id
  from public.leagues
  where invite_code = upper(trim(p_invite_code));

  if target_league_id is null then
    raise exception 'No league found for that invite code';
  end if;

  return public.join_league_internal(target_league_id, true);
end;
$$;

grant execute on function public.public_user_json(public.users) to authenticated;
grant execute on function public.get_my_arena_coin_balance() to authenticated;
grant execute on function public.public_league_member_counts(uuid[]) to authenticated;
grant execute on function public.bet_is_locked(uuid) to authenticated;
grant execute on function public.can_view_bet(uuid) to authenticated;
grant execute on function public.can_view_bet_details(uuid, uuid, integer) to authenticated;
grant execute on function public.can_view_bet_leg_details(uuid) to authenticated;
grant execute on function public.join_league(uuid) to authenticated;
grant execute on function public.join_league_by_invite_code(text) to authenticated;
grant execute on function public.get_matchup_detail(uuid) to authenticated;

revoke execute on function public.join_league_internal(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.bet_with_legs_json(public.bets) from public, anon, authenticated;
revoke execute on function public.visible_bets_json(uuid, integer, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.matchup_card_visibility_json(uuid, integer, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.grant_season_pass_cosmetics(uuid, integer) from public, anon, authenticated;
