create table if not exists public.games (
  game_id text primary key,
  sport public.league_sport not null default 'nfl',
  season_year integer,
  week_number integer,
  commence_time timestamptz not null,
  away_team text,
  home_team text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_sport_commence_time_idx
on public.games (sport, commence_time);

create index if not exists league_week_slate_games_game_id_idx
on public.league_week_slate_games (game_id);

alter table public.games enable row level security;

drop policy if exists "League members can read games" on public.games;
create policy "League members can read games"
on public.games for select
to authenticated
using (
  exists (
    select 1
    from public.league_week_slate_games slate
    where slate.game_id = games.game_id
      and public.is_league_member(slate.league_id)
  )
);

drop policy if exists "Service role can manage games" on public.games;
create policy "Service role can manage games"
on public.games for all
to service_role
using (true)
with check (true);

create or replace function public.touch_games_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_updated_at on public.games;
create trigger games_updated_at
before update on public.games
for each row execute function public.touch_games_updated_at();

insert into public.games (
  game_id,
  sport,
  season_year,
  week_number,
  commence_time,
  away_team,
  home_team
)
select distinct on (slate.game_id)
  slate.game_id,
  league.sport,
  league.season_year,
  slate.week_number,
  slate.commence_time,
  slate.away_team,
  slate.home_team
from public.league_week_slate_games slate
join public.leagues league on league.id = slate.league_id
order by slate.game_id, slate.commence_time
on conflict (game_id) do update
  set sport = excluded.sport,
      season_year = coalesce(public.games.season_year, excluded.season_year),
      week_number = coalesce(public.games.week_number, excluded.week_number),
      commence_time = least(public.games.commence_time, excluded.commence_time),
      away_team = coalesce(public.games.away_team, excluded.away_team),
      home_team = coalesce(public.games.home_team, excluded.home_team);

create or replace function public.upsert_game(
  p_game_id text,
  p_sport public.league_sport,
  p_season_year integer,
  p_week_number integer,
  p_commence_time timestamptz,
  p_away_team text default null,
  p_home_team text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_game_id, '') = '' or p_commence_time is null then
    return;
  end if;

  insert into public.games (
    game_id,
    sport,
    season_year,
    week_number,
    commence_time,
    away_team,
    home_team
  )
  values (
    p_game_id,
    coalesce(p_sport, 'nfl'::public.league_sport),
    p_season_year,
    p_week_number,
    p_commence_time,
    nullif(p_away_team, ''),
    nullif(p_home_team, '')
  )
  on conflict (game_id) do update
    set sport = excluded.sport,
        season_year = coalesce(public.games.season_year, excluded.season_year),
        week_number = coalesce(public.games.week_number, excluded.week_number),
        commence_time = case
          when public.games.commence_time <= now()
            or excluded.commence_time <= now()
            then least(public.games.commence_time, excluded.commence_time)
          else excluded.commence_time
        end,
        away_team = coalesce(excluded.away_team, public.games.away_team),
        home_team = coalesce(excluded.home_team, public.games.home_team)
    where public.games.sport is distinct from excluded.sport
      or public.games.season_year is distinct from coalesce(public.games.season_year, excluded.season_year)
      or public.games.week_number is distinct from coalesce(public.games.week_number, excluded.week_number)
      or public.games.commence_time is distinct from case
        when public.games.commence_time <= now()
          or excluded.commence_time <= now()
          then least(public.games.commence_time, excluded.commence_time)
        else excluded.commence_time
      end
      or public.games.away_team is distinct from coalesce(excluded.away_team, public.games.away_team)
      or public.games.home_team is distinct from coalesce(excluded.home_team, public.games.home_team);
end;
$$;

revoke execute on function public.upsert_game(text, public.league_sport, integer, integer, timestamptz, text, text) from anon, authenticated;
grant execute on function public.upsert_game(text, public.league_sport, integer, integer, timestamptz, text, text) to service_role;

create or replace function public.propagate_game_commence_time()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.league_week_slate_games slate
  set commence_time = new.commence_time,
      away_team = coalesce(new.away_team, slate.away_team),
      home_team = coalesce(new.home_team, slate.home_team)
  where slate.game_id = new.game_id
    and (
      slate.commence_time is distinct from new.commence_time
      or slate.away_team is distinct from coalesce(new.away_team, slate.away_team)
      or slate.home_team is distinct from coalesce(new.home_team, slate.home_team)
    );

  update public.bet_legs leg
  set game_start_time = case
        when leg.locked and leg.game_start_time <= new.commence_time then leg.game_start_time
        else new.commence_time
      end,
      locked = leg.locked or new.commence_time <= now()
  where leg.game_id = new.game_id
    and (
      (not leg.locked and leg.game_start_time is distinct from new.commence_time)
      or (new.commence_time <= now() and not leg.locked)
      or (leg.locked and leg.game_start_time > new.commence_time)
    );

  return new;
end;
$$;

drop trigger if exists games_propagate_commence_time on public.games;
create trigger games_propagate_commence_time
after insert or update of commence_time, away_team, home_team on public.games
for each row execute function public.propagate_game_commence_time();

create or replace function public.apply_canonical_game_to_bet_leg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_game public.games%rowtype;
begin
  select *
  into canonical_game
  from public.games
  where game_id = new.game_id;

  if canonical_game.game_id is not null then
    new.game_start_time := canonical_game.commence_time;
    new.locked := new.locked or canonical_game.commence_time <= now();
  end if;

  return new;
end;
$$;

drop trigger if exists bet_legs_apply_canonical_game on public.bet_legs;
create trigger bet_legs_apply_canonical_game
before insert or update of game_id, game_start_time on public.bet_legs
for each row execute function public.apply_canonical_game_to_bet_leg();

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
  select min(coalesce(game.commence_time, slate.commence_time))
  into reveal_time
  from public.league_week_slate_games slate
  left join public.games game on game.game_id = slate.game_id
  where slate.league_id = p_league_id
    and slate.week_number = p_week_number;

  if reveal_time is not null then
    return reveal_time;
  end if;

  select min(coalesce(game.commence_time, bl.game_start_time))
  into reveal_time
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  left join public.games game on game.game_id = bl.game_id
  where b.league_id = p_league_id
    and b.week_number = p_week_number;

  return reveal_time;
end;
$$;

create or replace function public.capture_bet_leg_slate_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_bet public.bets%rowtype;
  parent_league public.leagues%rowtype;
  canonical_commence_time timestamptz;
begin
  select *
  into parent_bet
  from public.bets
  where id = new.bet_id;

  if parent_bet.id is null then
    return new;
  end if;

  select *
  into parent_league
  from public.leagues
  where id = parent_bet.league_id;

  if parent_league.id is not null then
    perform public.upsert_game(
      new.game_id,
      parent_league.sport,
      parent_league.season_year,
      parent_bet.week_number,
      new.game_start_time
    );
  end if;

  select game.commence_time
  into canonical_commence_time
  from public.games game
  where game.game_id = new.game_id;

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
    coalesce(canonical_commence_time, new.game_start_time)
  )
  on conflict (league_id, week_number, game_id) do update
    set commence_time = excluded.commence_time
    where public.league_week_slate_games.commence_time is distinct from excluded.commence_time;

  return new;
