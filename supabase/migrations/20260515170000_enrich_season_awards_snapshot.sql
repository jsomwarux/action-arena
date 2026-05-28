-- Preserve enough bet context in completed-season awards for the trophy case UI.

alter table public.seasons
  add column if not exists championship_summary jsonb;

create or replace function public.capture_completed_season(p_league_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  league_record public.leagues;
  latest_week integer;
  champion_id uuid;
  final_standings_json jsonb := '[]'::jsonb;
  awards_json jsonb := '[]'::jsonb;
  championship_summary_json jsonb := null;
  championship_matchup public.weekly_matchups;
  season_id uuid;
  award_item jsonb;
begin
  select *
  into league_record
  from public.leagues
  where id = p_league_id;

  if league_record.id is null then
    raise exception 'League not found';
  end if;

  select max(week_number)
  into latest_week
  from public.standings
  where league_id = p_league_id;

  if latest_week is null then
    latest_week := league_record.current_week;
  end if;

  if league_record.type = 'h2h' then
    -- H2H playoff leagues crown the championship matchup winner, not the
    -- highest final standings row. Smaller brackets may flag a championship
    -- before Week 17, so use the latest resolved championship matchup.
    select wm.*
    into championship_matchup
    from public.weekly_matchups wm
    where wm.league_id = p_league_id
      and wm.is_championship = true
      and wm.winner_id is not null
    order by wm.week_number desc, wm.id
    limit 1;

    if championship_matchup.id is not null then
      champion_id := championship_matchup.winner_id;
      championship_summary_json := jsonb_build_object(
        'week_number', championship_matchup.week_number,
        'champion_user_id', championship_matchup.winner_id,
        'opponent_user_id', case
          when championship_matchup.winner_id = championship_matchup.home_user_id
            then championship_matchup.away_user_id
          else championship_matchup.home_user_id
        end,
        'champion_profit', case
          when championship_matchup.winner_id = championship_matchup.home_user_id
            then championship_matchup.home_profit
          else championship_matchup.away_profit
        end,
        'opponent_profit', case
          when championship_matchup.winner_id = championship_matchup.home_user_id
            then championship_matchup.away_profit
          else championship_matchup.home_profit
        end
      );
    end if;
  end if;

  if champion_id is null then
    -- Cumulative leagues and any season format without a resolved
    -- championship matchup use the standings leader as the champion.
    select s.user_id
    into champion_id
    from public.standings s
    where s.league_id = p_league_id
      and s.week_number = latest_week
    order by s.rank asc, s.total_profit desc, s.wins desc, s.user_id
    limit 1;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', s.user_id,
        'rank', s.rank,
        'wins', s.wins,
        'losses', s.losses,
        'ties', s.ties,
        'weekly_profit', s.weekly_profit,
        'total_profit', s.total_profit
      )
      order by s.rank asc, s.total_profit desc
    ),
    '[]'::jsonb
  )
  into final_standings_json
  from public.standings s
  where s.league_id = p_league_id
    and s.week_number = latest_week;

  select jsonb_build_object(
    'award_key', 'season_mvp',
    'award_label', 'Season MVP',
    'user_id', s.user_id,
    'metric', s.total_profit,
    'value_label', case
      when s.total_profit > 0 then '+' || to_char(round(s.total_profit), 'FM999,999,999,990') || ' coins'
      when s.total_profit < 0 then '-' || to_char(round(abs(s.total_profit)), 'FM999,999,999,990') || ' coins'
      else '0 coins'
    end
  )
  into award_item
  from public.standings s
  where s.league_id = p_league_id
    and s.week_number = latest_week
  order by s.total_profit desc, s.wins desc, s.user_id
  limit 1;

  if award_item is not null then
    awards_json := awards_json || jsonb_build_array(award_item);
  end if;

  if league_record.type = 'h2h' then
    select jsonb_build_object(
      'award_key', 'best_record',
      'award_label', 'Best Record',
      'user_id', s.user_id,
      'metric', s.wins,
      'value_label', s.wins::text || '-' || s.losses::text || '-' || s.ties::text
    )
    into award_item
    from public.standings s
    where s.league_id = p_league_id
      and s.week_number = latest_week
    order by s.wins desc, s.ties desc, s.total_profit desc, s.user_id
    limit 1;

    if award_item is not null then
      awards_json := awards_json || jsonb_build_array(award_item);
    end if;
  end if;

  select jsonb_build_object(
    'award_key', 'parlay_king',
    'award_label', 'Parlay King',
    'user_id', b.user_id,
    'metric', count(*),
    'value_label', count(*)::text || ' parlay win' || case when count(*) = 1 then '' else 's' end
  )
  into award_item
  from public.bets b
  where b.league_id = p_league_id
    and b.bet_type = 'parlay'
    and b.result = 'win'
  group by b.user_id
  order by count(*) desc, coalesce(sum(b.profit), 0) desc, b.user_id
  limit 1;

  if award_item is not null then
    awards_json := awards_json || jsonb_build_array(award_item);
  end if;

  select jsonb_build_object(
    'award_key', 'most_consistent',
    'award_label', 'Most Consistent',
    'user_id', weekly.user_id,
    'metric', count(*),
    'value_label', count(*)::text || ' positive week' || case when count(*) = 1 then '' else 's' end
  )
  into award_item
  from (
    select b.user_id, b.week_number, sum(coalesce(b.profit, 0)) as weekly_profit
    from public.bets b
    where b.league_id = p_league_id
      and b.result <> 'pending'
    group by b.user_id, b.week_number
  ) weekly
  where weekly.weekly_profit > 0
  group by weekly.user_id
  order by count(*) desc, sum(weekly.weekly_profit) desc, weekly.user_id
  limit 1;

  if award_item is not null then
    awards_json := awards_json || jsonb_build_array(award_item);
  end if;

  select jsonb_build_object(
    'award_key', 'biggest_single_bet',
    'award_label', 'Biggest Single Pick',
    'user_id', b.user_id,
    'metric', b.profit,
    'value_label', case
      when b.profit > 0 then '+' || to_char(round(b.profit), 'FM999,999,999,990') || ' coins'
      when b.profit < 0 then '-' || to_char(round(abs(b.profit)), 'FM999,999,999,990') || ' coins'
      else '0 coins'
    end,
    'bet_id', b.id,
    'is_lock', b.is_lock,
    'bet', jsonb_build_object(
      'id', b.id,
      'week_number', b.week_number,
      'bet_type', b.bet_type,
      'amount', b.amount,
      'odds', b.odds,
      'potential_payout', b.potential_payout,
      'profit', b.profit,
      'is_lock', b.is_lock,
      'legs', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'game_id', bl.game_id,
              'market', bl.market,
              'selection', bl.selection,
              'original_line', bl.original_line,
              'adjusted_line', bl.adjusted_line,
              'leg_odds', bl.leg_odds
            )
            order by bl.id
          )
          from public.bet_legs bl
          where bl.bet_id = b.id
        ),
        '[]'::jsonb
      )
    )
  )
  into award_item
  from public.bets b
  where b.league_id = p_league_id
    and b.profit is not null
  order by b.profit desc, b.created_at asc
  limit 1;

  if award_item is not null then
    awards_json := awards_json || jsonb_build_array(award_item);
  end if;

  insert into public.seasons (
    league_id,
    season_year,
    champion_user_id,
    final_standings,
    awards,
    championship_summary,
    completed_at
  )
  values (
    p_league_id,
    league_record.season_year,
    champion_id,
    final_standings_json,
    awards_json,
    championship_summary_json,
    now()
  )
  on conflict (league_id, season_year)
  do update set
    champion_user_id = excluded.champion_user_id,
    final_standings = excluded.final_standings,
    awards = excluded.awards,
    championship_summary = excluded.championship_summary,
    completed_at = excluded.completed_at
  returning id into season_id;

  return season_id;
end;
$$;

revoke execute on function public.capture_completed_season(uuid) from anon, authenticated;
grant execute on function public.capture_completed_season(uuid) to service_role;
