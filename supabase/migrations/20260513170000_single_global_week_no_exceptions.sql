create or replace function public.is_global_week_exempt_fixture(
  p_name text,
  p_settings jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(coalesce(p_settings ->> 'global_week_exempt', 'false')) = 'true'
    and lower(coalesce(p_settings ->> 'global_week_test_fixture', 'false')) = 'true';
$$;

update public.leagues
set settings = coalesce(settings, '{}'::jsonb)
  || jsonb_build_object(
    'global_week_exempt',
    true,
    'global_week_test_fixture',
    true
  )
where sport = 'nfl'
  and name = 'App Review Demo League';

update public.leagues
set settings = (coalesce(settings, '{}'::jsonb) - 'global_week_exempt') - 'global_week_test_fixture'
where sport = 'nfl'
  and name <> 'App Review Demo League'
  and (
    lower(coalesce(settings ->> 'global_week_exempt', 'false')) = 'true'
    or lower(coalesce(settings ->> 'global_week_test_fixture', 'false')) = 'true'
  );

create or replace function public.guard_nfl_global_week()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_week integer;
  seeded_week integer;
  global_sync_enabled boolean := coalesce(current_setting('action_arena.global_week_sync', true), '') = 'on';
begin
  if new.sport <> 'nfl'
    or public.is_global_week_exempt_fixture(new.name, new.settings)
  then
    return new;
  end if;

  select current_week
  into synced_week
  from public.global_sport_weeks
  where sport = new.sport
    and season_year = new.season_year;

  if synced_week is null then
    select max(league.current_week)
    into seeded_week
    from public.leagues league
    where league.sport = new.sport
      and league.season_year = new.season_year
      and not public.is_global_week_exempt_fixture(league.name, league.settings);

    insert into public.global_sport_weeks (
      sport,
      season_year,
      current_week,
      updated_by
    )
    values (
      new.sport,
      new.season_year,
      coalesce(seeded_week, new.current_week),
      'seeded by league global week trigger'
    )
    on conflict (sport, season_year) do update
      set current_week = public.global_sport_weeks.current_week
    returning current_week into synced_week;
  end if;

  if tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.sport is distinct from new.sport
    or old.season_year is distinct from new.season_year
    or old.settings is distinct from new.settings
  then
    if not global_sync_enabled then
      new.current_week := synced_week;
    end if;

    return new;
  end if;

  if new.current_week is distinct from old.current_week and not global_sync_enabled then
    raise exception
      'NFL leagues use one global current week. Use public.set_global_sport_week() or the week simulation tools instead of updating one league.';
  end if;

  if global_sync_enabled and new.current_week is distinct from synced_week then
    raise exception
      'Global week sync attempted to set league % to week %, but synced NFL week is %',
      new.id,
      new.current_week,
      synced_week;
  end if;

  return new;
end;
$$;

drop trigger if exists leagues_guard_active_nfl_global_week on public.leagues;
drop trigger if exists leagues_guard_nfl_global_week on public.leagues;
create trigger leagues_guard_nfl_global_week
before insert or update of sport, season_year, status, current_week, settings on public.leagues
for each row execute function public.guard_nfl_global_week();

create or replace function public.set_global_sport_week(
  p_sport public.league_sport,
  p_season_year integer,
  p_target_week integer,
  p_updated_by text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_sync_setting text := current_setting('action_arena.global_week_sync', true);
  league_count integer := 0;
  changed_count integer := 0;
  report jsonb := '[]'::jsonb;
begin
  if p_target_week not between 1 and 17 then
    raise exception 'Target week must be between 1 and 17';
  end if;

  perform set_config('action_arena.global_week_sync', 'on', true);

  insert into public.global_sport_weeks (
    sport,
    season_year,
    current_week,
    updated_at,
    updated_by
  )
  values (
    p_sport,
    p_season_year,
    p_target_week,
    now(),
    coalesce(p_updated_by, 'set_global_sport_week')
  )
  on conflict (sport, season_year) do update
    set current_week = excluded.current_week,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;

  with target_leagues as (
    select
      id,
      name,
      current_week as previous_week
    from public.leagues
    where sport = p_sport
      and season_year = p_season_year
      and not public.is_global_week_exempt_fixture(name, settings)
  ),
  updated as (
    update public.leagues league
    set current_week = p_target_week
    from target_leagues target
    where league.id = target.id
      and league.current_week is distinct from p_target_week
    returning
      league.id,
      league.name,
      target.previous_week,
      league.current_week as current_week
  )
  select
    (select count(*) from target_leagues),
    (select count(*) from updated),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'league_id', target.id,
            'name', target.name,
            'previous_week', target.previous_week,
            'current_week', p_target_week,
            'changed', target.previous_week is distinct from p_target_week
          )
          order by target.name
        )
        from target_leagues target
      ),
      '[]'::jsonb
    )
  into league_count, changed_count, report;

  perform set_config('action_arena.global_week_sync', coalesce(previous_sync_setting, ''), true);

  return jsonb_build_object(
    'sport', p_sport,
    'season_year', p_season_year,
    'target_week', p_target_week,
    'leagues_synced', league_count,
    'active_leagues', league_count,
    'changed_leagues', changed_count,
    'leagues', report
  );
