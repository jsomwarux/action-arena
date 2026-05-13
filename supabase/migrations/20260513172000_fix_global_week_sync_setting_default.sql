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
