create table if not exists public.global_sport_weeks (
  sport public.league_sport not null,
  season_year integer not null,
  current_week integer not null check (current_week between 1 and 17),
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (sport, season_year)
);

alter table public.global_sport_weeks enable row level security;

drop policy if exists "Authenticated users can read global sport weeks" on public.global_sport_weeks;
create policy "Authenticated users can read global sport weeks"
on public.global_sport_weeks for select
to authenticated
using (true);

drop policy if exists "Service role can manage global sport weeks" on public.global_sport_weeks;
create policy "Service role can manage global sport weeks"
on public.global_sport_weeks for all
to service_role
using (true)
with check (true);

insert into public.global_sport_weeks (
  sport,
  season_year,
  current_week,
  updated_by
)
select
  league.sport,
  league.season_year,
  max(league.current_week),
  'seeded from existing active leagues'
from public.leagues league
where league.sport = 'nfl'
  and league.status = 'active'
  and lower(coalesce(league.settings ->> 'global_week_exempt', 'false')) <> 'true'
group by league.sport, league.season_year
on conflict (sport, season_year) do nothing;

create or replace function public.guard_active_nfl_global_week()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  synced_week integer;
  global_sync_enabled boolean := current_setting('action_arena.global_week_sync', true) = 'on';
begin
  if new.sport <> 'nfl'
    or new.status <> 'active'
    or lower(coalesce(new.settings ->> 'global_week_exempt', 'false')) = 'true'
  then
    return new;
  end if;

  select current_week
  into synced_week
  from public.global_sport_weeks
  where sport = new.sport
    and season_year = new.season_year;

  if synced_week is null then
    insert into public.global_sport_weeks (
      sport,
      season_year,
      current_week,
      updated_by
    )
    values (
      new.sport,
      new.season_year,
      new.current_week,
      'seeded by active league trigger'
    )
    on conflict (sport, season_year) do update
      set current_week = public.global_sport_weeks.current_week
    returning current_week into synced_week;
  end if;

  if tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.sport is distinct from new.sport
    or old.season_year is distinct from new.season_year
  then
    if not global_sync_enabled then
      new.current_week := synced_week;
    end if;

    return new;
  end if;

  if new.current_week is distinct from old.current_week and not global_sync_enabled then
    raise exception
      'Active NFL leagues use one global current week. Use public.set_global_sport_week() or the week simulation tools instead of updating one league.';
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
create trigger leagues_guard_active_nfl_global_week
before insert or update of sport, season_year, status, current_week on public.leagues
for each row execute function public.guard_active_nfl_global_week();

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
  active_count integer := 0;
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
      and status = 'active'
      and lower(coalesce(settings ->> 'global_week_exempt', 'false')) <> 'true'
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
  into active_count, changed_count, report;

  perform set_config('action_arena.global_week_sync', coalesce(previous_sync_setting, ''), true);

  return jsonb_build_object(
    'sport', p_sport,
    'season_year', p_season_year,
    'target_week', p_target_week,
    'active_leagues', active_count,
    'changed_leagues', changed_count,
    'leagues', report
  );
end;
$$;

