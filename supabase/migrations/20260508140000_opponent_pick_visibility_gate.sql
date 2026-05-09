create table if not exists public.league_week_slate_games (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  week_number integer not null,
  game_id text not null,
  commence_time timestamptz not null,
  away_team text,
  home_team text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, week_number, game_id)
);

create index if not exists league_week_slate_games_week_idx
on public.league_week_slate_games (league_id, week_number, commence_time);

alter table public.league_week_slate_games enable row level security;

drop policy if exists "League members can read slate games" on public.league_week_slate_games;
create policy "League members can read slate games"
on public.league_week_slate_games for select
to authenticated
using (public.is_league_member(league_id));

drop policy if exists "Service role can manage slate games" on public.league_week_slate_games;
create policy "Service role can manage slate games"
on public.league_week_slate_games for all
to service_role
using (true)
with check (true);

create or replace function public.touch_league_week_slate_games_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists league_week_slate_games_updated_at on public.league_week_slate_games;
create trigger league_week_slate_games_updated_at
before update on public.league_week_slate_games
for each row execute function public.touch_league_week_slate_games_updated_at();

create or replace function public.league_week_reveal_time(
  p_league_id uuid,
  p_week_number integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  reveal_time timestamptz;
begin
  select min(commence_time)
  into reveal_time
  from public.league_week_slate_games
  where league_id = p_league_id
    and week_number = p_week_number;

  if reveal_time is not null then
    return reveal_time;
  end if;

  select min(bl.game_start_time)
  into reveal_time
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  where b.league_id = p_league_id
    and b.week_number = p_week_number;

  return reveal_time;
end;
$$;

create or replace function public.league_week_picks_revealed(
  p_league_id uuid,
  p_week_number integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  league_week integer;
  reveal_time timestamptz;
begin
  select current_week
  into league_week
  from public.leagues
  where id = p_league_id;

  if league_week is null then
    return false;
  end if;

  if p_week_number < league_week then
    return true;
  end if;

  reveal_time := public.league_week_reveal_time(p_league_id, p_week_number);
  return reveal_time is not null and now() >= reveal_time;
end;
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

  return public.league_week_picks_revealed(p_league_id, p_week_number);
end;
$$;

create or replace function public.can_view_bet_leg_details(p_bet_id uuid)
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
      and public.can_view_bet_details(b.league_id, b.user_id, b.week_number)
  );
$$;

create or replace function public.capture_bet_leg_slate_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_bet public.bets%rowtype;
begin
  select *
  into parent_bet
  from public.bets
  where id = new.bet_id;

  if parent_bet.id is null then
    return new;
  end if;

  insert into public.league_week_slate_games (
    league_id,
    week_number,
    game_id,
    commence_time
  )
  values (
    parent_bet.league_id,
    parent_bet.week_number,
    new.game_id,
    new.game_start_time
  )
  on conflict (league_id, week_number, game_id) do update
    set commence_time = excluded.commence_time;

  return new;
end;
$$;

drop trigger if exists bet_legs_capture_slate_game on public.bet_legs;
create trigger bet_legs_capture_slate_game
after insert or update of game_id, game_start_time on public.bet_legs
for each row execute function public.capture_bet_leg_slate_game();

create or replace function public.sync_league_week_slate(
  p_league_id uuid,
  p_week_number integer,
  p_games jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_league_member(p_league_id, auth.uid()) then
    raise exception 'Join this league before syncing the slate';
  end if;

  if jsonb_typeof(p_games) <> 'array' then
    raise exception 'Slate games must be an array';
  end if;

  insert into public.league_week_slate_games (
    league_id,
    week_number,
    game_id,
    commence_time,
    away_team,
    home_team
  )
  select
    p_league_id,
    p_week_number,
    game.value ->> 'game_id',
    (game.value ->> 'commence_time')::timestamptz,
    nullif(game.value ->> 'away_team', ''),
    nullif(game.value ->> 'home_team', '')
  from jsonb_array_elements(p_games) as game(value)
  where game.value ? 'game_id'
    and game.value ? 'commence_time'
    and (game.value ->> 'game_id') <> ''
  on conflict (league_id, week_number, game_id) do update
    set commence_time = excluded.commence_time,
        away_team = excluded.away_team,
        home_team = excluded.home_team;

  return public.league_week_reveal_time(p_league_id, p_week_number);
end;
$$;

create or replace function public.bet_with_legs_json(p_bet public.bets)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p_bet) || jsonb_build_object(
    'bet_legs',
    coalesce(
      (
        select jsonb_agg(to_jsonb(bl) order by bl.game_start_time, bl.id)
        from public.bet_legs bl
        where bl.bet_id = p_bet.id
      ),
      '[]'::jsonb
    )
  )
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
    when p_user_id is null or not p_visible then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(public.bet_with_legs_json(b) order by b.created_at, b.id)
        from public.bets b
        where b.league_id = p_league_id
          and b.week_number = p_week_number
          and b.user_id = p_user_id
      ),
      '[]'::jsonb
    )
  end
$$;

create or replace function public.matchup_card_visibility_json(
  p_league_id uuid,
  p_week_number integer,
  p_user_id uuid,
  p_reveal_time timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  submitted boolean := false;
  visible boolean := false;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'hiddenReason', 'no_user',
      'isSubmitted', false,
      'isVisible', false,
      'revealAt', p_reveal_time,
      'userId', null
    );
  end if;

  select exists (
    select 1
    from public.bets b
    where b.league_id = p_league_id
      and b.week_number = p_week_number
      and b.user_id = p_user_id
  )
  into submitted;

  visible := public.can_view_bet_details(p_league_id, p_user_id, p_week_number);

  return jsonb_build_object(
    'hiddenReason',
    case
      when visible and p_user_id = auth.uid() then 'own_card'
      when visible then 'revealed'
      when submitted then 'hidden_until_kickoff'
      else 'not_submitted'
    end,
    'isSubmitted', submitted,
    'isVisible', visible,
    'revealAt', p_reveal_time,
    'userId', p_user_id
  );
end;
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
    'awayUser', case when away_user_record.id is null then null else to_jsonb(away_user_record) end,
    'homeBets',
    public.visible_bets_json(
      matchup_record.league_id,
      matchup_record.week_number,
      matchup_record.home_user_id,
      coalesce((home_visibility ->> 'isVisible')::boolean, false)
    ),
    'homePickVisibility', home_visibility,
    'homeStanding', case when home_standing_record.id is null then null else to_jsonb(home_standing_record) end,
    'homeUser', to_jsonb(home_user_record),
    'league', to_jsonb(league_record),
    'matchup', to_jsonb(matchup_record),
    'revealAt', reveal_time
  );
end;
$$;

drop policy if exists "League members can read league bets" on public.bets;
create policy "League members can read visible bet details"
on public.bets for select
to authenticated
using (public.can_view_bet_details(league_id, user_id, week_number));

drop policy if exists "League members can read bet legs" on public.bet_legs;
create policy "League members can read visible bet legs"
on public.bet_legs for select
to authenticated
using (public.can_view_bet_leg_details(bet_id));

grant execute on function public.league_week_reveal_time(uuid, integer) to authenticated;
grant execute on function public.league_week_picks_revealed(uuid, integer) to authenticated;
grant execute on function public.sync_league_week_slate(uuid, integer, jsonb) to authenticated;
grant execute on function public.get_matchup_detail(uuid) to authenticated;
