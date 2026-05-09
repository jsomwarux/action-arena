create or replace function public.pick_conflict_side(
  p_market text,
  p_selection text
)
returns text
language sql
immutable
as $$
  select case
    when p_market = 'spread' then
      regexp_replace(coalesce(p_selection, ''), '[[:space:]][+-][0-9]+([.][0-9]+)?$', '')
    when p_market = 'over_under' then
      split_part(coalesce(p_selection, ''), ' ', 1)
    else coalesce(p_selection, '')
  end
$$;

create or replace function public.pick_effective_line(
  p_original_line numeric,
  p_adjusted_line numeric
)
returns numeric
language sql
immutable
as $$
  select coalesce(p_adjusted_line, p_original_line)
$$;

create or replace function public.picks_directly_conflict(
  p_left_game_id text,
  p_left_market text,
  p_left_selection text,
  p_left_original_line numeric,
  p_left_adjusted_line numeric,
  p_right_game_id text,
  p_right_market text,
  p_right_selection text,
  p_right_original_line numeric,
  p_right_adjusted_line numeric
)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select
      public.pick_effective_line(p_left_original_line, p_left_adjusted_line) as left_line,
      public.pick_effective_line(p_right_original_line, p_right_adjusted_line) as right_line,
      public.pick_conflict_side(p_left_market, p_left_selection) as left_side,
      public.pick_conflict_side(p_right_market, p_right_selection) as right_side
  )
  select
    coalesce(p_left_game_id = p_right_game_id, false)
    and coalesce(p_left_market = p_right_market, false)
    and left_side <> right_side
    and case
      when p_left_market = 'moneyline' then true
      when p_left_market = 'spread' then
        left_line is null
        or right_line is null
        or abs(abs(left_line) - abs(right_line)) < 0.001
      when p_left_market = 'over_under' then
        left_line is null
        or right_line is null
        or abs(left_line - right_line) < 0.001
      else false
    end
  from normalized
$$;

create or replace function public.format_pick_label(
  p_selection text,
  p_leg_odds integer
)
returns text
language sql
immutable
as $$
  select concat(
    coalesce(p_selection, 'Unknown pick'),
    case
      when p_leg_odds is null then ''
      when p_leg_odds > 0 then concat(' +', p_leg_odds::text)
      else concat(' ', p_leg_odds::text)
    end
  )
$$;