end;
$$;

create or replace function public.align_active_nfl_leagues_to_week(
  p_target_week integer,
  p_season_year integer default null,
  p_dry_run boolean default false,
  p_prune_future_artifacts boolean default true,
  p_excluded_league_names text[] default array[]::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_season_year integer;
  league_record record;
  previous_week integer;
  future_bets_count integer;
  future_standings_count integer;
  future_matchups_count integer;
  future_slate_count integer;
  future_notifications_count integer;
  future_chat_count integer;
  report jsonb := '[]'::jsonb;
  sync_report jsonb := null;
begin
  if p_target_week not between 1 and 17 then
    raise exception 'Target week must be between 1 and 17';
  end if;

  if coalesce(array_length(p_excluded_league_names, 1), 0) > 0 then
    raise exception 'Ad hoc global week exclusions are not supported. Mark a league as an explicit test fixture instead.';
  end if;

  select coalesce(
    p_season_year,
    (select season_year from public.global_sport_weeks where sport = 'nfl' order by updated_at desc limit 1),
    (select max(season_year) from public.leagues where sport = 'nfl'),
    extract(year from now())::integer
  )
  into resolved_season_year;

  for league_record in
    select
      id,
      name,
      current_week,
      public.is_global_week_exempt_fixture(name, settings) as fixture_exempt
    from public.leagues
    where sport = 'nfl'
      and season_year = resolved_season_year
    order by name
  loop
    previous_week := league_record.current_week;

    if league_record.fixture_exempt then
      report := report || jsonb_build_array(
        jsonb_build_object(
          'league_id', league_record.id,
          'name', league_record.name,
          'previous_week', previous_week,
          'target_week', p_target_week,
          'fixture_exempt', true,
          'changed', false,
          'future_bets', 0,
          'future_standings', 0,
          'future_matchups', 0,
          'future_slate_games', 0,
          'future_notifications', 0,
          'future_system_chat_messages', 0
        )
      );

      continue;
    end if;

    select count(*)
    into future_bets_count
    from public.bets
    where league_id = league_record.id
      and week_number > p_target_week;

    select count(*)
    into future_standings_count
    from public.standings
    where league_id = league_record.id
      and week_number > p_target_week;

    select count(*)
    into future_matchups_count
    from public.weekly_matchups
    where league_id = league_record.id
      and week_number > p_target_week;

    select count(*)
    into future_slate_count
    from public.league_week_slate_games
    where league_id = league_record.id
      and week_number > p_target_week;

    select count(*)
    into future_notifications_count
    from public.notification_events
    where league_id = league_record.id
      and (data ->> 'weekNumber') ~ '^[0-9]+$'
      and (data ->> 'weekNumber')::integer > p_target_week;

    select count(*)
    into future_chat_count
    from public.league_chat_messages
    where league_id = league_record.id
      and message_type = 'system'
      and (metadata ->> 'weekNumber') ~ '^[0-9]+$'
      and (metadata ->> 'weekNumber')::integer > p_target_week;

    if not p_dry_run and previous_week > p_target_week then
      delete from public.notification_events
      where league_id = league_record.id
        and (data ->> 'weekNumber') ~ '^[0-9]+$'
        and (data ->> 'weekNumber')::integer > p_target_week;

      delete from public.league_chat_messages
      where league_id = league_record.id
        and message_type = 'system'
        and (metadata ->> 'weekNumber') ~ '^[0-9]+$'
        and (metadata ->> 'weekNumber')::integer > p_target_week;

      delete from public.bets
      where league_id = league_record.id
        and week_number > p_target_week;

      delete from public.standings
      where league_id = league_record.id
        and week_number > p_target_week;

      if p_prune_future_artifacts then
        delete from public.weekly_matchups
        where league_id = league_record.id
          and week_number > p_target_week;

        delete from public.league_week_slate_games
        where league_id = league_record.id
          and week_number > p_target_week;
      end if;
    end if;

    report := report || jsonb_build_array(
      jsonb_build_object(
        'league_id', league_record.id,
        'name', league_record.name,
        'previous_week', previous_week,
        'target_week', p_target_week,
        'fixture_exempt', false,
        'would_move_back', previous_week > p_target_week,
        'would_move_forward', previous_week < p_target_week,
        'future_bets', future_bets_count,
        'future_standings', future_standings_count,
        'future_matchups', future_matchups_count,
        'future_slate_games', future_slate_count,
        'future_notifications', future_notifications_count,
        'future_system_chat_messages', future_chat_count,
        'future_matchups_pruned', p_prune_future_artifacts and previous_week > p_target_week and not p_dry_run,
        'changed', previous_week is distinct from p_target_week and not p_dry_run
      )
    );
  end loop;

  if not p_dry_run then
    sync_report := public.set_global_sport_week(
      'nfl'::public.league_sport,
      resolved_season_year,
      p_target_week,
      'align_nfl_leagues_to_week'
    );
  end if;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'season_year', resolved_season_year,
    'target_week', p_target_week,
    'prune_future_artifacts', p_prune_future_artifacts,
    'sync', sync_report,
    'leagues', report
  );
