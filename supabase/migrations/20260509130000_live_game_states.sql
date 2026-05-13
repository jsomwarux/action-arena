create table if not exists public.live_game_states (
  game_id text primary key,
  sport_key text not null default 'americanfootball_nfl',
  away_team text not null,
  home_team text not null,
  away_score integer not null default 0 check (away_score >= 0),
  home_score integer not null default 0 check (home_score >= 0),
  current_period text,
  time_remaining text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'halftime', 'final')),
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_game_states_status_idx
on public.live_game_states (status, last_updated desc);

alter table public.live_game_states enable row level security;

drop policy if exists "League members can read live game states" on public.live_game_states;
create policy "League members can read live game states"
on public.live_game_states for select
to authenticated
using (
  exists (
    select 1
    from public.league_week_slate_games slate
    where slate.game_id = live_game_states.game_id
      and public.is_league_member(slate.league_id)
  )
);

drop policy if exists "Service role can manage live game states" on public.live_game_states;
create policy "Service role can manage live game states"
on public.live_game_states for all
to service_role
using (true)
with check (true);

create or replace function public.touch_live_game_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_game_states_updated_at on public.live_game_states;
create trigger live_game_states_updated_at
before update on public.live_game_states
for each row execute function public.touch_live_game_states_updated_at();

create or replace function public.live_score_polling_candidates()
returns table (
  game_id text,
  away_team text,
  home_team text,
  commence_time timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (slate.game_id)
    slate.game_id,
    coalesce(live.away_team, slate.away_team, 'Away') as away_team,
    coalesce(live.home_team, slate.home_team, 'Home') as home_team,
    slate.commence_time,
    coalesce(live.status, 'scheduled') as status
  from public.league_week_slate_games slate
  left join public.live_game_states live on live.game_id = slate.game_id
  where (
      live.status in ('in_progress', 'halftime')
      or (
        slate.commence_time <= now() + interval '5 minutes'
        and slate.commence_time >= now() - interval '8 hours'
        and coalesce(live.status, 'scheduled') <> 'final'
      )
    )
  order by slate.game_id, slate.commence_time;
$$;

create or replace function public.upsert_live_game_states(p_scores jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  score_item jsonb;
  score_entry jsonb;
  away_score integer;
  home_score integer;
  rows_updated integer := 0;
  resolved_status text;
  resolved_period text;
  resolved_time_remaining text;
  resolved_last_updated timestamptz;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Scores payload must be an array';
  end if;

  for score_item in
    select value from jsonb_array_elements(p_scores)
  loop
    continue when coalesce(score_item ->> 'id', '') = '';

    away_score := 0;
    home_score := 0;

    if jsonb_typeof(score_item -> 'scores') = 'array' then
      for score_entry in select value from jsonb_array_elements(score_item -> 'scores')
      loop
        if score_entry ->> 'name' = score_item ->> 'away_team' then
          away_score := coalesce(nullif(score_entry ->> 'score', '')::integer, 0);
        elsif score_entry ->> 'name' = score_item ->> 'home_team' then
          home_score := coalesce(nullif(score_entry ->> 'score', '')::integer, 0);
        end if;
      end loop;
    end if;

    resolved_status := lower(coalesce(
      nullif(score_item ->> 'status', ''),
      case
        when coalesce((score_item ->> 'completed')::boolean, false) then 'final'
        when jsonb_typeof(score_item -> 'scores') = 'array' then 'in_progress'
        when nullif(score_item ->> 'commence_time', '')::timestamptz <= now() then 'in_progress'
        else 'scheduled'
      end
    ));

    if resolved_status not in ('scheduled', 'in_progress', 'halftime', 'final') then
      resolved_status := case
        when coalesce((score_item ->> 'completed')::boolean, false) then 'final'
        when jsonb_typeof(score_item -> 'scores') = 'array' then 'in_progress'
        else 'scheduled'
      end;
    end if;

    resolved_period := nullif(coalesce(
      score_item ->> 'current_period',
      score_item ->> 'period',
      case when resolved_status = 'final' then 'final' else null end
    ), '');
    resolved_time_remaining := nullif(coalesce(
      score_item ->> 'time_remaining',
      score_item ->> 'clock'
    ), '');
    resolved_last_updated := coalesce(
      nullif(score_item ->> 'last_update', '')::timestamptz,
      now()
    );

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
    values (
      score_item ->> 'id',
      coalesce(nullif(score_item ->> 'sport_key', ''), 'americanfootball_nfl'),
      coalesce(nullif(score_item ->> 'away_team', ''), 'Away'),
      coalesce(nullif(score_item ->> 'home_team', ''), 'Home'),
      away_score,
      home_score,
      resolved_period,
      resolved_time_remaining,
      resolved_status,
      resolved_last_updated
    )
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

    rows_updated := rows_updated + 1;
  end loop;

  return rows_updated;
end;
$$;

revoke execute on function public.live_score_polling_candidates() from anon, authenticated;
grant execute on function public.live_score_polling_candidates() to service_role;

revoke execute on function public.upsert_live_game_states(jsonb) from anon, authenticated;
grant execute on function public.upsert_live_game_states(jsonb) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.live_game_states;
exception
  when duplicate_object or undefined_object then
    null;
end;
$$;
