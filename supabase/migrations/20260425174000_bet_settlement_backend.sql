alter table public.weekly_matchups
  alter column away_user_id drop not null;

alter table public.weekly_matchups
  drop constraint if exists weekly_matchups_check;

alter table public.weekly_matchups
  drop constraint if exists weekly_matchups_league_id_week_number_home_user_id_away_user_id_key;

alter table public.weekly_matchups
  add constraint weekly_matchups_distinct_users_check
  check (away_user_id is null or home_user_id <> away_user_id);

create unique index if not exists weekly_matchups_regular_pair_unique_idx
on public.weekly_matchups (
  league_id,
  week_number,
  least(home_user_id, away_user_id),
  greatest(home_user_id, away_user_id)
)
where away_user_id is not null;

create unique index if not exists weekly_matchups_bye_unique_idx
on public.weekly_matchups (league_id, week_number, home_user_id)
where away_user_id is null;

create or replace function public.american_to_decimal(p_odds integer)
returns numeric
language sql
immutable
strict
as $$
  select case
    when p_odds > 0 then (p_odds::numeric / 100) + 1
    else (100::numeric / abs(p_odds)) + 1
  end;
$$;

create or replace function public.decimal_to_american(p_decimal_odds numeric)
returns integer
language sql
immutable
strict
as $$
  select case
    when p_decimal_odds >= 2 then round((p_decimal_odds - 1) * 100)::integer
    else round(-100 / (p_decimal_odds - 1))::integer
  end;
$$;

create or replace function public.payout_from_american(p_amount numeric, p_odds integer)
returns numeric
language sql
immutable
strict
as $$
  select round(p_amount * public.american_to_decimal(p_odds), 2);
$$;

create or replace function public.teaser_odds_for(
  p_leg_count integer,
  p_teaser_points numeric
)
returns integer
language sql
immutable
as $$
  select case
    when p_leg_count = 2 and p_teaser_points = 6 then -110
    when p_leg_count = 2 and p_teaser_points = 6.5 then -120
    when p_leg_count = 2 and p_teaser_points = 7 then -130
    when p_leg_count = 3 and p_teaser_points = 6 then 150
    when p_leg_count = 3 and p_teaser_points = 6.5 then 130
    when p_leg_count = 3 and p_teaser_points = 7 then 110
    when p_leg_count = 4 and p_teaser_points = 6 then 250
    when p_leg_count = 4 and p_teaser_points = 6.5 then 200
    when p_leg_count = 4 and p_teaser_points = 7 then 160
    else null
  end;
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

    if normalized_selection = normalized_home_team then
      margin := p_home_score - p_away_score + p_adjusted_line;
    elsif normalized_selection = normalized_away_team then
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

    if normalized_selection = 'over' then
      if total_points > p_adjusted_line then
        return 'win';
      elsif total_points < p_adjusted_line then
        return 'loss';
      end if;

      return 'push';
    end if;

    if normalized_selection = 'under' then
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

