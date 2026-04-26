-- Lock of the Week and completed-season snapshots.

alter table public.bets
add column if not exists is_lock boolean not null default false;

create unique index if not exists bets_one_lock_per_user_week_idx
on public.bets (league_id, user_id, week_number)
where is_lock;

create index if not exists bets_league_week_lock_idx
on public.bets (league_id, week_number, is_lock);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_year integer not null,
  champion_user_id uuid references public.users(id) on delete set null,
  final_standings jsonb not null default '[]'::jsonb,
  awards jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default now(),
  unique (league_id, season_year)
);

create index if not exists seasons_league_id_idx on public.seasons(league_id);

alter table public.seasons enable row level security;

drop policy if exists "League members can read season snapshots" on public.seasons;
create policy "League members can read season snapshots"
on public.seasons for select
to authenticated
using (public.is_league_member(league_id));

drop policy if exists "Service role can manage season snapshots" on public.seasons;
create policy "Service role can manage season snapshots"
on public.seasons for all
to service_role
using (true)
with check (true);

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
  duplicate_game_count integer;
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
  into duplicate_game_count
  from (
    select leg ->> 'game_id' as game_id
    from jsonb_array_elements(p_bets) bet
    cross join jsonb_array_elements(bet.value -> 'legs') leg
    group by leg ->> 'game_id'
    having count(*) > 1
  ) duplicate_games;

  if duplicate_game_count > 0 then
    raise exception 'Only one selection is allowed per game across all bet types';
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

  select count(*)
  into existing_selection_count
  from public.bets b
  join public.bet_legs bl on bl.bet_id = b.id
  where b.user_id = auth.uid()
    and b.league_id = p_league_id
    and b.week_number = p_week_number
    and bl.game_id in (
      select leg ->> 'game_id'
      from jsonb_array_elements(p_bets) bet
      cross join jsonb_array_elements(bet.value -> 'legs') leg
    );

  if existing_selection_count > 0 then
    raise exception 'You already have a selection on one of these games';
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

  select s.user_id
  into champion_id
  from public.standings s
  where s.league_id = p_league_id
    and s.week_number = latest_week
  order by s.rank asc, s.total_profit desc, s.wins desc, s.user_id
  limit 1;

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
      when s.total_profit >= 0 then '+$' || to_char(s.total_profit, 'FM999999990.00')
      else '-$' || to_char(abs(s.total_profit), 'FM999999990.00')
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
    'award_label', 'Biggest Single Bet',
    'user_id', b.user_id,
    'metric', b.profit,
    'value_label', case
      when b.profit >= 0 then '+$' || to_char(b.profit, 'FM999999990.00')
      else '-$' || to_char(abs(b.profit), 'FM999999990.00')
    end,
    'bet_id', b.id,
    'is_lock', b.is_lock
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
    completed_at
  )
  values (
    p_league_id,
    league_record.season_year,
    champion_id,
    final_standings_json,
    awards_json,
    now()
  )
  on conflict (league_id, season_year)
  do update set
    champion_user_id = excluded.champion_user_id,
    final_standings = excluded.final_standings,
    awards = excluded.awards,
    completed_at = excluded.completed_at
  returning id into season_id;

  return season_id;
end;
$$;

create or replace function public.capture_completed_season_on_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'complete' and old.status is distinct from new.status then
    perform public.capture_completed_season(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists leagues_capture_completed_season on public.leagues;
create trigger leagues_capture_completed_season
after update of status on public.leagues
for each row
execute function public.capture_completed_season_on_status();

do $$
declare
  completed_league record;
begin
  for completed_league in
    select id from public.leagues where status = 'complete'
  loop
    perform public.capture_completed_season(completed_league.id);
  end loop;
end $$;

revoke execute on function public.capture_completed_season(uuid) from anon, authenticated;
grant execute on function public.capture_completed_season(uuid) to service_role;
