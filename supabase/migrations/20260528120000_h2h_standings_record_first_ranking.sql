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
    pick_count integer not null,
    weekly_profit numeric(10,2) not null
  ) on commit drop;

  truncate table weekly_profit_totals;

  insert into weekly_profit_totals (user_id, pick_count, weekly_profit)
  select
    lm.user_id,
    count(b.id)::integer as pick_count,
    case
      when count(b.id) = 0 then -100
      else round(coalesce(sum(b.profit), 0), 2)
    end as weekly_profit
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
        set home_profit = coalesce(home_weekly_profit, -100),
            away_profit = null,
            winner_id = matchup_record.home_user_id
        where id = matchup_record.id;
      else
        select weekly_profit
        into away_weekly_profit
        from weekly_profit_totals
        where user_id = matchup_record.away_user_id;

        update public.weekly_matchups
        set home_profit = coalesce(home_weekly_profit, -100),
            away_profit = coalesce(away_weekly_profit, -100),
            winner_id = case
              when coalesce(home_weekly_profit, -100) > coalesce(away_weekly_profit, -100) then matchup_record.home_user_id
              when coalesce(away_weekly_profit, -100) > coalesce(home_weekly_profit, -100) then matchup_record.away_user_id
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
    coalesce(wpt.weekly_profit, -100) as weekly_profit,
    round(
      coalesce((
        select sum(s.weekly_profit)
        from public.standings s
        where s.league_id = p_league_id
          and s.user_id = lm.user_id
          and s.week_number < p_week_number
      ), 0) + coalesce(wpt.weekly_profit, -100),
      2
    ) as total_profit
  from public.league_members lm
  left join weekly_profit_totals wpt on wpt.user_id = lm.user_id
  where lm.league_id = p_league_id;

  with ranked as (
    select
      sv.*,
      (rank() over (
        -- H2H standings are record-first so the visible W-L-T column matches
        -- the rank order; season coins are only the deterministic tiebreaker.
        order by
          case when target_league.type = 'h2h' then sv.wins else 0 end desc,
          case when target_league.type = 'h2h' then sv.losses else 0 end asc,
          case when target_league.type = 'h2h' then sv.ties else 0 end desc,
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

  if target_league.sport = 'nfl'
    and not public.is_global_week_exempt_fixture(target_league.name, target_league.settings)
  then
    if target_league.type = 'h2h' and p_week_number = 14 then
      update public.leagues
      set status = 'playoffs'
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
        set status = 'complete'
        where id = p_league_id;
      else
        update public.leagues
        set status = 'playoffs'
        where id = p_league_id;

        perform public.generate_playoff_schedule(p_league_id, p_week_number + 1);
      end if;
    elsif p_week_number >= 17 then
      update public.leagues
      set status = 'complete'
      where id = p_league_id;
    end if;

    perform public.advance_global_nfl_week_if_ready(target_league.season_year, p_week_number);
  elsif target_league.type = 'h2h' and p_week_number = 14 then
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
  else
    update public.leagues
    set current_week = greatest(current_week, p_week_number + 1)
    where id = p_league_id;
  end if;
end;
$$;

with ranked_h2h_standings as (
  select
    s.id,
    (rank() over (
      partition by s.league_id, s.week_number
      -- Existing H2H snapshots need the same record-first ordering as newly
      -- resolved weeks; total and weekly coins remain deterministic tiebreaks.
      order by
        s.wins desc,
        s.losses asc,
        s.ties desc,
        s.total_profit desc,
        s.weekly_profit desc,
        s.user_id
    ))::integer as computed_rank
  from public.standings s
  join public.leagues l on l.id = s.league_id
  where l.type = 'h2h'
)
update public.standings s
set rank = ranked.computed_rank
from ranked_h2h_standings ranked
where ranked.id = s.id;
