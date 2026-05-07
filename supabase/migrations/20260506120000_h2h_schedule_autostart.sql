create or replace function public.generate_h2h_regular_schedule(p_league_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league public.leagues;
  member_ids uuid[];
  rotation uuid[];
  member_count integer;
  team_count integer;
  week_number integer;
  pair_index integer;
  left_user_id uuid;
  right_user_id uuid;
  home_user_id uuid;
  away_user_id uuid;
  inserted_count integer := 0;
begin
  select * into target_league from public.leagues where id = p_league_id;

  if target_league.id is null then
    raise exception 'League not found';
  end if;

  if target_league.type <> 'h2h' then
    return 0;
  end if;

  if exists (
    select 1
    from public.weekly_matchups wm
    where wm.league_id = p_league_id
      and wm.week_number between 1 and 17
      and (wm.home_profit is not null or wm.away_profit is not null or wm.winner_id is not null)
  ) then
    raise exception 'Matchups have already been resolved for this league';
  end if;

  select array_agg(lm.user_id order by lm.joined_at, lm.user_id)
  into member_ids
  from public.league_members lm
  where lm.league_id = p_league_id;

  member_count := coalesce(array_length(member_ids, 1), 0);

  if member_count < 2 then
    raise exception 'At least two members are required to activate a head-to-head league';
  end if;

  delete from public.weekly_matchups wm
  where wm.league_id = p_league_id
    and wm.week_number between 1 and 17;

  if mod(member_count, 2) = 1 then
    member_ids := member_ids || null::uuid;
  end if;

  rotation := member_ids;
  team_count := array_length(rotation, 1);

  for week_number in 1..17 loop
    for pair_index in 1..(team_count / 2) loop
      left_user_id := rotation[pair_index];
      right_user_id := rotation[team_count - pair_index + 1];

      if left_user_id is null or right_user_id is null then
        home_user_id := coalesce(left_user_id, right_user_id);
        away_user_id := null;
      elsif mod(week_number + pair_index, 2) = 0 then
        home_user_id := left_user_id;
        away_user_id := right_user_id;
      else
        home_user_id := right_user_id;
        away_user_id := left_user_id;
      end if;

      insert into public.weekly_matchups (
        league_id,
        week_number,
        home_user_id,
        away_user_id,
        is_playoff,
        is_championship
      )
      values (
        p_league_id,
        week_number,
        home_user_id,
        away_user_id,
        week_number > 14,
        week_number = 17
      );

      inserted_count := inserted_count + 1;
    end loop;

    if team_count > 2 then
      rotation := array[rotation[1], rotation[team_count]] || rotation[2:(team_count - 1)];
    end if;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.activate_league_and_generate_schedule(p_league_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league public.leagues;
  member_count integer;
  existing_matchup_count integer;
  matchup_count integer := 0;
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

  select count(*) into member_count
  from public.league_members
  where league_id = p_league_id;

  if not public.is_league_commissioner(p_league_id, auth.uid())
    and member_count < target_league.max_members then
    raise exception 'Only the commissioner can activate this league early';
  end if;

  select count(*) into existing_matchup_count
  from public.weekly_matchups
  where league_id = p_league_id;

  if existing_matchup_count > 0 then
    return existing_matchup_count;
  end if;

  if target_league.status not in ('drafting', 'active') then
    return 0;
  end if;

  if target_league.type = 'h2h' then
    matchup_count := public.generate_h2h_regular_schedule(p_league_id);
  end if;

  insert into public.standings (
    league_id,
    user_id,
    week_number,
    wins,
    losses,
    ties,
    weekly_profit,
    total_profit,
    rank
  )
  select
    lm.league_id,
    lm.user_id,
    1,
    0,
    0,
    0,
    0,
    0,
    (rank() over (order by lm.joined_at, lm.user_id))::integer
  from public.league_members lm
  where lm.league_id = p_league_id
  on conflict (league_id, user_id, week_number) do update
    set wins = excluded.wins,
        losses = excluded.losses,
        ties = excluded.ties,
        weekly_profit = excluded.weekly_profit,
        total_profit = excluded.total_profit,
        rank = excluded.rank;

  update public.leagues
  set status = 'active',
      current_week = 1
  where id = p_league_id;

  return matchup_count;
end;
$$;

create or replace function public.join_league(p_league_id uuid)
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

  if target_league.type = 'h2h'
    and target_league.status = 'drafting'
    and updated_member_count >= target_league.max_members then
    perform public.activate_league_and_generate_schedule(p_league_id);
  end if;

  return p_league_id;
end;
$$;

grant execute on function public.activate_league_and_generate_schedule(uuid) to authenticated;
revoke execute on function public.generate_h2h_regular_schedule(uuid) from anon, authenticated;