create or replace function public.format_pick_conflict_reason(
  p_market text,
  p_left_line numeric,
  p_right_line numeric
)
returns text
language sql
immutable
as $$
  with line_value as (
    select coalesce(p_left_line, p_right_line) as line
  )
  select case
    when p_market = 'moneyline' then
      'both teams cannot win the same game'
    when p_market = 'spread' and line is not null then
      concat(
        'they are opposite sides of the same ',
        case when line > 0 then concat('+', line::text) else line::text end,
        ' spread'
      )
    when p_market = 'spread' then
      'they are opposite sides of the same spread'
    when p_market = 'over_under' and line is not null then
      concat('they are opposite sides of the same ', line::text, ' total')
    else
      'they are opposite sides of the same total'
  end
  from line_value
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
  submitted_conflict_message text;
  existing_conflict_message text;
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

  if exists (
    select 1
    from jsonb_array_elements(p_bets) value
    where jsonb_typeof(value -> 'legs') <> 'array'
  ) then
    raise exception 'Every bet needs legs';
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

  with submitted_legs as (
    select
      ((bet.bet_index - 1) * 1000 + leg.leg_index) as leg_index,
      leg.value ->> 'game_id' as game_id,
      leg.value ->> 'market' as market,
      leg.value ->> 'selection' as selection,
      nullif(leg.value ->> 'original_line', '')::numeric as original_line,
      nullif(leg.value ->> 'adjusted_line', '')::numeric as adjusted_line,
      public.pick_effective_line(
        nullif(leg.value ->> 'original_line', '')::numeric,
        nullif(leg.value ->> 'adjusted_line', '')::numeric
      ) as effective_line,
      public.format_pick_label(
        leg.value ->> 'selection',
        (leg.value ->> 'leg_odds')::integer
      ) as pick_label
    from jsonb_array_elements(p_bets) with ordinality as bet(value, bet_index)
    cross join jsonb_array_elements(bet.value -> 'legs') with ordinality as leg(value, leg_index)
  )
  select format(
    '%s conflicts with %s because %s',
    left_leg.pick_label,
    right_leg.pick_label,
    public.format_pick_conflict_reason(
      left_leg.market,
      left_leg.effective_line,
      right_leg.effective_line
    )
  )
  into submitted_conflict_message
  from submitted_legs left_leg
  join submitted_legs right_leg
    on right_leg.leg_index > left_leg.leg_index
   and public.picks_directly_conflict(
      left_leg.game_id,
      left_leg.market,
      left_leg.selection,
      left_leg.original_line,
      left_leg.adjusted_line,
      right_leg.game_id,
      right_leg.market,
      right_leg.selection,
      right_leg.original_line,
      right_leg.adjusted_line
   )
  limit 1;

  if submitted_conflict_message is not null then
    raise exception '%', submitted_conflict_message;
  end if;

  with submitted_legs as (
    select
      leg.value ->> 'game_id' as game_id,
      leg.value ->> 'market' as market,
      leg.value ->> 'selection' as selection,
      nullif(leg.value ->> 'original_line', '')::numeric as original_line,
      nullif(leg.value ->> 'adjusted_line', '')::numeric as adjusted_line,
      public.pick_effective_line(
        nullif(leg.value ->> 'original_line', '')::numeric,
        nullif(leg.value ->> 'adjusted_line', '')::numeric
      ) as effective_line,
      public.format_pick_label(
        leg.value ->> 'selection',
        (leg.value ->> 'leg_odds')::integer
      ) as pick_label
    from jsonb_array_elements(p_bets) as bet(value)
    cross join jsonb_array_elements(bet.value -> 'legs') as leg(value)
  ),
  existing_legs as (
    select
      bl.game_id,
      bl.market::text as market,
      bl.selection,
      bl.original_line,
      bl.adjusted_line,
      public.pick_effective_line(bl.original_line, bl.adjusted_line) as effective_line,
      public.format_pick_label(bl.selection, bl.leg_odds) as pick_label
    from public.bets b
    join public.bet_legs bl on bl.bet_id = b.id
    where b.user_id = auth.uid()
      and b.league_id = p_league_id
      and b.week_number = p_week_number
  )
  select format(
    '%s conflicts with existing pick %s because %s',
    submitted.pick_label,
    existing.pick_label,
    public.format_pick_conflict_reason(
      submitted.market,
      submitted.effective_line,
      existing.effective_line
    )
  )
  into existing_conflict_message
  from submitted_legs submitted
  join existing_legs existing
    on public.picks_directly_conflict(
      submitted.game_id,
      submitted.market,
      submitted.selection,
      submitted.original_line,
      submitted.adjusted_line,
      existing.game_id,
      existing.market,
      existing.selection,
      existing.original_line,
      existing.adjusted_line
    )
  limit 1;

  if existing_conflict_message is not null then
    raise exception '%', existing_conflict_message;
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

create or replace function public.submit_straight_bets(
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
  mixed_payload jsonb;
begin
  if jsonb_typeof(p_bets) <> 'array' then
    raise exception 'Bets payload must be an array';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bet_type', 'straight',
        'amount', value -> 'amount',
        'odds', value -> 'odds',
        'potential_payout', value -> 'potential_payout',
        'teaser_points', null,
        'is_lock', coalesce((value ->> 'is_lock')::boolean, false),
        'legs', jsonb_build_array(
          jsonb_build_object(
            'game_id', value -> 'game_id',
            'market', value -> 'market',
            'selection', value -> 'selection',
            'original_line', value -> 'original_line',
            'adjusted_line', value -> 'adjusted_line',
            'leg_odds', value -> 'leg_odds',
            'game_start_time', value -> 'game_start_time'
          )
        )
      )
    ),
    '[]'::jsonb
  )
  into mixed_payload
  from jsonb_array_elements(p_bets);

  return public.submit_bets(p_league_id, p_week_number, mixed_payload);
end;
$$;

grant execute on function public.submit_bets(uuid, integer, jsonb) to authenticated;
grant execute on function public.submit_straight_bets(uuid, integer, jsonb) to authenticated;
