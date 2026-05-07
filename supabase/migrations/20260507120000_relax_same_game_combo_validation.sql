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
declare
  bet_item jsonb;
  leg_item jsonb;
  new_bet_id uuid;
  new_bet_ids uuid[] := '{}';
  submitted_count integer;
  submitted_total numeric(10,2);
  submitted_lock_count integer;
  leg_count integer;
  bet_type_text text;
  contradictory_selection_count integer;
  duplicate_selection_count integer;
  existing_selection_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_league_member(p_league_id, auth.uid()) then
    raise exception 'Join this league before placing bets';
  end if;

  if jsonb_typeof(p_bets) <> 'array' then
    raise exception 'Bets payload must be an array';
  end if;

  select
    count(*),
    coalesce(sum((value ->> 'amount')::numeric), 0),
    count(*) filter (where coalesce((value ->> 'is_lock')::boolean, false))
  into submitted_count, submitted_total, submitted_lock_count
  from jsonb_array_elements(p_bets);

  if submitted_count < 5 then
    raise exception 'At least 5 bets are required';
  end if;

  if submitted_lock_count <> 1 then
    raise exception 'Exactly one Lock of the Week is required';
  end if;

  if submitted_total <> 100 then
    raise exception 'Total allocation must equal exactly $100';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_bets) value
    where (value ->> 'amount')::numeric > 35
       or (value ->> 'amount')::numeric <= 0
  ) then
    raise exception 'No single bet can exceed $35';
  end if;

  select count(*)
  into duplicate_selection_count
  from (
    select
      leg ->> 'game_id' as game_id,
      leg ->> 'market' as market,
      leg ->> 'selection' as selection
    from jsonb_array_elements(p_bets) bet
    cross join jsonb_array_elements(bet.value -> 'legs') leg
    group by leg ->> 'game_id', leg ->> 'market', leg ->> 'selection'
    having count(*) > 1
  ) duplicate_selections;

  if duplicate_selection_count > 0 then
    raise exception 'Duplicate selections are not allowed';
  end if;

  with submitted_legs as (
    select
      row_number() over () as leg_index,
      leg ->> 'game_id' as game_id,
      leg ->> 'market' as market,
      leg ->> 'selection' as selection,
      case
        when leg ->> 'market' = 'spread' then
          regexp_replace(leg ->> 'selection', '[[:space:]][+-][0-9]+([.][0-9]+)?$', '')
        when leg ->> 'market' = 'over_under' then
          split_part(leg ->> 'selection', ' ', 1)
        else leg ->> 'selection'
      end as side
    from jsonb_array_elements(p_bets) bet
    cross join jsonb_array_elements(bet.value -> 'legs') leg
  )
  select count(*)
  into contradictory_selection_count
  from submitted_legs left_leg
  join submitted_legs right_leg
    on right_leg.leg_index > left_leg.leg_index
   and right_leg.game_id = left_leg.game_id
   and right_leg.market = left_leg.market
   and right_leg.selection <> left_leg.selection
   and right_leg.side <> left_leg.side;

  if contradictory_selection_count > 0 then
    raise exception 'Contradicting same-game selections are not allowed';
  end if;

  with submitted_legs as (
    select
      leg ->> 'game_id' as game_id,
      leg ->> 'market' as market,
      leg ->> 'selection' as selection,
      case
        when leg ->> 'market' = 'spread' then
          regexp_replace(leg ->> 'selection', '[[:space:]][+-][0-9]+([.][0-9]+)?$', '')
        when leg ->> 'market' = 'over_under' then
          split_part(leg ->> 'selection', ' ', 1)
        else leg ->> 'selection'
      end as side
    from jsonb_array_elements(p_bets) bet
    cross join jsonb_array_elements(bet.value -> 'legs') leg
  ),
  existing_legs as (
    select
      bl.game_id,
      bl.market::text as market,
      bl.selection,
      case
        when bl.market = 'spread' then
          regexp_replace(bl.selection, '[[:space:]][+-][0-9]+([.][0-9]+)?$', '')
        when bl.market = 'over_under' then
          split_part(bl.selection, ' ', 1)
        else bl.selection
      end as side
    from public.bets b
    join public.bet_legs bl on bl.bet_id = b.id
    where b.user_id = auth.uid()
      and b.league_id = p_league_id
      and b.week_number = p_week_number
  )
  select count(*)
  into existing_selection_count
  from submitted_legs submitted
  join existing_legs existing
    on existing.game_id = submitted.game_id
   and existing.market = submitted.market
   and (
      existing.selection = submitted.selection
      or existing.side <> submitted.side
   );

  if existing_selection_count > 0 then
    raise exception 'You already have a duplicate or conflicting selection on one of these games';
  end if;

  for bet_item in select value from jsonb_array_elements(p_bets) loop
    bet_type_text := bet_item ->> 'bet_type';

    if jsonb_typeof(bet_item -> 'legs') <> 'array' then
      raise exception 'Every bet needs legs';
    end if;

    select count(*) into leg_count from jsonb_array_elements(bet_item -> 'legs');

    if bet_type_text = 'straight' and leg_count <> 1 then
      raise exception 'Straight bets must have exactly one leg';
    elsif bet_type_text = 'parlay' and (leg_count < 2 or leg_count > 6) then
      raise exception 'Parlays must have 2 to 6 legs';
    elsif bet_type_text = 'teaser' and (leg_count < 2 or leg_count > 4) then
      raise exception 'Teasers must have 2 to 4 legs';
    elsif bet_type_text not in ('straight', 'parlay', 'teaser') then
      raise exception 'Unsupported bet type';
    end if;

    if bet_type_text = 'teaser' and (bet_item ->> 'teaser_points')::numeric not in (6, 6.5, 7) then
      raise exception 'Invalid teaser point size';
    end if;

    if bet_type_text <> 'teaser' and bet_item ->> 'teaser_points' is not null then
      raise exception 'Only teasers can have teaser points';
    end if;

    if bet_type_text = 'parlay' and (bet_item ->> 'potential_payout')::numeric > 500 then
      raise exception 'Parlay payout must be capped at $500';
    end if;

    for leg_item in select value from jsonb_array_elements(bet_item -> 'legs') loop
      if (leg_item ->> 'game_start_time')::timestamptz <= now() then
        raise exception 'One selected game has already started';
      end if;

      if bet_type_text = 'teaser' and (leg_item ->> 'market') = 'moneyline' then
        raise exception 'Teasers can only use spreads and totals';
      end if;
    end loop;

    insert into public.bets (
      user_id,
      league_id,
      week_number,
      bet_type,
      amount,
      odds,
      potential_payout,
      result,
      teaser_points,
      is_lock
    )
    values (
      auth.uid(),
      p_league_id,
      p_week_number,
      bet_type_text::public.bet_type,
      (bet_item ->> 'amount')::numeric,
      (bet_item ->> 'odds')::integer,
      (bet_item ->> 'potential_payout')::numeric,
      'pending',
      nullif(bet_item ->> 'teaser_points', '')::numeric,
      coalesce((bet_item ->> 'is_lock')::boolean, false)
    )
    returning id into new_bet_id;

    for leg_item in select value from jsonb_array_elements(bet_item -> 'legs') loop
      insert into public.bet_legs (
        bet_id,
        game_id,
        market,
        selection,
        original_line,
        adjusted_line,
        leg_odds,
        result,
        game_start_time,
        locked
      )
      values (
        new_bet_id,
        leg_item ->> 'game_id',
        (leg_item ->> 'market')::public.bet_market,
        leg_item ->> 'selection',
        nullif(leg_item ->> 'original_line', '')::numeric,
        nullif(leg_item ->> 'adjusted_line', '')::numeric,
        (leg_item ->> 'leg_odds')::integer,
        'pending',
        (leg_item ->> 'game_start_time')::timestamptz,
        false
      );
    end loop;

    new_bet_ids := array_append(new_bet_ids, new_bet_id);
  end loop;

  return new_bet_ids;
end;
$$;
