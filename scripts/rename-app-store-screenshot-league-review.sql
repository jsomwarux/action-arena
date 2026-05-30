-- Polish the App Store Screenshot League names without touching any other league.
--
-- Default mode is review-only: the final statement is ROLLBACK, so this file
-- prints the planned renames and exercises the full transaction without
-- persisting production data changes. To apply after review, change only the
-- final ROLLBACK to COMMIT and run this exact file against the linked project.
--
-- Target league:
--   App Store Screenshot League, resolved by name at runtime
--
-- Keep, never touch:
--   da74152d-2864-4a17-bbca-0a1acc492d55 / App Review Demo League
--
-- Scope:
--   Rename the target league and non-natural member account display names only.
--   League member team names, standings, records, ranks, coins, bets, and every
--   other league remain unchanged.

begin;

set constraints all deferred;

create temporary table app_store_screenshot_target_league (
  id uuid primary key,
  old_name text not null,
  new_name text not null
) on commit drop;

insert into app_store_screenshot_target_league (id, old_name, new_name)
select id, name, 'Sunday Night Pick Club'
from public.leagues
where name = 'App Store Screenshot League';

do $$
declare
  target_count integer;
begin
  select count(*) into target_count from app_store_screenshot_target_league;

  if target_count <> 1 then
    raise exception 'Refusing to run: expected exactly one App Store Screenshot League, found %', target_count;
  end if;

  if exists (
    select 1
    from app_store_screenshot_target_league
    where id = 'da74152d-2864-4a17-bbca-0a1acc492d55'::uuid
       or old_name = 'App Review Demo League'
  ) then
    raise exception 'Refusing to run: target resolved to the App Review Demo League';
  end if;
end;
$$;

create temporary table app_store_member_names (
  name_index integer primary key,
  display_name text not null
) on commit drop;

insert into app_store_member_names (name_index, display_name)
values
  (1, 'Maya Thompson'),
  (2, 'Chris Walker'),
  (3, 'Avery Brooks'),
  (4, 'Taylor Morgan'),
  (5, 'Riley Bennett'),
  (6, 'Casey Parker'),
  (7, 'Jamie Collins'),
  (8, 'Alex Rivera'),
  (9, 'Sam Carter'),
  (10, 'Drew Mitchell');

create temporary table app_store_member_rename_plan on commit drop as
with target as (
  select id from app_store_screenshot_target_league
),
members as (
  select
    member.league_id,
    member.user_id,
    member.team_name,
    users.email,
    users.display_name as old_display_name,
    min(standings.rank) filter (where standings.week_number = league.current_week) as current_rank,
    member.joined_at
  from public.league_members member
  join target on target.id = member.league_id
  join public.leagues league on league.id = member.league_id
  join public.users users on users.id = member.user_id
  left join public.standings standings
    on standings.league_id = member.league_id
    and standings.user_id = member.user_id
  group by
    member.league_id,
    member.user_id,
    member.team_name,
    users.email,
    users.display_name,
    member.joined_at
),
classified as (
  select
    members.*,
    case
      when lower(members.email) = 'appreview@actionarena.app' then false
      when members.old_display_name = 'Jordan Ellis' then false
      when nullif(trim(coalesce(members.old_display_name, '')), '') is null then true
      when trim(members.old_display_name) ~* '^player[[:space:]_-]*[0-9]+$' then true
      when trim(members.old_display_name) ~* '^(test|tester|demo|fixture|qa)[[:space:]_-]*[[:alnum:]_-]*$' then true
      when trim(members.old_display_name) ~ '[0-9]' then true
      when trim(members.old_display_name) !~ '[[:space:]]' then true
      else false
    end as should_rename
  from members
),
numbered as (
  select
    classified.*,
    case
      when should_rename then row_number() over (
        partition by should_rename
        order by coalesce(current_rank, 999), joined_at, user_id
      )
      else null
    end as name_index
  from classified
)
select
  numbered.league_id,
  numbered.user_id,
  numbered.email,
  numbered.team_name,
  numbered.old_display_name,
  case
    when numbered.should_rename then names.display_name
    else numbered.old_display_name
  end as new_display_name,
  numbered.should_rename,
  numbered.current_rank,
  numbered.joined_at
from numbered
left join app_store_member_names names on names.name_index = numbered.name_index;

do $$
declare
  missing_name_count integer;
begin
  select count(*)
  into missing_name_count
  from app_store_member_rename_plan
  where should_rename
    and new_display_name is null;

  if missing_name_count > 0 then
    raise exception 'Refusing to run: % member rename(s) did not receive a replacement name', missing_name_count;
  end if;
end;
$$;

select
  'league_rename_plan' as report,
  id as league_id,
  old_name,
  new_name
from app_store_screenshot_target_league;

select
  'member_display_name_rename_plan' as report,
  league_id,
  user_id,
  email,
  team_name,
  old_display_name,
  new_display_name,
  should_rename
from app_store_member_rename_plan
order by coalesce(current_rank, 999), joined_at, user_id;

update public.leagues league
set name = target.new_name
from app_store_screenshot_target_league target
where league.id = target.id;

update public.users users
set display_name = plan.new_display_name
from app_store_member_rename_plan plan
where users.id = plan.user_id
  and plan.should_rename
  and users.display_name is distinct from plan.new_display_name;

select
  'post_update_preview' as report,
  (
    select jsonb_build_object(
      'id', league.id,
      'name', league.name
    )
    from public.leagues league
    join app_store_screenshot_target_league target on target.id = league.id
  ) as league,
  (
    select jsonb_agg(
      jsonb_build_object(
        'email', users.email,
        'display_name', users.display_name,
        'team_name', members.team_name,
        'rank', standings.rank,
        'record', concat(standings.wins, '-', standings.losses, '-', standings.ties),
        'weekly_profit', standings.weekly_profit,
        'total_profit', standings.total_profit
      )
      order by standings.rank, members.joined_at, users.email
    )
    from app_store_screenshot_target_league target
    join public.leagues league on league.id = target.id
    join public.league_members members on members.league_id = target.id
    join public.users users on users.id = members.user_id
    left join public.standings standings
      on standings.league_id = target.id
      and standings.user_id = members.user_id
      and standings.week_number = league.current_week
  ) as members;

commit;
