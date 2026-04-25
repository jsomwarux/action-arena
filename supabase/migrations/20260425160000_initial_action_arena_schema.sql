create extension if not exists pgcrypto;

create type public.league_type as enum ('h2h', 'cumulative');
create type public.league_visibility as enum ('public', 'private');
create type public.league_sport as enum ('nfl', 'nba', 'mlb');
create type public.league_status as enum ('drafting', 'active', 'playoffs', 'complete');
create type public.bet_type as enum ('straight', 'parlay', 'teaser');
create type public.bet_market as enum ('moneyline', 'spread', 'over_under');
create type public.bet_result as enum ('pending', 'win', 'loss', 'push');

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  is_premium boolean not null default false,
  push_token text,
  created_at timestamptz not null default now()
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  description text not null default '',
  commissioner_id uuid not null references public.users (id) on delete cascade,
  type public.league_type not null,
  visibility public.league_visibility not null,
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  max_members integer not null default 10 check (max_members in (4, 6, 8, 10, 12)),
  sport public.league_sport not null default 'nfl',
  season_year integer not null,
  current_week integer not null default 1 check (current_week between 1 and 17),
  status public.league_status not null default 'drafting',
  settings jsonb,
  created_at timestamptz not null default now()
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  team_name text not null check (char_length(trim(team_name)) between 1 and 80),
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table public.weekly_matchups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_number integer not null check (week_number between 1 and 17),
  home_user_id uuid not null references public.users (id) on delete cascade,
  away_user_id uuid not null references public.users (id) on delete cascade,
  home_profit numeric(10,2),
  away_profit numeric(10,2),
  winner_id uuid references public.users (id) on delete set null,
  is_playoff boolean not null default false,
  is_championship boolean not null default false,
  check (home_user_id <> away_user_id),
  unique (league_id, week_number, home_user_id, away_user_id)
);

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_number integer not null check (week_number between 1 and 17),
  bet_type public.bet_type not null,
  amount numeric(10,2) not null check (amount > 0 and amount <= 35),
  odds integer not null check (odds <> 0),
  potential_payout numeric(10,2) not null check (potential_payout >= 0),
  result public.bet_result not null default 'pending',
  profit numeric(10,2),
  teaser_points numeric(3,1) check (teaser_points in (6, 6.5, 7)),
  created_at timestamptz not null default now(),
  check ((bet_type = 'teaser' and teaser_points is not null) or (bet_type <> 'teaser' and teaser_points is null))
);

create table public.bet_legs (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets (id) on delete cascade,
  game_id text not null,
  market public.bet_market not null,
  selection text not null,
  original_line numeric(6,2),
  adjusted_line numeric(6,2),
  leg_odds integer not null check (leg_odds <> 0),
  result public.bet_result not null default 'pending',
  game_start_time timestamptz not null,
  locked boolean not null default false
);

create table public.standings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  week_number integer not null check (week_number between 1 and 17),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  ties integer not null default 0 check (ties >= 0),
  weekly_profit numeric(10,2) not null default 0,
  total_profit numeric(10,2) not null default 0,
  rank integer not null check (rank > 0),
  unique (league_id, user_id, week_number)
);

create index league_members_user_id_idx on public.league_members (user_id);
create index league_members_league_id_idx on public.league_members (league_id);
create index leagues_visibility_name_idx on public.leagues (visibility, lower(name));
create index leagues_invite_code_idx on public.leagues (invite_code);
create index weekly_matchups_league_week_idx on public.weekly_matchups (league_id, week_number);
create index weekly_matchups_users_idx on public.weekly_matchups (home_user_id, away_user_id);
create index bets_user_league_week_idx on public.bets (user_id, league_id, week_number);
create index bets_league_week_idx on public.bets (league_id, week_number);
create index bet_legs_bet_id_idx on public.bet_legs (bet_id);
create index bet_legs_game_id_idx on public.bet_legs (game_id);
create index standings_league_week_rank_idx on public.standings (league_id, week_number, rank);
create index standings_user_league_idx on public.standings (user_id, league_id);

alter table public.users enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.weekly_matchups enable row level security;
alter table public.bets enable row level security;
alter table public.bet_legs enable row level security;
alter table public.standings enable row level security;

create or replace function public.is_league_member(target_league_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.league_members lm
    where lm.league_id = target_league_id
      and lm.user_id = target_user_id
  );
$$;

create or replace function public.is_league_commissioner(target_league_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leagues l
    where l.id = target_league_id
      and l.commissioner_id = target_user_id
  );
$$;