end;
$$;

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
declare
  target_league public.leagues%rowtype;
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

  select *
  into target_league
  from public.leagues
  where id = p_league_id;

  if target_league.id is null then
    raise exception 'League not found';
  end if;

  perform public.upsert_game(
    game.value ->> 'game_id',
    target_league.sport,
    target_league.season_year,
    p_week_number,
    (game.value ->> 'commence_time')::timestamptz,
    nullif(game.value ->> 'away_team', ''),
    nullif(game.value ->> 'home_team', '')
  )
  from jsonb_array_elements(p_games) as game(value)
  where game.value ? 'game_id'
    and game.value ? 'commence_time'
    and (game.value ->> 'game_id') <> '';

  with source_games as (
    select
      game.value ->> 'game_id' as game_id,
      (game.value ->> 'commence_time')::timestamptz as commence_time,
      nullif(game.value ->> 'away_team', '') as away_team,
      nullif(game.value ->> 'home_team', '') as home_team
    from jsonb_array_elements(p_games) as game(value)
    where game.value ? 'game_id'
      and game.value ? 'commence_time'
      and (game.value ->> 'game_id') <> ''
  )
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
    source.game_id,
    coalesce(canonical.commence_time, source.commence_time),
    coalesce(canonical.away_team, source.away_team),
    coalesce(canonical.home_team, source.home_team)
  from source_games source
  left join public.games canonical on canonical.game_id = source.game_id
  on conflict (league_id, week_number, game_id) do update
    set commence_time = excluded.commence_time,
        away_team = excluded.away_team,
        home_team = excluded.home_team;

  return public.league_week_reveal_time(p_league_id, p_week_number);
end;
$$;

