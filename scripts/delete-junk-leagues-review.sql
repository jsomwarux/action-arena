-- Delete test and fixture leagues from production without deleting accounts.
--
-- Default mode is review-only: the final statement is ROLLBACK, so this file
-- prints the planned league ids and row counts, exercises the full delete
-- transaction, and persists nothing. To apply after review, change only the
-- final ROLLBACK to COMMIT and run this exact file against the linked project.
--
-- Keep, never touch:
--   da74152d-2864-4a17-bbca-0a1acc492d55 / App Review Demo League
--   App Store Screenshot League, resolved by name at runtime
--
-- This deletes leagues only, plus league-scoped dependent rows. It never
-- deletes public.users or auth.users rows.

begin;

set constraints all deferred;

create temporary table cleanup_keep_leagues (
  keep_reason text not null,
  id uuid primary key,
  name text not null
) on commit drop;

insert into cleanup_keep_leagues (keep_reason, id, name)
select 'coherent App Review demo', id, name
from public.leagues
where id = 'da74152d-2864-4a17-bbca-0a1acc492d55'::uuid
  and name = 'App Review Demo League';

insert into cleanup_keep_leagues (keep_reason, id, name)
select 'multi-team leaderboard screenshot source', id, name
from public.leagues
where name = 'App Store Screenshot League';

create temporary table cleanup_target_names (
  name text primary key
) on commit drop;

insert into cleanup_target_names (name)
values
  ('Public Test League'),
  ('Test H2H League'),
  ('Test Cumulative League'),
  ('Full League Test'),
  ('Full League Test 2'),
  ('3 person league'),
  ('QA Manual Regression - Post Submit Editing'),
  ('QA Manual Regression - Visibility Before Kickoff'),
  ('QA Manual Regression - Visibility After Kickoff'),
  ('QA Manual Regression - Pick Board Actions'),
  ('QA Manual Regression - Championship Snapshot'),
  ('Lineup Builder League'),
  ('Sunday Card League'),
  ('Delete Regular 1779990563649'),
  ('Delete Commissioned 1779990563649'),
  ('Delete Regular 1779990749817'),
  ('Delete Commissioned 1779990749817');

do $$
declare
  missing_keep text[];
  duplicate_app_store_count integer;
  missing_targets text[];
  duplicate_targets text[];
begin
  select array_agg(expected.name order by expected.name)
  into missing_keep
  from (
    values
      ('App Review Demo League'),
      ('App Store Screenshot League')
  ) as expected(name)
  where not exists (
    select 1
    from cleanup_keep_leagues keep_league
    where keep_league.name = expected.name
  );

  if missing_keep is not null then
    raise exception 'Refusing to run: required KEEP league(s) not resolved: %', missing_keep;
  end if;

  select count(*)
  into duplicate_app_store_count
  from public.leagues
  where name = 'App Store Screenshot League';

  if duplicate_app_store_count <> 1 then
    raise exception 'Refusing to run: expected exactly one App Store Screenshot League, found %', duplicate_app_store_count;
  end if;

  select array_agg(target.name order by target.name)
  into missing_targets
  from cleanup_target_names target
  where not exists (
    select 1
    from public.leagues league
    where league.name = target.name
  );

  if missing_targets is not null then
    raise exception 'Refusing to run: target league name(s) not resolved: %', missing_targets;
  end if;

  select array_agg(duplicate.name order by duplicate.name)
  into duplicate_targets
  from (
    select league.name
    from public.leagues league
    join cleanup_target_names target on target.name = league.name
    group by league.name
    having count(*) <> 1
  ) duplicate;

  if duplicate_targets is not null then
    raise exception 'Refusing to run: target league name(s) resolved ambiguously: %', duplicate_targets;
  end if;
end;
$$;

create temporary table cleanup_target_leagues on commit drop as
select
  league.id,
  league.name,
  league.created_at
