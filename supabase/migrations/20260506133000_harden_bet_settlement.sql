create or replace function public.evaluate_bet_leg(
  p_market public.bet_market,
  p_selection text,
  p_adjusted_line numeric,
  p_home_team text,
  p_away_team text,
  p_home_score integer,
  p_away_score integer
)
returns public.bet_result
language plpgsql
immutable
as $$
declare
  normalized_selection text := lower(trim(p_selection));
  normalized_home_team text := lower(trim(p_home_team));
  normalized_away_team text := lower(trim(p_away_team));
  margin numeric;
  total_points numeric;
begin
  if p_home_score is null or p_away_score is null then
    return null;
  end if;

  if p_market = 'moneyline' then
    if p_home_score = p_away_score then
      return 'push';
    end if;

    if normalized_selection = normalized_home_team then
      return case when p_home_score > p_away_score then 'win' else 'loss' end;
    end if;

    if normalized_selection = normalized_away_team then
      return case when p_away_score > p_home_score then 'win' else 'loss' end;
    end if;

    return null;
  end if;

  if p_market = 'spread' then
    if p_adjusted_line is null then
      return null;
    end if;

    if normalized_selection = normalized_home_team
      or normalized_selection like normalized_home_team || ' %' then
      margin := p_home_score - p_away_score + p_adjusted_line;
    elsif normalized_selection = normalized_away_team
      or normalized_selection like normalized_away_team || ' %' then
      margin := p_away_score - p_home_score + p_adjusted_line;
    else
      return null;
    end if;

    if margin > 0 then
      return 'win';
    elsif margin < 0 then
      return 'loss';
    end if;

    return 'push';
  end if;

  if p_market = 'over_under' then
    if p_adjusted_line is null then
      return null;
    end if;

    total_points := p_home_score + p_away_score;

    if normalized_selection = 'over' or normalized_selection like 'over %' then
      if total_points > p_adjusted_line then
        return 'win';
      elsif total_points < p_adjusted_line then
        return 'loss';
      end if;

      return 'push';
    end if;

    if normalized_selection = 'under' or normalized_selection like 'under %' then
      if total_points < p_adjusted_line then
        return 'win';
      elsif total_points > p_adjusted_line then
        return 'loss';
      end if;

      return 'push';
    end if;
  end if;

  return null;
end;
$$;

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
  else
    update public.leagues
    set current_week = greatest(current_week, p_week_number + 1)
    where id = p_league_id;
  end if;
end;
$$;

