-- Manual regression fixtures seed deterministic slate rows for simulator QA.
-- Do not let the automatic Bet Board odds sync append live/mock odds to those
-- fixture weeks, because the reveal gates intentionally depend on the exact
-- first kickoff seeded by the fixture.

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

  if lower(coalesce(target_league.settings ->> 'manual_regression_fixture', 'false')) = 'true' then
    return public.league_week_reveal_time(p_league_id, p_week_number);
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