from public.leagues league
join cleanup_target_names target on target.name = league.name
where not exists (
  select 1
  from cleanup_keep_leagues keep_league
  where keep_league.id = league.id
)
order by league.name, league.created_at, league.id;

do $$
begin
  if exists (
    select 1
    from cleanup_target_leagues target
    join cleanup_keep_leagues keep_league on keep_league.id = target.id
  ) then
    raise exception 'Refusing to run: a KEEP league resolved as a delete target.';
  end if;

  if (select count(*) from cleanup_target_leagues) <> (select count(*) from cleanup_target_names) then
    raise exception 'Refusing to run: expected % target leagues, resolved %',
      (select count(*) from cleanup_target_names),
      (select count(*) from cleanup_target_leagues);
  end if;

  raise notice 'Review mode: this script ends with ROLLBACK. Change only the final ROLLBACK to COMMIT to apply.';
  raise notice 'Will delete % leagues and keep % leagues.',
    (select count(*) from cleanup_target_leagues),
    (select count(*) from cleanup_keep_leagues);
end;
$$;

create temporary table cleanup_target_bets on commit drop as
select id
from public.bets
where league_id in (select id from cleanup_target_leagues);

create temporary table cleanup_target_bet_legs on commit drop as
select leg.id
from public.bet_legs leg
join cleanup_target_bets bet on bet.id = leg.bet_id;

create temporary table cleanup_target_matchups on commit drop as
select id
from public.weekly_matchups
where league_id in (select id from cleanup_target_leagues);

create temporary table cleanup_target_members on commit drop as
select id
from public.league_members
where league_id in (select id from cleanup_target_leagues);

create temporary table cleanup_target_chat_messages on commit drop as
select id
from public.league_chat_messages
where league_id in (select id from cleanup_target_leagues);

create temporary table cleanup_target_game_ids on commit drop as
select distinct game_id
from (
  select slate.game_id
  from public.league_week_slate_games slate
  where slate.league_id in (select id from cleanup_target_leagues)

  union

  select leg.game_id
  from public.bet_legs leg
  join cleanup_target_bets bet on bet.id = leg.bet_id
) target_games
where game_id is not null;

create temporary table cleanup_orphanable_game_ids on commit drop as
select target_games.game_id
from cleanup_target_game_ids target_games
where not exists (
    select 1
    from public.league_week_slate_games slate
    where slate.game_id = target_games.game_id
      and slate.league_id not in (select id from cleanup_target_leagues)
  )
  and not exists (
    select 1
    from public.bet_legs leg
    join public.bets bet on bet.id = leg.bet_id
    where leg.game_id = target_games.game_id
      and bet.league_id not in (select id from cleanup_target_leagues)
  );

create temporary table cleanup_row_counts (
  table_name text primary key,
  rows_to_delete bigint not null
) on commit drop;

