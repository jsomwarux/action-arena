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
