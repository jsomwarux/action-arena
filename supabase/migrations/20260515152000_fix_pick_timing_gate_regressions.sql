-- Keep canonical game timing as the shared NFL schedule source while preserving
-- started-time compatibility updates used by post-submit edit gates, opponent
-- pick reveal gates, and Pick of the Week card actions.

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
    -- Future odds refreshes should follow the canonical game row, but an
    -- explicit started/locked leg update must be able to move that canonical
    -- kickoff earlier through the after-trigger fan-out path.
    new.game_start_time := case
      when new.locked or new.game_start_time <= now() then least(new.game_start_time, canonical_game.commence_time)
      else canonical_game.commence_time
    end;
    new.locked := new.locked or new.game_start_time <= now();
  end if;

  return new;
end;
$$;

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
  -- Reveal and first-kickoff gates use the earliest known time across canonical
  -- games, league slate compatibility rows, and placed legs. This keeps global
  -- schedule propagation intact without letting a future canonical row mask a
  -- local row/leg that has already been marked started.
  select min(source_time)
  into reveal_time
  from (
    select slate.commence_time as source_time
    from public.league_week_slate_games slate
    where slate.league_id = p_league_id
      and slate.week_number = p_week_number

    union all

    select game.commence_time
    from public.league_week_slate_games slate
    join public.games game on game.game_id = slate.game_id
    where slate.league_id = p_league_id
      and slate.week_number = p_week_number

    union all

    select bl.game_start_time
    from public.bets b
    join public.bet_legs bl on bl.bet_id = b.id
    where b.league_id = p_league_id
      and b.week_number = p_week_number

    union all

    select game.commence_time
    from public.bets b
    join public.bet_legs bl on bl.bet_id = b.id
    join public.games game on game.game_id = bl.game_id
    where b.league_id = p_league_id
      and b.week_number = p_week_number
  ) kickoff_sources
  where source_time is not null;

  return reveal_time;
end;
$$;

revoke execute on function public.league_week_reveal_time(uuid, integer) from anon;
grant execute on function public.league_week_reveal_time(uuid, integer) to authenticated;