insert into cleanup_row_counts (table_name, rows_to_delete)
values
  (
    'public.notification_events',
    (
      select count(*)
      from public.notification_events event
      where event.league_id in (select id from cleanup_target_leagues)
         or event.bet_id in (select id from cleanup_target_bets)
         or event.matchup_id in (select id from cleanup_target_matchups)
         or event.data ->> 'leagueId' in (
           select id::text from cleanup_target_leagues
         )
    )
  ),
  (
    'public.content_reports',
    (
      select count(*)
      from public.content_reports report
      where report.league_id in (select id from cleanup_target_leagues)
         or (
           report.target_type = 'league'
           and report.target_id in (select id from cleanup_target_leagues)
         )
         or (
           report.target_type = 'league_member'
           and report.target_id in (select id from cleanup_target_members)
         )
         or (
           report.target_type = 'chat_message'
           and report.target_id in (select id from cleanup_target_chat_messages)
         )
    )
  ),
  (
    'public.league_chat_messages',
    (
      select count(*)
      from public.league_chat_messages
      where league_id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.user_achievements',
    (
      select count(*)
      from public.user_achievements
      where league_id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.seasons',
    (
      select count(*)
      from public.seasons
      where league_id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.standings',
    (
      select count(*)
      from public.standings
      where league_id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.weekly_matchups',
    (
      select count(*)
      from public.weekly_matchups
      where league_id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.bet_legs',
    (
      select count(*)
      from public.bet_legs
      where id in (select id from cleanup_target_bet_legs)
    )
  ),
  (
    'public.bets',
    (
      select count(*)
      from public.bets
      where id in (select id from cleanup_target_bets)
    )
  ),
  (
    'public.league_week_slate_games',
    (
      select count(*)
      from public.league_week_slate_games
      where league_id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.league_members',
    (
      select count(*)
      from public.league_members
      where league_id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.leagues',
    (
      select count(*)
      from public.leagues
      where id in (select id from cleanup_target_leagues)
    )
  ),
  (
    'public.live_game_states',
    (
      select count(*)
      from public.live_game_states
      where game_id in (select game_id from cleanup_orphanable_game_ids)
    )
  ),
  (
    'public.games',
    (
      select count(*)
      from public.games
      where game_id in (select game_id from cleanup_orphanable_game_ids)
    )
  );

select
  'delete_junk_leagues_keep' as report,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'reason', keep_reason
    )
    order by name
  ) as leagues
from cleanup_keep_leagues;

select
  'delete_junk_leagues_plan' as report,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'created_at', created_at
    )
    order by name, created_at, id
  ) as leagues_to_delete
from cleanup_target_leagues;

select
  'delete_junk_leagues_row_counts' as report,
  jsonb_object_agg(table_name, rows_to_delete order by table_name) as rows_to_delete
from cleanup_row_counts;

select
  'delete_junk_leagues_game_cleanup' as report,
  (select count(*) from cleanup_target_game_ids) as target_game_ids_seen,
  (select count(*) from cleanup_orphanable_game_ids) as orphaned_target_game_ids_to_delete,
  coalesce(
    (
      select jsonb_agg(game_id order by game_id)
      from cleanup_target_game_ids target_games
      where not exists (
        select 1
        from cleanup_orphanable_game_ids orphanable
        where orphanable.game_id = target_games.game_id
      )
    ),
    '[]'::jsonb
  ) as shared_target_game_ids_kept;

delete from public.notification_events event
where event.league_id in (select id from cleanup_target_leagues)
   or event.bet_id in (select id from cleanup_target_bets)
   or event.matchup_id in (select id from cleanup_target_matchups)
   or event.data ->> 'leagueId' in (
     select id::text from cleanup_target_leagues
   );

delete from public.content_reports report
where report.league_id in (select id from cleanup_target_leagues)
   or (
     report.target_type = 'league'
     and report.target_id in (select id from cleanup_target_leagues)
   )
   or (
     report.target_type = 'league_member'
     and report.target_id in (select id from cleanup_target_members)
   )
   or (
     report.target_type = 'chat_message'
     and report.target_id in (select id from cleanup_target_chat_messages)
   );

delete from public.league_chat_messages
where league_id in (select id from cleanup_target_leagues);

delete from public.user_achievements
where league_id in (select id from cleanup_target_leagues);

delete from public.seasons
where league_id in (select id from cleanup_target_leagues);

delete from public.standings
where league_id in (select id from cleanup_target_leagues);

delete from public.weekly_matchups
where league_id in (select id from cleanup_target_leagues);

delete from public.bet_legs
where id in (select id from cleanup_target_bet_legs);

delete from public.bets
where id in (select id from cleanup_target_bets);

delete from public.league_week_slate_games
where league_id in (select id from cleanup_target_leagues);

delete from public.league_members
where league_id in (select id from cleanup_target_leagues);

delete from public.leagues
where id in (select id from cleanup_target_leagues);

delete from public.live_game_states
where game_id in (select game_id from cleanup_orphanable_game_ids);

delete from public.games
where game_id in (select game_id from cleanup_orphanable_game_ids);

select
  'delete_junk_leagues_review' as report,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'reason', keep_reason
      )
      order by name
    )
    from cleanup_keep_leagues
  ) as keep_leagues,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'created_at', created_at
      )
      order by name, created_at, id
    )
    from cleanup_target_leagues
  ) as leagues_to_delete,
  (
    select jsonb_object_agg(table_name, rows_to_delete order by table_name)
    from cleanup_row_counts
  ) as rows_to_delete,
  jsonb_build_object(
    'target_game_ids_seen',
    (select count(*) from cleanup_target_game_ids),
    'orphaned_target_game_ids_to_delete',
    (select count(*) from cleanup_orphanable_game_ids),
    'shared_target_game_ids_kept',
    coalesce(
      (
        select jsonb_agg(game_id order by game_id)
        from cleanup_target_game_ids target_games
        where not exists (
          select 1
          from cleanup_orphanable_game_ids orphanable
          where orphanable.game_id = target_games.game_id
        )
      ),
      '[]'::jsonb
    )
  ) as game_cleanup,
  jsonb_build_object(
    'target_leagues_remaining',
    (
      select count(*)
      from public.leagues
      where id in (select id from cleanup_target_leagues)
    ),
    'keep_leagues_remaining',
    (
      select count(*)
      from public.leagues
      where id in (select id from cleanup_keep_leagues)
    ),
    'league_members_remaining',
    (
      select count(*)
      from public.league_members
      where league_id in (select id from cleanup_target_leagues)
    ),
    'weekly_matchups_remaining',
    (
      select count(*)
      from public.weekly_matchups
      where league_id in (select id from cleanup_target_leagues)
    ),
    'standings_remaining',
    (
      select count(*)
      from public.standings
      where league_id in (select id from cleanup_target_leagues)
    ),
    'bets_remaining',
    (
      select count(*)
      from public.bets
      where league_id in (select id from cleanup_target_leagues)
    ),
    'bet_legs_remaining',
    (
      select count(*)
      from public.bet_legs
      where id in (select id from cleanup_target_bet_legs)
    ),
    'league_week_slate_games_remaining',
    (
      select count(*)
      from public.league_week_slate_games
      where league_id in (select id from cleanup_target_leagues)
    ),
    'league_chat_messages_remaining',
    (
      select count(*)
      from public.league_chat_messages
      where league_id in (select id from cleanup_target_leagues)
    ),
    'notification_events_remaining',
    (
      select count(*)
      from public.notification_events event
      where event.league_id in (select id from cleanup_target_leagues)
         or event.bet_id in (select id from cleanup_target_bets)
         or event.matchup_id in (select id from cleanup_target_matchups)
         or event.data ->> 'leagueId' in (
           select id::text from cleanup_target_leagues
         )
    ),
    'content_reports_remaining',
    (
      select count(*)
      from public.content_reports report
      where report.league_id in (select id from cleanup_target_leagues)
         or (
           report.target_type = 'league'
           and report.target_id in (select id from cleanup_target_leagues)
         )
         or (
           report.target_type = 'league_member'
           and report.target_id in (select id from cleanup_target_members)
         )
         or (
           report.target_type = 'chat_message'
           and report.target_id in (select id from cleanup_target_chat_messages)
         )
    ),
    'user_achievements_remaining',
    (
      select count(*)
      from public.user_achievements
      where league_id in (select id from cleanup_target_leagues)
    ),
    'seasons_remaining',
    (
      select count(*)
      from public.seasons
      where league_id in (select id from cleanup_target_leagues)
    ),
    'orphaned_live_game_states_remaining',
    (
      select count(*)
      from public.live_game_states
      where game_id in (select game_id from cleanup_orphanable_game_ids)
    ),
    'orphaned_games_remaining',
    (
      select count(*)
      from public.games
      where game_id in (select game_id from cleanup_orphanable_game_ids)
    )
  ) as remaining_rows;

rollback;