create or replace function public.make_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i integer;
begin
  for i in 1..6 loop
    code := code || substr(alphabet, floor(random() * length(alphabet) + 1)::integer, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, 'Player'), '@', 1), 'Player'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(public.users.display_name, ''), excluded.display_name),
        avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.create_league(
  p_name text,
  p_type public.league_type,
  p_visibility public.league_visibility,
  p_max_members integer,
  p_sport public.league_sport default 'nfl',
  p_description text default '',
  p_season_year integer default extract(year from now())::integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_league_id uuid;
  code text;
  profile public.users;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_sport <> 'nfl' then
    raise exception 'Only NFL leagues are available right now';
  end if;

  if p_max_members not in (4, 6, 8, 10, 12) then
    raise exception 'Max members must be 4, 6, 8, 10, or 12';
  end if;

  select * into profile from public.users where id = auth.uid();

  if profile.id is null then
    raise exception 'User profile not found';
  end if;

  loop
    code := public.make_invite_code();
    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;

  insert into public.leagues (
    name,
    description,
    commissioner_id,
    type,
    visibility,
    invite_code,
    max_members,
    sport,
    season_year
  )
  values (
    trim(p_name),
    coalesce(p_description, ''),
    auth.uid(),
    p_type,
    p_visibility,
    code,
    p_max_members,
    p_sport,
    p_season_year
  )
  returning id into new_league_id;

  insert into public.league_members (league_id, user_id, team_name)
  values (new_league_id, auth.uid(), profile.display_name);

  insert into public.standings (league_id, user_id, week_number, rank)
  values (new_league_id, auth.uid(), 1, 1);

  return new_league_id;
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_league from public.leagues where id = p_league_id;
  if target_league.id is null then
    raise exception 'League not found';
  end if;

  select count(*) into member_count from public.league_members where league_id = p_league_id;
  if member_count >= target_league.max_members then
    raise exception 'League is full';
  end if;

  select * into profile from public.users where id = auth.uid();
  if profile.id is null then
    raise exception 'User profile not found';
  end if;

  insert into public.league_members (league_id, user_id, team_name)
  values (p_league_id, auth.uid(), profile.display_name)
  on conflict (league_id, user_id) do nothing;

  insert into public.standings (league_id, user_id, week_number, rank)
  values (p_league_id, auth.uid(), target_league.current_week, member_count + 1)
  on conflict (league_id, user_id, week_number) do nothing;

  return p_league_id;
end;
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

  return public.join_league(target_league_id);
end;
$$;

create or replace function public.submit_straight_bets(
  p_league_id uuid,
  p_week_number integer,
  p_bets jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  new_bet_id uuid;
  new_bet_ids uuid[] := '{}';
  submitted_count integer;
  submitted_total numeric(10,2);
  duplicate_game_count integer;
  existing_game_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_league_member(p_league_id, auth.uid()) then
    raise exception 'Join this league before placing bets';
  end if;

  if jsonb_typeof(p_bets) <> 'array' then
    raise exception 'Bets payload must be an array';
  end if;

  select count(*), coalesce(sum((value ->> 'amount')::numeric), 0)
  into submitted_count, submitted_total
  from jsonb_array_elements(p_bets);

  if submitted_count < 5 then
    raise exception 'At least 5 bets are required';
  end if;

  if submitted_total <> 100 then
    raise exception 'Total allocation must equal exactly $100';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_bets) value
    where (value ->> 'amount')::numeric > 35
       or (value ->> 'amount')::numeric <= 0
  ) then
    raise exception 'No single bet can exceed $35';
  end if;

  select count(*)
  into duplicate_game_count
  from (
    select value ->> 'game_id' as game_id
    from jsonb_array_elements(p_bets) value
    group by value ->> 'game_id'
    having count(*) > 1
  ) duplicate_games;

  if duplicate_game_count > 0 then
    raise exception 'Only one straight bet is allowed per game';
  end if;

  select count(*)
  into existing_game_count
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  where b.user_id = auth.uid()
    and b.league_id = p_league_id
    and b.week_number = p_week_number
    and bl.game_id in (
      select value ->> 'game_id'
      from jsonb_array_elements(p_bets) value
    );

  if existing_game_count > 0 then
    raise exception 'You already have a bet on one of these games';
  end if;

  for item in select value from jsonb_array_elements(p_bets) loop
    if (item ->> 'game_start_time')::timestamptz <= now() then
      raise exception 'One selected game has already started';
    end if;

    insert into public.bets (
      user_id,
      league_id,
      week_number,
      bet_type,
      amount,
      odds,
      potential_payout,
      result,
      teaser_points
    )
    values (
      auth.uid(),
      p_league_id,
      p_week_number,
      'straight',
      (item ->> 'amount')::numeric,
      (item ->> 'odds')::integer,
      (item ->> 'potential_payout')::numeric,
      'pending',
      null
    )
    returning id into new_bet_id;

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
      new_bet_id,
      item ->> 'game_id',
      (item ->> 'market')::public.bet_market,
      item ->> 'selection',
      nullif(item ->> 'original_line', '')::numeric,
      nullif(item ->> 'adjusted_line', '')::numeric,
      (item ->> 'leg_odds')::integer,
      'pending',
      (item ->> 'game_start_time')::timestamptz,
      false
    );

    new_bet_ids := array_append(new_bet_ids, new_bet_id);
  end loop;

  return new_bet_ids;
