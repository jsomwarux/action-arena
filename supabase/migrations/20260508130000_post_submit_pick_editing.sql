create or replace function public.update_submitted_bet(
  p_bet_id uuid,
  p_odds integer,
  p_potential_payout numeric,
  p_teaser_points numeric,
  p_legs jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_bet public.bets%rowtype;
  submitted_leg_count integer;
  existing_leg_count integer;
  submitted_conflict_message text;
  existing_conflict_message text;
  leg_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_bet
  from public.bets
  where id = p_bet_id;

  if target_bet.id is null then
    raise exception 'Pick not found';
  end if;

  if target_bet.user_id <> auth.uid() then
    raise exception 'You can only edit your own picks';
  end if;

  if target_bet.result <> 'pending' then
    raise exception 'Settled picks can no longer be edited';
  end if;

  if jsonb_typeof(p_legs) <> 'array' then
    raise exception 'Edited pick legs must be an array';
  end if;

  select count(*) into submitted_leg_count from jsonb_array_elements(p_legs);
  select count(*) into existing_leg_count from public.bet_legs where bet_id = p_bet_id;

  if submitted_leg_count <> existing_leg_count then
    raise exception 'Pick edits must keep the same number of legs';
  end if;

  if exists (
    select 1
    from public.bet_legs bl
    where bl.bet_id = p_bet_id
      and (bl.locked or bl.game_start_time <= now())
  ) then
    raise exception 'This pick is locked because one of its games has started';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_legs) leg
    where not exists (
      select 1
      from public.bet_legs bl
      where bl.bet_id = p_bet_id
        and bl.id = (leg.value ->> 'id')::uuid
    )
  ) then
    raise exception 'Edited pick legs do not match this pick';
  end if;

  if target_bet.bet_type = 'straight' then
    if submitted_leg_count <> 1 then
      raise exception 'Straight picks must have exactly one leg';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_legs) leg
      join public.bet_legs bl
        on bl.id = (leg.value ->> 'id')::uuid
       and bl.bet_id = p_bet_id
      where bl.game_id <> leg.value ->> 'game_id'
         or bl.market::text <> leg.value ->> 'market'
    ) then
      raise exception 'Straight pick edits must keep the same game and market';
    end if;

    if p_teaser_points is not null then
      raise exception 'Only teasers can have teaser points';
    end if;
  elsif target_bet.bet_type = 'parlay' then
    if submitted_leg_count < 2 or submitted_leg_count > 6 then
      raise exception 'Parlays must have 2 to 6 legs';
    end if;

    if p_teaser_points is not null then
      raise exception 'Only teasers can have teaser points';
    end if;

    if p_potential_payout > 500 then
      raise exception 'Parlay payout must be capped at $500';
    end if;
  elsif target_bet.bet_type = 'teaser' then
    if submitted_leg_count < 2 or submitted_leg_count > 4 then
      raise exception 'Teasers must have 2 to 4 legs';
    end if;

    if p_teaser_points not in (6, 6.5, 7) then
      raise exception 'Invalid teaser point size';
    end if;

    if p_teaser_points is distinct from target_bet.teaser_points then
      raise exception 'Teaser point size cannot be changed after submit';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_legs) leg
      where leg.value ->> 'market' = 'moneyline'
    ) then
      raise exception 'Teasers can only use spreads and totals';
    end if;
  else
    raise exception 'Unsupported pick type';
  end if;

  if p_odds = 0 then
    raise exception 'Pick odds cannot be zero';
  end if;

  if p_potential_payout <= 0 then
    raise exception 'Potential payout must be positive';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_legs) leg
    where (leg.value ->> 'game_start_time')::timestamptz <= now()
  ) then
    raise exception 'One selected game has already started';
  end if;

  with submitted_legs as (
    select
      row_number() over () as leg_index,
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
    from jsonb_array_elements(p_legs) as leg(value)
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
    from jsonb_array_elements(p_legs) as leg(value)
  ),
  other_legs as (
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
      and b.league_id = target_bet.league_id
      and b.week_number = target_bet.week_number
      and b.id <> p_bet_id
  )
  select format(
    '%s conflicts with existing pick %s because %s',
    submitted.pick_label,
    other.pick_label,
    public.format_pick_conflict_reason(
      submitted.market,
      submitted.effective_line,
      other.effective_line
    )
  )
  into existing_conflict_message
  from submitted_legs submitted
  join other_legs other
    on public.picks_directly_conflict(
      submitted.game_id,
      submitted.market,
      submitted.selection,
      submitted.original_line,
      submitted.adjusted_line,
      other.game_id,
      other.market,
      other.selection,
      other.original_line,
      other.adjusted_line
    )
  limit 1;

  if existing_conflict_message is not null then
    raise exception '%', existing_conflict_message;
  end if;

  update public.bets
  set odds = p_odds,
      potential_payout = p_potential_payout,
      teaser_points = p_teaser_points,
      result = 'pending',
      profit = null
  where id = p_bet_id;

  for leg_item in select value from jsonb_array_elements(p_legs) loop
    update public.bet_legs
    set game_id = leg_item ->> 'game_id',
        market = (leg_item ->> 'market')::public.bet_market,
        selection = leg_item ->> 'selection',
        original_line = nullif(leg_item ->> 'original_line', '')::numeric,
        adjusted_line = nullif(leg_item ->> 'adjusted_line', '')::numeric,
        leg_odds = (leg_item ->> 'leg_odds')::integer,
        result = 'pending',
        game_start_time = (leg_item ->> 'game_start_time')::timestamptz,
        locked = false
    where id = (leg_item ->> 'id')::uuid
      and bet_id = p_bet_id;
  end loop;

  return p_bet_id;
end;
$$;

grant execute on function public.update_submitted_bet(uuid, integer, numeric, numeric, jsonb) to authenticated;