create or replace function public.settle_completed_scores(p_scores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  score_item jsonb;
  changed_leg_count integer;
  completed_count integer := 0;
  updated_leg_count integer := 0;
  settled_bet_count integer := 0;
  resolved_week_count integer := 0;
  home_score integer;
  away_score integer;
  bet_record public.bets;
  leg_record public.bet_legs;
  loss_count integer;
  pending_count integer;
  remaining_leg_count integer;
  computed_result public.bet_result;
  computed_profit numeric(10,2);
  payout numeric;
  combined_decimal numeric;
  teaser_odds integer;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception 'Scores payload must be a JSON array';
  end if;

  create temporary table if not exists updated_bets (
    bet_id uuid primary key,
    league_id uuid not null,
    week_number integer not null
  ) on commit drop;

  truncate table updated_bets;

  for score_item in
    select value from jsonb_array_elements(p_scores)
  loop
    continue when not coalesce((score_item ->> 'completed')::boolean, false);
    continue when jsonb_typeof(score_item -> 'scores') <> 'array';

    select (score_entry.value ->> 'score')::integer
    into home_score
    from jsonb_array_elements(score_item -> 'scores') as score_entry(value)
    where score_entry.value ->> 'name' = score_item ->> 'home_team';

    select (score_entry.value ->> 'score')::integer
    into away_score
    from jsonb_array_elements(score_item -> 'scores') as score_entry(value)
    where score_entry.value ->> 'name' = score_item ->> 'away_team';

    if home_score is null or away_score is null then
      continue;
    end if;

    completed_count := completed_count + 1;

    with evaluated as (
      select
        bl.id,
        public.evaluate_bet_leg(
          bl.market,
          bl.selection,
          bl.adjusted_line,
          score_item ->> 'home_team',
          score_item ->> 'away_team',
          home_score,
          away_score
        ) as leg_result
      from public.bet_legs bl
      where bl.game_id = score_item ->> 'id'
        and bl.result = 'pending'
    ),
    updated as (
      update public.bet_legs bl
      set result = evaluated.leg_result,
          locked = true
      from evaluated
      where bl.id = evaluated.id
        and evaluated.leg_result is not null
      returning bl.bet_id
    ),
    inserted as (
      insert into updated_bets (bet_id, league_id, week_number)
      select distinct b.id, b.league_id, b.week_number
      from updated
      join public.bets b on b.id = updated.bet_id
      on conflict (bet_id) do nothing
      returning 1
    )
    select count(*)
    into changed_leg_count
    from updated;

    updated_leg_count := updated_leg_count + coalesce(changed_leg_count, 0);
  end loop;

  for bet_record in
    select b.*
    from public.bets b
    where b.result = 'pending'
      and (
        exists (
          select 1
          from public.bet_legs bl
          where bl.bet_id = b.id
            and bl.result = 'loss'
        )
        or not exists (
          select 1
          from public.bet_legs bl
          where bl.bet_id = b.id
            and bl.result = 'pending'
        )
      )
  loop
    computed_result := null;
    computed_profit := null;

    if bet_record.bet_type = 'straight' then
      select *
      into leg_record
      from public.bet_legs
      where bet_id = bet_record.id
      limit 1;

      if leg_record.result = 'win' then
        payout := public.payout_from_american(bet_record.amount, leg_record.leg_odds);
        computed_result := 'win';
        computed_profit := round(payout - bet_record.amount, 2);
      elsif leg_record.result = 'loss' then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif leg_record.result = 'push' then
        computed_result := 'push';
        computed_profit := 0;
      end if;
    elsif bet_record.bet_type = 'parlay' then
      select
        count(*) filter (where result = 'loss'),
        count(*) filter (where result = 'pending')
      into loss_count, pending_count
      from public.bet_legs
      where bet_id = bet_record.id;

      if loss_count > 0 then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif pending_count = 0 then
        select count(*)
        into remaining_leg_count
        from public.bet_legs
        where bet_id = bet_record.id
          and result <> 'push';

        if remaining_leg_count = 0 then
          computed_result := 'push';
          computed_profit := 0;
        elsif remaining_leg_count = 1 then
          select *
          into leg_record
          from public.bet_legs
          where bet_id = bet_record.id
            and result <> 'push'
          limit 1;

          payout := public.payout_from_american(bet_record.amount, leg_record.leg_odds);
          computed_result := 'win';
          computed_profit := round(payout - bet_record.amount, 2);
        else
          combined_decimal := 1;

          for leg_record in
            select *
            from public.bet_legs
            where bet_id = bet_record.id
              and result <> 'push'
          loop
            combined_decimal := combined_decimal * public.american_to_decimal(leg_record.leg_odds);
          end loop;

          payout := least(round(bet_record.amount * combined_decimal, 2), 500);
          computed_result := 'win';
          computed_profit := round(payout - bet_record.amount, 2);
        end if;
      end if;
    elsif bet_record.bet_type = 'teaser' then
      select
        count(*) filter (where result = 'loss'),
        count(*) filter (where result = 'pending')
      into loss_count, pending_count
      from public.bet_legs
      where bet_id = bet_record.id;

      if loss_count > 0 then
        computed_result := 'loss';
        computed_profit := -bet_record.amount;
      elsif pending_count = 0 then
        select count(*)
        into remaining_leg_count
        from public.bet_legs
        where bet_id = bet_record.id
          and result <> 'push';

        if remaining_leg_count < 2 then
          computed_result := 'push';
          computed_profit := 0;
        else
          teaser_odds := public.teaser_odds_for(remaining_leg_count, bet_record.teaser_points);

          if teaser_odds is null then
            raise warning 'No teaser odds for bet %, remaining legs %, teaser points %',
              bet_record.id,
              remaining_leg_count,
              bet_record.teaser_points;
          else
            payout := public.payout_from_american(bet_record.amount, teaser_odds);
            computed_result := 'win';
            computed_profit := round(payout - bet_record.amount, 2);
          end if;
        end if;
      end if;
    end if;

    if computed_result is not null then
      if bet_record.is_lock and computed_result in ('win', 'loss') then
        computed_profit := round(computed_profit * 1.5, 2);
      end if;

      update public.bets
      set result = computed_result,
          profit = computed_profit
      where id = bet_record.id
        and result = 'pending';

      insert into updated_bets (bet_id, league_id, week_number)
      values (bet_record.id, bet_record.league_id, bet_record.week_number)
      on conflict (bet_id) do nothing;

      settled_bet_count := settled_bet_count + 1;
    end if;
  end loop;

  resolved_week_count := public.resolve_ready_weekly_standings();

  return jsonb_build_object(
    'completed_games', completed_count,
    'updated_legs', updated_leg_count,
    'settled_bets', settled_bet_count,
    'resolved_weeks', resolved_week_count
  );
end;
$$;

revoke execute on function public.resolve_league_week(uuid, integer) from anon, authenticated;
revoke execute on function public.settle_completed_scores(jsonb) from anon, authenticated;

grant execute on function public.settle_completed_scores(jsonb) to service_role;
grant execute on function public.resolve_league_week(uuid, integer) to service_role;