end;
$$;

create or replace function public.submit_bets(
  p_league_id uuid,
  p_week_number integer,
  p_bets jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  bet_item jsonb;
  leg_item jsonb;
  new_bet_id uuid;
  new_bet_ids uuid[] := '{}';
  submitted_count integer;
  submitted_total numeric(10,2);
  leg_count integer;
  bet_type_text text;
  duplicate_game_count integer;
  duplicate_selection_count integer;
  existing_selection_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_league_member(p_league_id, auth.uid()) then
    raise exception 'Join this league before placing bets';
  end if;

  if jsonb_typeof(p_bets) <> 'array' then
    raise exception 'Bets payload must be an array';
  end if;

  select count(*), coalesce(sum((value ->> 'amount')::numeric), 0)
  into submitted_count, submitted_total
  from jsonb_array_elements(p_bets);

  if submitted_count < 5 then
    raise exception 'At least 5 bets are required';
  end if;

  if submitted_total <> 100 then
    raise exception 'Total allocation must equal exactly $100';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_bets) value
    where (value ->> 'amount')::numeric > 35
       or (value ->> 'amount')::numeric <= 0
  ) then
    raise exception 'No single bet can exceed $35';
  end if;

  select count(*)
  into duplicate_game_count
  from (
    select leg ->> 'game_id' as game_id
    from jsonb_array_elements(p_bets) bet
    cross join jsonb_array_elements(bet.value -> 'legs') leg
    group by leg ->> 'game_id'
    having count(*) > 1
  ) duplicate_games;

  if duplicate_game_count > 0 then
    raise exception 'Only one selection is allowed per game across all bet types';
  end if;

  select count(*)
  into duplicate_selection_count
  from (
    select
      leg ->> 'game_id' as game_id,
      leg ->> 'market' as market,
      leg ->> 'selection' as selection
    from jsonb_array_elements(p_bets) bet
    cross join jsonb_array_elements(bet.value -> 'legs') leg
    group by leg ->> 'game_id', leg ->> 'market', leg ->> 'selection'
    having count(*) > 1
  ) duplicate_selections;

  if duplicate_selection_count > 0 then
    raise exception 'Duplicate selections are not allowed';
  end if;

  select count(*)
  into existing_selection_count
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  where b.user_id = auth.uid()
    and b.league_id = p_league_id
    and b.week_number = p_week_number
    and bl.game_id in (
      select leg ->> 'game_id'
      from jsonb_array_elements(p_bets) bet
      cross join jsonb_array_elements(bet.value -> 'legs') leg
    );

  if existing_selection_count > 0 then
    raise exception 'You already have a selection on one of these games';
  end if;

  for bet_item in select value from jsonb_array_elements(p_bets) loop
    bet_type_text := bet_item ->> 'bet_type';

    if jsonb_typeof(bet_item -> 'legs') <> 'array' then
      raise exception 'Every bet needs legs';
    end if;

    select count(*) into leg_count from jsonb_array_elements(bet_item -> 'legs');

    if bet_type_text = 'straight' and leg_count <> 1 then
      raise exception 'Straight bets must have exactly one leg';
    elsif bet_type_text = 'parlay' and (leg_count < 2 or leg_count > 6) then
      raise exception 'Parlays must have 2 to 6 legs';
    elsif bet_type_text = 'teaser' and (leg_count < 2 or leg_count > 4) then
      raise exception 'Teasers must have 2 to 4 legs';
    elsif bet_type_text not in ('straight', 'parlay', 'teaser') then
      raise exception 'Unsupported bet type';
    end if;

    if bet_type_text = 'teaser' and (bet_item ->> 'teaser_points')::numeric not in (6, 6.5, 7) then
      raise exception 'Invalid teaser point size';
    end if;

    if bet_type_text <> 'teaser' and bet_item ->> 'teaser_points' is not null then
      raise exception 'Only teasers can have teaser points';
    end if;

    if bet_type_text = 'parlay' and (bet_item ->> 'potential_payout')::numeric > 500 then
      raise exception 'Parlay payout must be capped at $500';
    end if;

    for leg_item in select value from jsonb_array_elements(bet_item -> 'legs') loop
      if (leg_item ->> 'game_start_time')::timestamptz <= now() then
        raise exception 'One selected game has already started';
      end if;

      if bet_type_text = 'teaser' and (leg_item ->> 'market') = 'moneyline' then
        raise exception 'Teasers can only use spreads and totals';
      end if;
    end loop;

    insert into public.bets (
      user_id,
      league_id,
      week_number,
      bet_type,
      amount,
      odds,
      potential_payout,
      result,
      teaser_points
    )
    values (
      auth.uid(),
      p_league_id,
      p_week_number,
      bet_type_text::public.bet_type,
      (bet_item ->> 'amount')::numeric,
      (bet_item ->> 'odds')::integer,
      (bet_item ->> 'potential_payout')::numeric,
      'pending',
      nullif(bet_item ->> 'teaser_points', '')::numeric
    )
    returning id into new_bet_id;

    for leg_item in select value from jsonb_array_elements(bet_item -> 'legs') loop
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
        new_bet_id,
        leg_item ->> 'game_id',
        (leg_item ->> 'market')::public.bet_market,
        leg_item ->> 'selection',
        nullif(leg_item ->> 'original_line', '')::numeric,
        nullif(leg_item ->> 'adjusted_line', '')::numeric,
        (leg_item ->> 'leg_odds')::integer,
        'pending',
        (leg_item ->> 'game_start_time')::timestamptz,
        false
      );
    end loop;

    new_bet_ids := array_append(new_bet_ids, new_bet_id);
  end loop;

  return new_bet_ids;
