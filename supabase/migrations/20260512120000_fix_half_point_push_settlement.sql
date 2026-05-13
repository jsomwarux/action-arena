create or replace function public.is_whole_point_line(p_line numeric)
returns boolean
language sql
immutable
as $$
  select p_line is not null and p_line = trunc(p_line);
$$;

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
    elsif public.is_whole_point_line(p_adjusted_line) then
      return 'push';
    end if;

    raise warning 'Half-point spread evaluated to an exact push: selection %, line %, score %-%. Returning loss.',
      p_selection,
      p_adjusted_line,
      p_home_score,
      p_away_score;
    return 'loss';
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
      elsif public.is_whole_point_line(p_adjusted_line) then
        return 'push';
      end if;

      raise warning 'Half-point total evaluated to an exact push: selection %, line %, total %. Returning loss.',
        p_selection,
        p_adjusted_line,
        total_points;
      return 'loss';
    end if;

    if normalized_selection = 'under' or normalized_selection like 'under %' then
      if total_points < p_adjusted_line then
        return 'win';
      elsif total_points > p_adjusted_line then
        return 'loss';
      elsif public.is_whole_point_line(p_adjusted_line) then
        return 'push';
      end if;

      raise warning 'Half-point total evaluated to an exact push: selection %, line %, total %. Returning loss.',
        p_selection,
        p_adjusted_line,
        total_points;
      return 'loss';
    end if;
  end if;

  return null;
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
        and (
          bl.result = 'pending'
          or (
            bl.result = 'push'
            and bl.market in ('spread', 'over_under')
            and bl.adjusted_line is not null
            and not public.is_whole_point_line(bl.adjusted_line)
          )
        )
    ),
    updated as (
      update public.bet_legs bl
      set result = evaluated.leg_result,
          locked = true
      from evaluated
      where bl.id = evaluated.id
        and evaluated.leg_result is not null
        and bl.result is distinct from evaluated.leg_result
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
    where (
        b.result = 'pending'
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
      )
      or exists (
        select 1
        from updated_bets ub
        where ub.bet_id = b.id
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
        and (
          result is distinct from computed_result
          or profit is distinct from computed_profit
        );

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

do $$
declare
  regrade_summary jsonb;
begin
  if to_regclass('public.live_game_states') is null then
    raise notice 'Skipped historical half-point push regrade because public.live_game_states does not exist.';
    return;
  end if;

  select public.settle_completed_scores(
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', live.game_id,
        'completed', true,
        'home_team', live.home_team,
        'away_team', live.away_team,
        'scores', jsonb_build_array(
          jsonb_build_object('name', live.home_team, 'score', live.home_score::text),
          jsonb_build_object('name', live.away_team, 'score', live.away_score::text)
        ),
        'sport_key', live.sport_key,
        'sport_title', 'NFL',
        'last_update', live.last_updated
      )
      order by live.game_id
    ), '[]'::jsonb)
  )
  into regrade_summary
  from public.live_game_states live
  where live.status = 'final'
    and exists (
      select 1
      from public.bet_legs bl
      where bl.game_id = live.game_id
        and bl.result = 'push'
        and bl.market in ('spread', 'over_under')
        and bl.adjusted_line is not null
        and not public.is_whole_point_line(bl.adjusted_line)
    );

  if regrade_summary is not null then
    raise notice 'Regraded historical half-point pushes: %', regrade_summary;
  end if;
end;
$$;