end;
$$;

create or replace function public.align_nfl_leagues_to_week(
  p_target_week integer,
  p_season_year integer default null,
  p_dry_run boolean default false,
  p_prune_future_artifacts boolean default true
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.align_active_nfl_leagues_to_week(
    p_target_week,
    p_season_year,
    p_dry_run,
    p_prune_future_artifacts,
    array[]::text[]
  );
$$;

revoke execute on function public.align_nfl_leagues_to_week(integer, integer, boolean, boolean) from anon, authenticated;
grant execute on function public.align_nfl_leagues_to_week(integer, integer, boolean, boolean) to service_role;

create or replace function public.advance_global_nfl_week_if_ready(
  p_season_year integer,
  p_completed_week integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_week integer;
begin
  if p_completed_week not between 1 and 16 then
    return false;
  end if;

  select current_week
  into synced_week
  from public.global_sport_weeks
  where sport = 'nfl'
    and season_year = p_season_year;

  if synced_week is distinct from p_completed_week then
    return false;
  end if;

  if not exists (
    select 1
    from public.leagues
    where sport = 'nfl'
      and season_year = p_season_year
      and not public.is_global_week_exempt_fixture(name, settings)
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.leagues
    where sport = 'nfl'
      and season_year = p_season_year
      and not public.is_global_week_exempt_fixture(name, settings)
      and current_week is distinct from p_completed_week
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.bets bet
    join public.leagues league on league.id = bet.league_id
    where league.sport = 'nfl'
      and league.season_year = p_season_year
      and not public.is_global_week_exempt_fixture(league.name, league.settings)
      and bet.week_number = p_completed_week
      and bet.result = 'pending'
  ) then
    return false;
  end if;

  perform public.set_global_sport_week(
    'nfl'::public.league_sport,
    p_season_year,
    p_completed_week + 1,
    'advance_global_nfl_week_if_ready'
  );

  return true;
end;
$$;

create or replace function public.global_week_game_targets(
  p_week_number integer,
  p_season_year integer
)
returns table (
  game_id text,
  away_team text,
  home_team text,
  commence_time timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with league_targets as (
    select id, season_year
    from public.leagues
    where sport = 'nfl'
      and season_year = p_season_year
      and not public.is_global_week_exempt_fixture(name, settings)
  ),
  slate_targets as (
    select
      slate.game_id,
      coalesce(game.away_team, slate.away_team, 'Away Team') as away_team,
      coalesce(game.home_team, slate.home_team, 'Home Team') as home_team,
      coalesce(game.commence_time, slate.commence_time, now()) as commence_time
    from public.league_week_slate_games slate
    join league_targets league on league.id = slate.league_id
    left join public.games game on game.game_id = slate.game_id
    where slate.week_number = p_week_number
  ),
  bet_targets as (
    select
      leg.game_id,
      coalesce(game.away_team, slate.away_team, 'Away Team') as away_team,
      coalesce(game.home_team, slate.home_team, 'Home Team') as home_team,
      coalesce(game.commence_time, slate.commence_time, leg.game_start_time, now()) as commence_time
    from public.bets bet
    join league_targets league on league.id = bet.league_id
    join public.bet_legs leg on leg.bet_id = bet.id
    left join public.games game on game.game_id = leg.game_id
    left join public.league_week_slate_games slate
      on slate.league_id = bet.league_id
      and slate.week_number = bet.week_number
      and slate.game_id = leg.game_id
    where bet.week_number = p_week_number
  )
  select distinct on (target.game_id)
    target.game_id,
    target.away_team,
    target.home_team,
    target.commence_time
  from (
    select * from slate_targets
    union all
    select * from bet_targets
  ) target
  where coalesce(target.game_id, '') <> ''
  order by target.game_id, target.commence_time;
$$;

create or replace function public.simulate_global_week_kickoff(
  p_week_number integer,
  p_season_year integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_season_year integer;
  target_game_count integer;
  live_state_count integer;
  locked_leg_count integer;
  slate_count integer;
begin
  if p_week_number not between 1 and 17 then
    raise exception 'Week number must be between 1 and 17';
  end if;

  select coalesce(
    p_season_year,
    (select season_year from public.global_sport_weeks where sport = 'nfl' order by updated_at desc limit 1),
    (select max(season_year) from public.leagues where sport = 'nfl'),
    extract(year from now())::integer
  )
  into resolved_season_year;

  create temporary table if not exists global_week_target_games (
    game_id text primary key,
    away_team text not null,
    home_team text not null,
    commence_time timestamptz not null
  ) on commit drop;

  truncate table global_week_target_games;

  insert into global_week_target_games (
    game_id,
    away_team,
    home_team,
    commence_time
  )
  select
    target.game_id,
    target.away_team,
    target.home_team,
    target.commence_time
  from public.global_week_game_targets(p_week_number, resolved_season_year) target;

  select count(*) into target_game_count from global_week_target_games;

  if target_game_count = 0 then
    raise exception 'No NFL games or picks found for season %, week %', resolved_season_year, p_week_number;
  end if;

  perform public.upsert_game(
    target.game_id,
    'nfl'::public.league_sport,
    resolved_season_year,
    p_week_number,
    now() - interval '1 minute',
    target.away_team,
    target.home_team
  )
  from global_week_target_games target;

  insert into public.live_game_states (
    game_id,
    sport_key,
    away_team,
    home_team,
    away_score,
    home_score,
    current_period,
    time_remaining,
    status,
    last_updated
  )
  select
    target.game_id,
    'americanfootball_nfl',
    target.away_team,
    target.home_team,
    0,
    0,
    '1',
    '15:00',
    'in_progress',
    now()
  from global_week_target_games target
  on conflict (game_id) do update
    set sport_key = excluded.sport_key,
        away_team = excluded.away_team,
        home_team = excluded.home_team,
        away_score = excluded.away_score,
        home_score = excluded.home_score,
        current_period = excluded.current_period,
        time_remaining = excluded.time_remaining,
        status = excluded.status,
        last_updated = excluded.last_updated;

  get diagnostics live_state_count = row_count;

  select count(*)
  into slate_count
  from public.league_week_slate_games slate
  join public.leagues league on league.id = slate.league_id
  where league.sport = 'nfl'
    and league.season_year = resolved_season_year
    and not public.is_global_week_exempt_fixture(league.name, league.settings)
    and slate.week_number = p_week_number
    and slate.game_id in (select game_id from global_week_target_games)
    and slate.commence_time <= now();

  select count(*)
  into locked_leg_count
  from public.bet_legs leg
  join public.bets bet on bet.id = leg.bet_id
  join public.leagues league on league.id = bet.league_id
  where league.sport = 'nfl'
    and league.season_year = resolved_season_year
    and not public.is_global_week_exempt_fixture(league.name, league.settings)
    and bet.week_number = p_week_number
    and leg.game_id in (select game_id from global_week_target_games)
    and leg.locked
    and leg.game_start_time <= now();

  return jsonb_build_object(
    'season_year', resolved_season_year,
    'week_number', p_week_number,
    'games', target_game_count,
    'live_states_upserted', live_state_count,
    'slate_rows_live', slate_count,
    'locked_legs', locked_leg_count
  );
end;
$$;

create or replace function public.simulate_global_week_completion(
  p_week_number integer,
  p_scores jsonb,
  p_season_year integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_season_year integer;
  target_game record;
  score_item jsonb;
  score_entry jsonb;
  home_score_text text;
  away_score_text text;
  target_game_count integer;
  pending_bet_count integer;
  live_state_count integer;
  settlement_payload jsonb;
  settlement_result jsonb;
  week_sync_result jsonb;
begin
  if p_week_number not between 1 and 17 then
    raise exception 'Week number must be between 1 and 17';
  end if;

  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Scores payload must be a JSON array';
  end if;

  select coalesce(
    p_season_year,
    (select season_year from public.global_sport_weeks where sport = 'nfl' order by updated_at desc limit 1),
    (select max(season_year) from public.leagues where sport = 'nfl'),
    extract(year from now())::integer
  )
  into resolved_season_year;

  create temporary table if not exists global_week_target_games (
    game_id text primary key,
    away_team text not null,
    home_team text not null,
    commence_time timestamptz not null
  ) on commit drop;

  create temporary table if not exists global_week_completion_scores (
    game_id text primary key,
    away_team text not null,
    home_team text not null,
    away_score integer not null,
    home_score integer not null
  ) on commit drop;

  truncate table global_week_target_games;
  truncate table global_week_completion_scores;

  insert into global_week_target_games (
    game_id,
    away_team,
    home_team,
    commence_time
  )
  select
    target.game_id,
    target.away_team,
    target.home_team,
    target.commence_time
  from public.global_week_game_targets(p_week_number, resolved_season_year) target;

  select count(*) into target_game_count from global_week_target_games;

  if target_game_count = 0 then
    raise exception 'No NFL games or picks found for season %, week %', resolved_season_year, p_week_number;
  end if;

  for target_game in
    select * from global_week_target_games
  loop
    select value
    into score_item
    from jsonb_array_elements(p_scores) score(value)
    where coalesce(score.value ->> 'id', score.value ->> 'game_id') = target_game.game_id
    limit 1;

    if score_item is null then
      raise exception 'Missing mock score for game %', target_game.game_id;
    end if;

    home_score_text := coalesce(score_item ->> 'home_score', score_item ->> 'homeScore');
    away_score_text := coalesce(score_item ->> 'away_score', score_item ->> 'awayScore');

    if (home_score_text is null or away_score_text is null)
      and jsonb_typeof(score_item -> 'scores') = 'array'
    then
      for score_entry in select value from jsonb_array_elements(score_item -> 'scores')
      loop
        if score_entry ->> 'name' = target_game.home_team then
          home_score_text := score_entry ->> 'score';
        elsif score_entry ->> 'name' = target_game.away_team then
          away_score_text := score_entry ->> 'score';
        end if;
      end loop;
    end if;

    if coalesce(home_score_text, '') !~ '^[0-9]+$'
      or coalesce(away_score_text, '') !~ '^[0-9]+$'
    then
      raise exception 'Invalid mock score for game %. Provide home_score and away_score integers.', target_game.game_id;
    end if;

    insert into global_week_completion_scores (
      game_id,
      away_team,
      home_team,
      away_score,
      home_score
    )
    values (
      target_game.game_id,
      target_game.away_team,
      target_game.home_team,
      away_score_text::integer,
      home_score_text::integer
    );

    score_item := null;
  end loop;

  select jsonb_agg(
    jsonb_build_object(
      'id', game_id,
      'completed', true,
      'home_team', home_team,
      'away_team', away_team,
      'scores', jsonb_build_array(
        jsonb_build_object('name', home_team, 'score', home_score::text),
        jsonb_build_object('name', away_team, 'score', away_score::text)
      ),
      'sport_key', 'americanfootball_nfl',
      'sport_title', 'NFL',
      'status', 'final',
      'current_period', 'final',
      'commence_time', now(),
      'last_update', now()
    )
    order by game_id
  )
  into settlement_payload
  from global_week_completion_scores;

  live_state_count := public.upsert_live_game_states(settlement_payload);
  settlement_result := public.settle_completed_scores(settlement_payload);

  select count(*)
  into pending_bet_count
  from public.bets bet
  join public.leagues league on league.id = bet.league_id
  where league.sport = 'nfl'
    and league.season_year = resolved_season_year
    and not public.is_global_week_exempt_fixture(league.name, league.settings)
    and bet.week_number = p_week_number
    and bet.result = 'pending';

  if pending_bet_count > 0 then
    raise exception 'Global week completion left % pending week % bets', pending_bet_count, p_week_number;
  end if;

  week_sync_result := public.set_global_sport_week(
    'nfl'::public.league_sport,
    resolved_season_year,
    least(p_week_number + 1, 17),
    'simulate_global_week_completion'
  );

  return jsonb_build_object(
    'season_year', resolved_season_year,
    'week_number', p_week_number,
    'games_finalized', target_game_count,
    'live_states_upserted', live_state_count,
    'settlement', settlement_result,
    'pending_week_bets', pending_bet_count,
    'week_sync', week_sync_result
  );
end;
$$;

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
  new_current_week integer;
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
    season_year,
    status
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
    p_season_year,
    'active'::public.league_status
  )
  returning id, current_week into new_league_id, new_current_week;

  insert into public.league_members (league_id, user_id, team_name)
  values (new_league_id, auth.uid(), profile.display_name);

  insert into public.standings (league_id, user_id, week_number, rank)
  values (new_league_id, auth.uid(), new_current_week, 1);

  return new_league_id;
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
    raise exception 'Only the commissioner can generate this league schedule early';
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
    target_league.current_week,
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
  set status = 'active'
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

do $$
declare
  resolved_season_year integer;
  resolved_week integer;
begin
  select season_year, current_week
  into resolved_season_year, resolved_week
  from public.global_sport_weeks
  where sport = 'nfl'
  order by updated_at desc
  limit 1;

  if resolved_season_year is not null then
    perform public.set_global_sport_week(
      'nfl'::public.league_sport,
      resolved_season_year,
      resolved_week,
      'single_global_week_no_exceptions_migration'
    );

    update public.leagues
    set status = 'active'
    where sport = 'nfl'
      and season_year = resolved_season_year
      and status = 'drafting'
      and not public.is_global_week_exempt_fixture(name, settings);

    delete from public.standings standings
    using public.leagues league
    where standings.league_id = league.id
      and league.sport = 'nfl'
      and league.season_year = resolved_season_year
      and league.name in ('Public Test League', 'Test Cumulative League', 'Test H2H League')
      and not public.is_global_week_exempt_fixture(league.name, league.settings)
      and standings.week_number < resolved_week
      and not exists (
        select 1
        from public.bets bet
        where bet.league_id = league.id
          and bet.week_number = standings.week_number
      );

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
      resolved_week,
      0,
      0,
      0,
      0,
      0,
      (rank() over (partition by lm.league_id order by lm.joined_at, lm.user_id))::integer
    from public.league_members lm
    join public.leagues league on league.id = lm.league_id
    where league.sport = 'nfl'
      and league.season_year = resolved_season_year
      and league.name in ('Public Test League', 'Test Cumulative League', 'Test H2H League')
      and not public.is_global_week_exempt_fixture(league.name, league.settings)
    on conflict (league_id, user_id, week_number) do nothing;
  end if;
end;
$$;

revoke execute on function public.is_global_week_exempt_fixture(text, jsonb) from anon, authenticated;
grant execute on function public.is_global_week_exempt_fixture(text, jsonb) to service_role;