create or replace function public.generate_h2h_regular_schedule(p_league_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league public.leagues;
  member_ids uuid[];
  rotation uuid[];
  member_count integer;
  team_count integer;
  week_number integer;
  pair_index integer;
  left_user_id uuid;
  right_user_id uuid;
  home_user_id uuid;
  away_user_id uuid;
  inserted_count integer := 0;
begin
  select * into target_league from public.leagues where id = p_league_id;

  if target_league.id is null then
    raise exception 'League not found';
  end if;

  if target_league.type <> 'h2h' then
    return 0;
  end if;

  if exists (
    select 1
    from public.weekly_matchups
    where league_id = p_league_id
      and week_number between 1 and 14
      and (home_profit is not null or away_profit is not null or winner_id is not null)
  ) then
    raise exception 'Regular-season matchups have already been resolved for this league';
  end if;

  select array_agg(lm.user_id order by lm.joined_at, lm.user_id)
  into member_ids
  from public.league_members lm
  where lm.league_id = p_league_id;

  member_count := coalesce(array_length(member_ids, 1), 0);

  if member_count < 2 then
    raise exception 'At least two members are required to activate a head-to-head league';
  end if;

  delete from public.weekly_matchups
  where league_id = p_league_id
    and week_number between 1 and 14;

  if mod(member_count, 2) = 1 then
    member_ids := member_ids || null::uuid;
  end if;

  rotation := member_ids;
  team_count := array_length(rotation, 1);

  for week_number in 1..14 loop
    for pair_index in 1..(team_count / 2) loop
      left_user_id := rotation[pair_index];
      right_user_id := rotation[team_count - pair_index + 1];

      if left_user_id is null or right_user_id is null then
        home_user_id := coalesce(left_user_id, right_user_id);
        away_user_id := null;
      elsif mod(week_number + pair_index, 2) = 0 then
        home_user_id := left_user_id;
        away_user_id := right_user_id;
      else
        home_user_id := right_user_id;
        away_user_id := left_user_id;
      end if;

      insert into public.weekly_matchups (
        league_id,
        week_number,
        home_user_id,
        away_user_id,
        is_playoff,
        is_championship
      )
      values (
        p_league_id,
        week_number,
        home_user_id,
        away_user_id,
        false,
        false
      );

      inserted_count := inserted_count + 1;
    end loop;

    if team_count > 2 then
      rotation := array[rotation[1], rotation[team_count]] || rotation[2:(team_count - 1)];
    end if;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.activate_league_and_generate_schedule(p_league_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league public.leagues;
  matchup_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_league_commissioner(p_league_id, auth.uid()) then
    raise exception 'Only the commissioner can activate this league';
  end if;

  select * into target_league from public.leagues where id = p_league_id;

  if target_league.id is null then
    raise exception 'League not found';
  end if;

  if target_league.status <> 'drafting' then
    raise exception 'Only drafting leagues can be activated';
  end if;

  if target_league.type = 'h2h' then
    matchup_count := public.generate_h2h_regular_schedule(p_league_id);
  end if;

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
    lm.league_id,
    lm.user_id,
    1,
    0,
    0,
    0,
    0,
    0,
    (rank() over (order by lm.joined_at, lm.user_id))::integer
  from public.league_members lm
  where lm.league_id = p_league_id
  on conflict (league_id, user_id, week_number) do update
    set wins = excluded.wins,
        losses = excluded.losses,
        ties = excluded.ties,
        weekly_profit = excluded.weekly_profit,
        total_profit = excluded.total_profit,
        rank = excluded.rank;

  update public.leagues
  set status = 'active',
      current_week = 1
  where id = p_league_id;

  return matchup_count;
end;
$$;

create or replace function public.generate_playoff_schedule(
  p_league_id uuid,
  p_week_number integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league public.leagues;
  resolved_week integer;
  participant_ids uuid[];
  participant_count integer;
  bracket_size integer;
  participant_limit integer;
  seed_a integer;
  seed_b integer;
  pair_index integer;
  start_index integer;
  end_index integer;
  home_user_id uuid;
  away_user_id uuid;
  inserted_count integer := 0;
begin
  select * into target_league from public.leagues where id = p_league_id;

  if target_league.id is null or target_league.type <> 'h2h' then
    return 0;
  end if;

  resolved_week := coalesce(p_week_number, target_league.current_week);

  if resolved_week not between 15 and 17 then
    return 0;
  end if;

  if exists (
    select 1
    from public.weekly_matchups
    where league_id = p_league_id
      and week_number = resolved_week
      and is_playoff = true
  ) then
    select count(*)
    into inserted_count
    from public.weekly_matchups
    where league_id = p_league_id
      and week_number = resolved_week
      and is_playoff = true;

    return inserted_count;
  end if;

  if resolved_week = 15 then
    select array_agg(seed.user_id order by seed.rank, seed.total_profit desc, seed.user_id)
    into participant_ids
    from (
      select s.user_id, s.rank, s.total_profit
      from public.standings s
      where s.league_id = p_league_id
        and s.week_number = 14
      order by s.rank, s.total_profit desc, s.user_id
      limit 8
    ) seed;

    participant_count := coalesce(array_length(participant_ids, 1), 0);

    if participant_count < 2 then
      return 0;
    end if;

    if participant_count <= 2 then
      bracket_size := 2;
    elsif participant_count <= 4 then
      bracket_size := 4;
    else
      bracket_size := 8;
    end if;

    participant_limit := least(participant_count, bracket_size);

    for pair_index in 1..(bracket_size / 2) loop
      if bracket_size = 8 then
        seed_a := case pair_index when 1 then 1 when 2 then 4 when 3 then 3 else 2 end;
        seed_b := case pair_index when 1 then 8 when 2 then 5 when 3 then 6 else 7 end;
      elsif bracket_size = 4 then
        seed_a := pair_index;
        seed_b := 5 - pair_index;
      else
        seed_a := 1;
        seed_b := 2;
      end if;

      if seed_a > participant_limit then
        continue;
      end if;

      home_user_id := participant_ids[seed_a];
      away_user_id := case
        when seed_b <= participant_limit then participant_ids[seed_b]
        else null
      end;

      insert into public.weekly_matchups (
        league_id,
        week_number,
        home_user_id,
        away_user_id,
        winner_id,
        is_playoff,
        is_championship
      )
      values (
        p_league_id,
        resolved_week,
        home_user_id,
        away_user_id,
        case when away_user_id is null then home_user_id else null end,
        true,
        bracket_size = 2
      );

      inserted_count := inserted_count + 1;
    end loop;

    return inserted_count;
  end if;

  if not exists (
    select 1
    from public.weekly_matchups
    where league_id = p_league_id
      and week_number = resolved_week - 1
      and is_playoff = true
  ) then
    return 0;
  end if;

  if exists (
    select 1
    from public.weekly_matchups
    where league_id = p_league_id
      and week_number = resolved_week - 1
      and is_playoff = true
      and winner_id is null
  ) then
    return 0;
  end if;

  select array_agg(winners.user_id order by winners.rank, winners.user_id)
  into participant_ids
  from (
    select distinct wm.winner_id as user_id, coalesce(s.rank, 999) as rank
    from public.weekly_matchups wm
    left join public.standings s
      on s.league_id = wm.league_id
      and s.user_id = wm.winner_id
      and s.week_number = 14
    where wm.league_id = p_league_id
      and wm.week_number = resolved_week - 1
      and wm.is_playoff = true
      and wm.winner_id is not null
  ) winners;

  participant_count := coalesce(array_length(participant_ids, 1), 0);

  if participant_count < 2 then
    return 0;
  end if;

  if mod(participant_count, 2) = 1 then
    insert into public.weekly_matchups (
      league_id,
      week_number,
      home_user_id,
      away_user_id,
      winner_id,
      is_playoff,
      is_championship
    )
    values (
      p_league_id,
      resolved_week,
      participant_ids[1],
      null,
      participant_ids[1],
      true,
      false
    );

    inserted_count := inserted_count + 1;
    start_index := 2;
  else
    start_index := 1;
  end if;

  end_index := participant_count;

  while start_index < end_index loop
    home_user_id := participant_ids[start_index];
    away_user_id := participant_ids[end_index];

    insert into public.weekly_matchups (
      league_id,
      week_number,
      home_user_id,
      away_user_id,
      is_playoff,
      is_championship
    )
    values (
      p_league_id,
      resolved_week,
      home_user_id,
      away_user_id,
      true,
      participant_count <= 2
    );

    inserted_count := inserted_count + 1;
    start_index := start_index + 1;
    end_index := end_index - 1;
  end loop;

  return inserted_count;
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
  bye_profit numeric(10,2);
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
        select coalesce(
          percentile_cont(0.5) within group (order by weekly_profit::double precision),
          0
        )::numeric(10,2)
        into bye_profit
        from weekly_profit_totals
        where user_id <> matchup_record.home_user_id;

        update public.weekly_matchups
        set home_profit = bye_profit,
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

create or replace function public.resolve_ready_weekly_standings(
  p_league_id uuid default null,
  p_week_number integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_week record;
  resolved_count integer := 0;
begin
  for target_week in
    select distinct b.league_id, b.week_number
    from public.bets b
    where (p_league_id is null or b.league_id = p_league_id)
      and (p_week_number is null or b.week_number = p_week_number)
      and exists (
        select 1
        from public.bets bx
        where bx.league_id = b.league_id
          and bx.week_number = b.week_number
      )
      and not exists (
        select 1
        from public.bets bp
        where bp.league_id = b.league_id
          and bp.week_number = b.week_number
          and bp.result = 'pending'
      )
  loop
    perform public.resolve_league_week(target_week.league_id, target_week.week_number);
    resolved_count := resolved_count + 1;
  end loop;

  return resolved_count;
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
  payout numeric(10,2);
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
        bl.bet_id,
        b.league_id,
        b.week_number,
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
      join public.bets b on b.id = bl.bet_id
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
        remaining_leg_count := 0;
        combined_decimal := 1;

        for leg_record in
          select *
          from public.bet_legs
          where bet_id = bet_record.id
            and result <> 'push'
        loop
          remaining_leg_count := remaining_leg_count + 1;
          combined_decimal := combined_decimal * public.american_to_decimal(leg_record.leg_odds);
        end loop;

        if remaining_leg_count = 0 then
          computed_result := 'push';
          computed_profit := 0;
        else
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

revoke execute on function public.generate_h2h_regular_schedule(uuid) from anon, authenticated;
revoke execute on function public.generate_playoff_schedule(uuid, integer) from anon, authenticated;
revoke execute on function public.resolve_league_week(uuid, integer) from anon, authenticated;
revoke execute on function public.resolve_ready_weekly_standings(uuid, integer) from anon, authenticated;
revoke execute on function public.settle_completed_scores(jsonb) from anon, authenticated;

grant execute on function public.activate_league_and_generate_schedule(uuid) to authenticated;
grant execute on function public.settle_completed_scores(jsonb) to service_role;
grant execute on function public.resolve_ready_weekly_standings(uuid, integer) to service_role;