create or replace function public.live_score_polling_candidates()
returns table (
  game_id text,
  away_team text,
  home_team text,
  commence_time timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  with slate_games as (
    select distinct on (slate.game_id)
      slate.game_id,
      coalesce(live.away_team, game.away_team, slate.away_team, 'Away') as away_team,
      coalesce(live.home_team, game.home_team, slate.home_team, 'Home') as home_team,
      coalesce(game.commence_time, slate.commence_time) as commence_time,
      coalesce(live.status, 'scheduled') as status
    from public.league_week_slate_games slate
    left join public.games game on game.game_id = slate.game_id
    left join public.live_game_states live on live.game_id = slate.game_id
    order by slate.game_id, coalesce(game.commence_time, slate.commence_time)
  )
  select
    slate_games.game_id,
    slate_games.away_team,
    slate_games.home_team,
    slate_games.commence_time,
    slate_games.status
  from slate_games
  where slate_games.status in ('in_progress', 'halftime')
    or (
      slate_games.commence_time <= now() + interval '5 minutes'
      and slate_games.commence_time >= now() - interval '8 hours'
      and slate_games.status <> 'final'
    );
$$;

create or replace function public.capture_live_game_state_game()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('in_progress', 'halftime', 'final') then
    return new;
  end if;

  perform public.upsert_game(
    new.game_id,
    'nfl'::public.league_sport,
    null,
    null,
    coalesce(new.last_updated, now()),
    new.away_team,
    new.home_team
  );

  return new;
end;
$$;

drop trigger if exists live_game_states_capture_game on public.live_game_states;
create trigger live_game_states_capture_game
after insert or update of status, last_updated, away_team, home_team on public.live_game_states
for each row execute function public.capture_live_game_state_game();

create or replace function public.settle_completed_scores(p_scores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  score_item jsonb;
  changed_leg_count integer;
  completed_count integer := 0;
  updated_leg_count integer := 0;
  settled_bet_count integer := 0;
  resolved_week_count integer := 0;
  home_score integer;
  away_score integer;
  resolved_commence_time timestamptz;
  bet_record public.bets;
  leg_record public.bet_legs;
  loss_count integer;
  pending_count integer;
  remaining_leg_count integer;
  computed_result public.bet_result;
  computed_profit numeric(10,2);
  payout numeric;
  combined_decimal numeric;
  teaser_odds integer;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Scores payload must be a JSON array';
  end if;

  create temporary table if not exists updated_bets (
    bet_id uuid primary key,
    league_id uuid not null,
    week_number integer not null
  ) on commit drop;

  truncate table updated_bets;

  for score_item in
    select value from jsonb_array_elements(p_scores)
  loop
    continue when not coalesce((score_item ->> 'completed')::boolean, false);
    continue when jsonb_typeof(score_item -> 'scores') <> 'array';

    select (score_entry.value ->> 'score')::integer
    into home_score
    from jsonb_array_elements(score_item -> 'scores') as score_entry(value)
    where score_entry.value ->> 'name' = score_item ->> 'home_team';

    select (score_entry.value ->> 'score')::integer
    into away_score
    from jsonb_array_elements(score_item -> 'scores') as score_entry(value)
    where score_entry.value ->> 'name' = score_item ->> 'away_team';

    if home_score is null or away_score is null then
      continue;
    end if;

    completed_count := completed_count + 1;
    resolved_commence_time := coalesce(
      nullif(score_item ->> 'commence_time', '')::timestamptz,
      nullif(score_item ->> 'last_update', '')::timestamptz,
      now()
    );

    perform public.upsert_game(
      score_item ->> 'id',
      'nfl'::public.league_sport,
      null,
      null,
      resolved_commence_time,
      nullif(score_item ->> 'away_team', ''),
      nullif(score_item ->> 'home_team', '')
    );

    with evaluated as (
      select
        bl.id,
        public.evaluate_bet_leg(
          bl.market,
          bl.selection,
          bl.adjusted_line,
          score_item ->> 'home_team',
          score_item ->> 'away_team',
          home_score,
          away_score
        ) as leg_result
      from public.bet_legs bl
      where bl.game_id = score_item ->> 'id'
        and (
          bl.result = 'pending'
          or (
            bl.result = 'push'
            and bl.market in ('spread', 'over_under')
            and bl.adjusted_line is not null
            and not public.is_whole_point_line(bl.adjusted_line)
          )
        )
    ),
    updated as (
      update public.bet_legs bl
      set result = evaluated.leg_result,
          game_start_time = least(bl.game_start_time, resolved_commence_time),
          locked = true
      from evaluated
      where bl.id = evaluated.id
        and evaluated.leg_result is not null
        and bl.result is distinct from evaluated.leg_result
      returning bl.bet_id
    ),
    inserted as (
      insert into updated_bets (bet_id, league_id, week_number)
      select distinct b.id, b.league_id, b.week_number
      from updated
      join public.bets b on b.id = updated.bet_id
      on conflict (bet_id) do nothing
      returning 1
    )
    select count(*)
    into changed_leg_count
    from updated;

    updated_leg_count := updated_leg_count + coalesce(changed_leg_count, 0);
  end loop;

  for bet_record in
    select b.*
    from public.bets b
    where (
        b.result = 'pending'
        and (
          exists (
            select 1
            from public.bet_legs bl
            where bl.bet_id = b.id
              and bl.result = 'loss'
          )
          or not exists (
            select 1
            from public.bet_legs bl
            where bl.bet_id = b.id
              and bl.result = 'pending'
          )
        )
      )
      or exists (
        select 1
        from updated_bets ub
        where ub.bet_id = b.id
      )
  loop
    computed_result := null;
    computed_profit := null;

    if bet_record.bet_type = 'straight' then
      select *
      into leg_record
      from public.bet_legs
      where bet_id = bet_record.id
      limit 1;

      if leg_record.result = 'win' then
        payout := public.payout_from_american(bet_record.amount, leg_record.leg_odds);
        computed_result := 'win';
        computed_profit := round(payout - bet_record.amount, 2);
      elsif leg_record.result = 'loss' then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif leg_record.result = 'push' then
        computed_result := 'push';
        computed_profit := 0;
      end if;
    elsif bet_record.bet_type = 'parlay' then
      select
        count(*) filter (where result = 'loss'),
        count(*) filter (where result = 'pending')
      into loss_count, pending_count
      from public.bet_legs
      where bet_id = bet_record.id;

      if loss_count > 0 then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif pending_count = 0 then
        select count(*)
        into remaining_leg_count
        from public.bet_legs
        where bet_id = bet_record.id
          and result <> 'push';

        if remaining_leg_count = 0 then
          computed_result := 'push';
          computed_profit := 0;
        elsif remaining_leg_count = 1 then
          select *
          into leg_record
          from public.bet_legs
          where bet_id = bet_record.id
            and result <> 'push'
          limit 1;

          payout := public.payout_from_american(bet_record.amount, leg_record.leg_odds);
          computed_result := 'win';
          computed_profit := round(payout - bet_record.amount, 2);
        else
          combined_decimal := 1;

          for leg_record in
            select *
            from public.bet_legs
            where bet_id = bet_record.id
              and result <> 'push'
          loop
            combined_decimal := combined_decimal * public.american_to_decimal(leg_record.leg_odds);
          end loop;

          payout := least(round(bet_record.amount * combined_decimal, 2), 500);
          computed_result := 'win';
          computed_profit := round(payout - bet_record.amount, 2);
        end if;
      end if;
    elsif bet_record.bet_type = 'teaser' then
      select
        count(*) filter (where result = 'loss'),
        count(*) filter (where result = 'pending')
      into loss_count, pending_count
      from public.bet_legs
      where bet_id = bet_record.id;

      if loss_count > 0 then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif pending_count = 0 then
        select count(*)
        into remaining_leg_count
        from public.bet_legs
        where bet_id = bet_record.id
          and result <> 'push';

        if remaining_leg_count < 2 then
          computed_result := 'push';
          computed_profit := 0;
        else
          teaser_odds := public.teaser_odds_for(remaining_leg_count, bet_record.teaser_points);

          if teaser_odds is null then
            raise warning 'No teaser odds for bet %, remaining legs %, teaser points %',
              bet_record.id,
              remaining_leg_count,
              bet_record.teaser_points;
          else
            payout := public.payout_from_american(bet_record.amount, teaser_odds);
            computed_result := 'win';
            computed_profit := round(payout - bet_record.amount, 2);
          end if;
        end if;
      end if;
    end if;

    if computed_result is not null then
      if bet_record.is_lock and computed_result in ('win', 'loss') then
        computed_profit := round(computed_profit * 1.5, 2);
      end if;

      update public.bets
      set result = computed_result,
          profit = computed_profit
      where id = bet_record.id
        and (
          result is distinct from computed_result
          or profit is distinct from computed_profit
        );

      insert into updated_bets (bet_id, league_id, week_number)
      values (bet_record.id, bet_record.league_id, bet_record.week_number)
      on conflict (bet_id) do nothing;

      settled_bet_count := settled_bet_count + 1;
    end if;
  end loop;

  resolved_week_count := public.resolve_ready_weekly_standings();

  return jsonb_build_object(
    'completed_games', completed_count,
    'updated_legs', updated_leg_count,
    'settled_bets', settled_bet_count,
    'resolved_weeks', resolved_week_count
  );
end;
$$;
