create or replace function public.pick_conflict_kind(
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
returns text
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
  select case
    when not coalesce(p_left_game_id = p_right_game_id, false) then null
    when not coalesce(p_left_market = p_right_market, false) then null
    when left_side = right_side then null
    when p_left_market = 'moneyline' then 'direct_contradiction'
    when p_left_market = 'spread'
      and (
        left_line is null
        or right_line is null
        or abs(abs(left_line) - abs(right_line)) < 0.001
      ) then 'direct_contradiction'
    when p_left_market = 'over_under'
      and (
        left_line is null
        or right_line is null
        or abs(left_line - right_line) < 0.001
      ) then 'direct_contradiction'
    else null
  end
  from normalized
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
  select public.pick_conflict_kind(
    p_left_game_id,
    p_left_market,
    p_left_selection,
    p_left_original_line,
    p_left_adjusted_line,
    p_right_game_id,
    p_right_market,
    p_right_selection,
    p_right_original_line,
    p_right_adjusted_line
  ) is not null
$$;

create or replace function public.picks_are_duplicate_legs(
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
  select
    coalesce(p_left_game_id = p_right_game_id, false)
    and coalesce(p_left_market = p_right_market, false)
    and public.pick_conflict_side(p_left_market, p_left_selection)
      = public.pick_conflict_side(p_right_market, p_right_selection)
    and (
      public.pick_effective_line(p_left_original_line, p_left_adjusted_line) is null
      or public.pick_effective_line(p_right_original_line, p_right_adjusted_line) is null
      or abs(
        public.pick_effective_line(p_left_original_line, p_left_adjusted_line)
          - public.pick_effective_line(p_right_original_line, p_right_adjusted_line)
      ) < 0.001
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

drop index if exists public.bet_legs_unique_bet_market_side_line_idx;