revoke execute on function public.set_global_sport_week(public.league_sport, integer, integer, text) from anon, authenticated;
grant execute on function public.set_global_sport_week(public.league_sport, integer, integer, text) to service_role;

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

  select coalesce(
    p_season_year,
    (select season_year from public.global_sport_weeks where sport = 'nfl' order by updated_at desc limit 1),
    (select max(season_year) from public.leagues where sport = 'nfl' and status = 'active'),
    extract(year from now())::integer
  )
  into resolved_season_year;

  for league_record in
    select
      id,
      name,
      current_week,
      name = any(p_excluded_league_names) as excluded_from_sync
    from public.leagues
    where sport = 'nfl'
      and season_year = resolved_season_year
      and status = 'active'
    order by name
  loop
    previous_week := league_record.current_week;

    if league_record.excluded_from_sync then
      if not p_dry_run then
        update public.leagues
        set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('global_week_exempt', true)
        where id = league_record.id;
      end if;

      report := report || jsonb_build_array(
        jsonb_build_object(
          'league_id', league_record.id,
          'name', league_record.name,
          'previous_week', previous_week,
          'target_week', p_target_week,
          'excluded', true,
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
        'excluded', false,
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
      'align_active_nfl_leagues_to_week'
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

revoke execute on function public.align_active_nfl_leagues_to_week(integer, integer, boolean, boolean, text[]) from anon, authenticated;
grant execute on function public.align_active_nfl_leagues_to_week(integer, integer, boolean, boolean, text[]) to service_role;

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
      and status = 'active'
      and lower(coalesce(settings ->> 'global_week_exempt', 'false')) <> 'true'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.leagues
    where sport = 'nfl'
      and season_year = p_season_year
      and status = 'active'
      and lower(coalesce(settings ->> 'global_week_exempt', 'false')) <> 'true'
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
      and league.status = 'active'
      and lower(coalesce(league.settings ->> 'global_week_exempt', 'false')) <> 'true'
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

revoke execute on function public.advance_global_nfl_week_if_ready(integer, integer) from anon, authenticated;
grant execute on function public.advance_global_nfl_week_if_ready(integer, integer) to service_role;

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
  with active_leagues as (
    select id, season_year
    from public.leagues
    where sport = 'nfl'
      and status = 'active'
      and season_year = p_season_year
      and lower(coalesce(settings ->> 'global_week_exempt', 'false')) <> 'true'
  ),
  slate_targets as (
    select
      slate.game_id,
      coalesce(game.away_team, slate.away_team, 'Away Team') as away_team,
      coalesce(game.home_team, slate.home_team, 'Home Team') as home_team,
      coalesce(game.commence_time, slate.commence_time, now()) as commence_time
    from public.league_week_slate_games slate
    join active_leagues league on league.id = slate.league_id
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
    join active_leagues league on league.id = bet.league_id
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

revoke execute on function public.global_week_game_targets(integer, integer) from anon, authenticated;
grant execute on function public.global_week_game_targets(integer, integer) to service_role;

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
    (select max(season_year) from public.leagues where sport = 'nfl' and status = 'active'),
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
    raise exception 'No active NFL games or picks found for season %, week %', resolved_season_year, p_week_number;
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
    and league.status = 'active'
    and lower(coalesce(league.settings ->> 'global_week_exempt', 'false')) <> 'true'
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
    and league.status = 'active'
    and lower(coalesce(league.settings ->> 'global_week_exempt', 'false')) <> 'true'
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

revoke execute on function public.simulate_global_week_kickoff(integer, integer) from anon, authenticated;
grant execute on function public.simulate_global_week_kickoff(integer, integer) to service_role;

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
    (select max(season_year) from public.leagues where sport = 'nfl' and status = 'active'),
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
    raise exception 'No active NFL games or picks found for season %, week %', resolved_season_year, p_week_number;
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
    and league.status = 'active'
    and lower(coalesce(league.settings ->> 'global_week_exempt', 'false')) <> 'true'
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

revoke execute on function public.simulate_global_week_completion(integer, jsonb, integer) from anon, authenticated;
grant execute on function public.simulate_global_week_completion(integer, jsonb, integer) to service_role;

create or replace function public.resolve_league_week(
  p_league_id uuid,
  p_week_number integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league public.leagues;
  matchup_record public.weekly_matchups;
  home_weekly_profit numeric(10,2);
  away_weekly_profit numeric(10,2);
begin
  select * into target_league from public.leagues where id = p_league_id;

  if target_league.id is null then
    raise exception 'League not found';
  end if;

  if exists (
    select 1
    from public.bets
    where league_id = p_league_id
      and week_number = p_week_number
      and result = 'pending'
  ) then
    return;
  end if;

  create temporary table if not exists weekly_profit_totals (
    user_id uuid primary key,
    weekly_profit numeric(10,2) not null
  ) on commit drop;

  truncate table weekly_profit_totals;

  insert into weekly_profit_totals (user_id, weekly_profit)
  select
    lm.user_id,
    round(coalesce(sum(b.profit), 0), 2) as weekly_profit
  from public.league_members lm
  left join public.bets b
    on b.league_id = lm.league_id
    and b.user_id = lm.user_id
    and b.week_number = p_week_number
    and b.result <> 'pending'
  where lm.league_id = p_league_id
  group by lm.user_id;

  if target_league.type = 'h2h' then
    for matchup_record in
      select *
      from public.weekly_matchups
      where league_id = p_league_id
        and week_number = p_week_number
    loop
      select weekly_profit
      into home_weekly_profit
      from weekly_profit_totals
      where user_id = matchup_record.home_user_id;

      if matchup_record.away_user_id is null then
        update public.weekly_matchups
        set home_profit = coalesce(home_weekly_profit, 0),
            away_profit = null,
            winner_id = matchup_record.home_user_id
        where id = matchup_record.id;
      else
        select weekly_profit
        into away_weekly_profit
        from weekly_profit_totals
        where user_id = matchup_record.away_user_id;

        update public.weekly_matchups
        set home_profit = coalesce(home_weekly_profit, 0),
            away_profit = coalesce(away_weekly_profit, 0),
            winner_id = case
              when coalesce(home_weekly_profit, 0) > coalesce(away_weekly_profit, 0) then matchup_record.home_user_id
              when coalesce(away_weekly_profit, 0) > coalesce(home_weekly_profit, 0) then matchup_record.away_user_id
              else null
            end
        where id = matchup_record.id;
      end if;
    end loop;
  end if;

  create temporary table if not exists standing_values (
    user_id uuid primary key,
    wins integer not null,
    losses integer not null,
    ties integer not null,
    weekly_profit numeric(10,2) not null,
    total_profit numeric(10,2) not null
  ) on commit drop;

  truncate table standing_values;

  insert into standing_values (
    user_id,
    wins,
    losses,
    ties,
    weekly_profit,
    total_profit
  )
  select
    lm.user_id,
    case
      when target_league.type = 'h2h' then (
        select count(*)::integer
        from public.weekly_matchups wm
        where wm.league_id = p_league_id
          and wm.week_number <= p_week_number
          and wm.winner_id = lm.user_id
      )
      else 0
    end as wins,
    case
      when target_league.type = 'h2h' then (
        select count(*)::integer
        from public.weekly_matchups wm
        where wm.league_id = p_league_id
          and wm.week_number <= p_week_number
          and wm.away_user_id is not null
          and wm.winner_id is not null
          and wm.winner_id <> lm.user_id
          and (wm.home_user_id = lm.user_id or wm.away_user_id = lm.user_id)
      )
      else 0
    end as losses,
    case
      when target_league.type = 'h2h' then (
        select count(*)::integer
        from public.weekly_matchups wm
        where wm.league_id = p_league_id
          and wm.week_number <= p_week_number
          and wm.away_user_id is not null
          and wm.winner_id is null
          and wm.home_profit is not null
          and wm.away_profit is not null
          and (wm.home_user_id = lm.user_id or wm.away_user_id = lm.user_id)
      )
      else 0
    end as ties,
    coalesce(wpt.weekly_profit, 0) as weekly_profit,
    (
      select round(coalesce(sum(b.profit), 0), 2)
      from public.bets b
      where b.league_id = p_league_id
        and b.user_id = lm.user_id
        and b.week_number <= p_week_number
        and b.result <> 'pending'
    ) as total_profit
  from public.league_members lm
  left join weekly_profit_totals wpt on wpt.user_id = lm.user_id
  where lm.league_id = p_league_id;

  with ranked as (
    select
      sv.*,
      (rank() over (
        order by
          case when target_league.type = 'h2h' then sv.wins else 0 end desc,
          case when target_league.type = 'h2h' then sv.ties else 0 end desc,
          case when target_league.type = 'h2h' then sv.losses else 0 end asc,
          sv.total_profit desc,
          sv.weekly_profit desc,
          sv.user_id
      ))::integer as computed_rank
    from standing_values sv
  )
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
    p_league_id,
    ranked.user_id,
    p_week_number,
    ranked.wins,
    ranked.losses,
    ranked.ties,
    ranked.weekly_profit,
    ranked.total_profit,
    ranked.computed_rank
  from ranked
  on conflict (league_id, user_id, week_number) do update
    set wins = excluded.wins,
        losses = excluded.losses,
        ties = excluded.ties,
        weekly_profit = excluded.weekly_profit,
        total_profit = excluded.total_profit,
        rank = excluded.rank;

  if target_league.type = 'h2h' and p_week_number = 14 then
    update public.leagues
    set status = 'playoffs',
        current_week = greatest(current_week, 15)
    where id = p_league_id;

    perform public.generate_playoff_schedule(p_league_id, 15);
  elsif target_league.type = 'h2h' and p_week_number between 15 and 17 then
    if exists (
      select 1
      from public.weekly_matchups
      where league_id = p_league_id
        and week_number = p_week_number
        and is_championship = true
    ) or p_week_number = 17 then
      update public.leagues
      set status = 'complete',
          current_week = p_week_number
      where id = p_league_id;
    else
      update public.leagues
      set status = 'playoffs',
          current_week = greatest(current_week, p_week_number + 1)
      where id = p_league_id;

      perform public.generate_playoff_schedule(p_league_id, p_week_number + 1);
    end if;
  elsif p_week_number >= 17 then
    update public.leagues
    set status = 'complete',
        current_week = 17
    where id = p_league_id;
  elsif target_league.sport = 'nfl' and target_league.status = 'active' then
    perform public.advance_global_nfl_week_if_ready(target_league.season_year, p_week_number);
  else
    update public.leagues
    set current_week = greatest(current_week, p_week_number + 1)
    where id = p_league_id;
  end if;
end;
$$;
