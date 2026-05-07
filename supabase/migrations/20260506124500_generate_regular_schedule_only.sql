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
      and wm.week_number between 1 and 14
      and (wm.home_profit is not null or wm.away_profit is not null or wm.winner_id is not null)
  ) then
    raise exception 'Regular season matchups have already been resolved for this league';
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
    and wm.week_number between 1 and 14;

  delete from public.weekly_matchups wm
  where wm.league_id = p_league_id
    and wm.week_number between 15 and 17
    and wm.home_profit is null
    and wm.away_profit is null
    and wm.winner_id is null;

  if mod(member_count, 2) = 1 then
    member_ids := member_ids || null::uuid;
  end if;

  rotation := member_ids;
  team_count := array_length(rotation, 1);

  for week_number in 1..14 loop
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
        false,
        false
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

delete from public.weekly_matchups wm
using public.leagues l
where l.id = wm.league_id
  and l.type = 'h2h'
  and l.status in ('drafting', 'active')
  and l.current_week <= 14
  and wm.week_number between 15 and 17
  and wm.home_profit is null
  and wm.away_profit is null
  and wm.winner_id is null;

revoke execute on function public.generate_h2h_regular_schedule(uuid) from anon, authenticated;
