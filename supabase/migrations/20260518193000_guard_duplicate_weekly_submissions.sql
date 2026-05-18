do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_bets_without_submission_guard'
      and pg_get_function_identity_arguments(p.oid) = 'p_league_id uuid, p_week_number integer, p_bets jsonb'
  ) then
    alter function public.submit_bets(uuid, integer, jsonb)
      rename to submit_bets_without_submission_guard;
  end if;
end;
$$;

create or replace function public.submit_bets(
  p_league_id uuid,
  p_week_number integer,
  p_bets jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_league_member(p_league_id, auth.uid()) then
    raise exception 'Join this league before placing bets';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'submit_bets:' || p_league_id::text || ':' || auth.uid()::text || ':' || p_week_number::text,
      0
    )
  );

  if exists (
    select 1
    from public.bets
    where user_id = auth.uid()
      and league_id = p_league_id
      and week_number = p_week_number
  ) then
    raise exception 'Bets have already been submitted for this week';
  end if;

  return public.submit_bets_without_submission_guard(p_league_id, p_week_number, p_bets);
end;
$$;

revoke execute on function public.submit_bets_without_submission_guard(uuid, integer, jsonb)
  from anon, authenticated, public;

grant execute on function public.submit_bets(uuid, integer, jsonb) to authenticated;
