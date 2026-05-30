-- Rename the App Review Demo League for App Store review and screenshots.
--
-- Default mode is review-only: the final statement is ROLLBACK, so this file
-- prints the planned rename and exercises the full transaction without
-- persisting production data changes. To apply after review, change only the
-- final ROLLBACK to COMMIT and run this exact file against the linked project.
--
-- Target league:
--   da74152d-2864-4a17-bbca-0a1acc492d55 / App Review Demo League
--
-- Keep, never touch:
--   Sunday Night Pick Club and every other league
--
-- Scope:
--   Rename the target league name only, resolved strictly by id. Member display
--   names, team names, standings, records, ranks, weekly or total profit, coins,
--   bets, current_week, and every field other than leagues.name remain unchanged.

begin;

set constraints all deferred;

create temporary table app_review_demo_league_rename_target (
  id uuid primary key,
  old_name text not null,
  new_name text not null
) on commit drop;

insert into app_review_demo_league_rename_target (id, old_name, new_name)
select id, name, 'Primetime Players'
from public.leagues
where id = 'da74152d-2864-4a17-bbca-0a1acc492d55'::uuid;

do $$
declare
  target_count integer;
  resolved_name text;
begin
  select count(*), max(old_name)
  into target_count, resolved_name
  from app_review_demo_league_rename_target;

  if target_count <> 1 then
    raise exception 'Refusing to run: expected exactly one league with id da74152d-2864-4a17-bbca-0a1acc492d55, found %', target_count;
  end if;

  if resolved_name <> 'App Review Demo League' then
    raise exception 'Refusing to run: expected current name App Review Demo League for id da74152d-2864-4a17-bbca-0a1acc492d55, found %', resolved_name;
  end if;
end;
$$;

select
  'league_rename_plan' as report,
  id as league_id,
  old_name,
  new_name
from app_review_demo_league_rename_target;

select
  'before_after_preview' as report,
  to_jsonb(league.*) as before_league_row,
  jsonb_set(to_jsonb(league.*), '{name}', to_jsonb(target.new_name)) as after_league_row
from public.leagues league
join app_review_demo_league_rename_target target on target.id = league.id;

do $$
declare
  updated_count integer;
begin
  update public.leagues league
  set name = target.new_name
  from app_review_demo_league_rename_target target
  where league.id = target.id
    and league.name = target.old_name;

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'Refusing to continue: expected to rename exactly one league row, updated %', updated_count;
  end if;
end;
$$;

select
  'post_update_preview' as report,
  league.id as league_id,
  league.name as confirmed_name,
  to_jsonb(league.*) as league_row
from public.leagues league
join app_review_demo_league_rename_target target on target.id = league.id
where league.name = target.new_name;

rollback;