end;
$$;

create policy "Users can read authenticated profiles"
on public.users for select
to authenticated
using (true);

create policy "Users can update their own profile"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read public leagues or their leagues"
on public.leagues for select
to authenticated
using (visibility = 'public' or public.is_league_member(id));

create policy "Authenticated users can create commissioned leagues"
on public.leagues for insert
to authenticated
with check (commissioner_id = auth.uid());

create policy "Commissioners can update league settings"
on public.leagues for update
to authenticated
using (public.is_league_commissioner(id))
with check (public.is_league_commissioner(id));

create policy "Commissioners can delete leagues"
on public.leagues for delete
to authenticated
using (public.is_league_commissioner(id));

create policy "League members can read membership"
on public.league_members for select
to authenticated
using (
  public.is_league_member(league_id)
  or exists (
    select 1 from public.leagues l
    where l.id = league_id and l.visibility = 'public'
  )
);

create policy "Users can join as themselves"
on public.league_members for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their league team name"
on public.league_members for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can leave leagues"
on public.league_members for delete
to authenticated
using (user_id = auth.uid());

create policy "League members can read matchups"
on public.weekly_matchups for select
to authenticated
using (public.is_league_member(league_id));

create policy "Commissioners can manage matchups"
on public.weekly_matchups for all
to authenticated
using (public.is_league_commissioner(league_id))
with check (public.is_league_commissioner(league_id));

create policy "League members can read standings"
on public.standings for select
to authenticated
using (public.is_league_member(league_id));

create policy "Users can create their own standing rows"
on public.standings for insert
to authenticated
with check (user_id = auth.uid() and public.is_league_member(league_id));

create policy "Commissioners can manage standings"
on public.standings for all
to authenticated
using (public.is_league_commissioner(league_id))
with check (public.is_league_commissioner(league_id));

create policy "League members can read league bets"
on public.bets for select
to authenticated
using (public.is_league_member(league_id));

create policy "Users can create their own bets"
on public.bets for insert
to authenticated
with check (user_id = auth.uid() and public.is_league_member(league_id));

create policy "Users can update their own bets"
on public.bets for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own bets"
on public.bets for delete
to authenticated
using (user_id = auth.uid());

create policy "League members can read bet legs"
on public.bet_legs for select
to authenticated
using (
  exists (
    select 1
    from public.bets b
    where b.id = bet_id
      and public.is_league_member(b.league_id)
  )
);

create policy "Users can create legs for their own bets"
on public.bet_legs for insert
to authenticated
with check (
  exists (
    select 1
    from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
  )
);

create policy "Users can update legs for their own bets"
on public.bet_legs for update
to authenticated
using (
  exists (
    select 1
    from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
  )
);

create policy "Users can delete legs for their own bets"
on public.bet_legs for delete
to authenticated
using (
  exists (
    select 1
    from public.bets b
    where b.id = bet_id
      and b.user_id = auth.uid()
  )
);
