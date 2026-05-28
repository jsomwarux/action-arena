begin;

create temporary table settlement_test_results (
  name text primary key,
  passed boolean not null,
  detail text not null default ''
) on commit drop;

create temporary table test_users on commit drop as
select id, row_number() over (order by created_at, id) as ordinal
from public.users
order by created_at, id
limit 4;

do $$
begin
  if (select count(*) from test_users) < 4 then
    raise exception 'Settlement tests require at least 4 public.users rows';
  end if;
end;
$$;

create temporary table test_bets (
  label text primary key,
  id uuid not null
) on commit drop;

create temporary table test_scores (
  game_id text primary key,
  home_team text not null,
  away_team text not null,
  home_score integer not null,
  away_score integer not null
) on commit drop;

create or replace function pg_temp.test_user(p_ordinal integer)
returns uuid
language sql
stable
as $$
  select id from test_users where ordinal = p_ordinal
$$;

create or replace function pg_temp.record_result(
  p_name text,
  p_passed boolean,
  p_detail text default ''
)
returns void
language plpgsql
as $$
begin
  insert into settlement_test_results (name, passed, detail)
  values (p_name, coalesce(p_passed, false), coalesce(p_detail, ''))
  on conflict (name) do update
    set passed = excluded.passed,
        detail = excluded.detail;
end;
$$;

create or replace function pg_temp.add_score(
  p_game_id text,
  p_home_score integer,
  p_away_score integer,
  p_home_team text default 'Home Team',
  p_away_team text default 'Away Team'
)
returns void
language sql
as $$
  insert into test_scores (game_id, home_team, away_team, home_score, away_score)
  values (p_game_id, p_home_team, p_away_team, p_home_score, p_away_score)
  on conflict (game_id) do update
    set home_team = excluded.home_team,
        away_team = excluded.away_team,
        home_score = excluded.home_score,
        away_score = excluded.away_score
$$;

create or replace function pg_temp.add_bet(
  p_label text,
  p_league_id uuid,
  p_user_id uuid,
  p_bet_type text,
  p_amount numeric,
  p_odds integer,
  p_teaser_points numeric default null,
  p_is_lock boolean default false
)
returns uuid
language plpgsql
as $$
declare
  new_bet_id uuid;
begin
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
    p_user_id,
    p_league_id,
    1,
    p_bet_type::public.bet_type,
    p_amount,
    p_odds,
    p_amount,
    'pending',
    p_teaser_points,
    p_is_lock
  )
  returning id into new_bet_id;

  insert into test_bets (label, id)
  values (p_label, new_bet_id);

  return new_bet_id;
end;
$$;

create or replace function pg_temp.add_leg(
  p_bet_label text,
  p_game_id text,
  p_market text,
  p_selection text,
  p_original_line numeric,
  p_adjusted_line numeric,
  p_leg_odds integer
)
returns void
language plpgsql
as $$
begin
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
    (select id from test_bets where label = p_bet_label),
    p_game_id,
    p_market::public.bet_market,
    p_selection,
    p_original_line,
    p_adjusted_line,
    p_leg_odds,
    'pending',
    now() - interval '1 day',
    false
  );
end;
$$;

create or replace function pg_temp.assert_bet(
  p_name text,
  p_bet_label text,
  p_expected_result public.bet_result,
  p_expected_profit numeric
)
returns void
language plpgsql
as $$
declare
  actual_result public.bet_result;
  actual_profit numeric;
begin
  select b.result, b.profit
  into actual_result, actual_profit
  from public.bets b
  join test_bets tb on tb.id = b.id
  where tb.label = p_bet_label;

  perform pg_temp.record_result(
    p_name,
    actual_result = p_expected_result
      and abs(coalesce(actual_profit, 999999) - p_expected_profit) < 0.005,
    format(
      'expected %s/%s, got %s/%s',
      p_expected_result,
      p_expected_profit,
      coalesce(actual_result::text, 'null'),
      coalesce(actual_profit::text, 'null')
    )
  );
end;
$$;

create or replace function pg_temp.assert_straight_bet_economics(
  p_name text,
  p_bet_label text
)
returns void
language plpgsql
as $$
declare
  bet_record record;
  expected_profit numeric;
  expected_outcome numeric;
  actual_outcome numeric;
  lock_multiplier numeric := 1;
begin
  select b.amount, b.is_lock, b.profit, b.result, bl.leg_odds
  into bet_record
  from public.bets b
  join test_bets tb on tb.id = b.id
  join public.bet_legs bl on bl.bet_id = b.id
  where tb.label = p_bet_label
  limit 1;

  if bet_record.is_lock and bet_record.result in ('win', 'loss') then
    lock_multiplier := 1.5;
  end if;

  if bet_record.result = 'win' then
    expected_profit := round(
      (public.payout_from_american(bet_record.amount, bet_record.leg_odds) - bet_record.amount)
        * lock_multiplier,
      2
    );
    expected_outcome := bet_record.amount + expected_profit;
    actual_outcome := bet_record.amount + coalesce(bet_record.profit, 0);
  elsif bet_record.result = 'loss' then
    expected_profit := round(-bet_record.amount * lock_multiplier, 2);
    expected_outcome := 0;
    actual_outcome := 0;
  elsif bet_record.result = 'push' then
    expected_profit := 0;
    expected_outcome := bet_record.amount;
    actual_outcome := bet_record.amount;
  else
    expected_profit := null;
    expected_outcome := null;
    actual_outcome := null;
  end if;

  perform pg_temp.record_result(
    p_name,
    bet_record.result <> 'pending'
      and expected_profit is not null
      and abs(coalesce(bet_record.profit, 999999) - expected_profit) < 0.005
      and abs(coalesce(actual_outcome, 999999) - expected_outcome) < 0.005
      and abs((actual_outcome - bet_record.amount) - coalesce(bet_record.profit, 999999)) < 0.005,
    format(
      'amount=%s odds=%s result=%s expected outcome/profit=%s/%s, got outcome/profit=%s/%s',
      coalesce(bet_record.amount::text, 'null'),
      coalesce(bet_record.leg_odds::text, 'null'),
      coalesce(bet_record.result::text, 'null'),
      coalesce(expected_outcome::text, 'null'),
      coalesce(expected_profit::text, 'null'),
      coalesce(actual_outcome::text, 'null'),
      coalesce(bet_record.profit::text, 'null')
    )
  );
end;
$$;

create or replace function pg_temp.assert_leg_eval(
  p_name text,
  p_market text,
  p_selection text,
  p_adjusted_line numeric,
  p_home_score integer,
  p_away_score integer,
  p_expected_result public.bet_result,
  p_home_team text default 'Home Team',
  p_away_team text default 'Away Team'
)
returns void
language plpgsql
as $$
declare
  actual_result public.bet_result;
begin
  actual_result := public.evaluate_bet_leg(
    p_market::public.bet_market,
    p_selection,
    p_adjusted_line,
    p_home_team,
    p_away_team,
    p_home_score,
    p_away_score
  );

  perform pg_temp.record_result(
    p_name,
    actual_result = p_expected_result,
    format('expected %s, got %s', p_expected_result, coalesce(actual_result::text, 'null'))
  );
end;
$$;

create or replace function pg_temp.assert_matchup(
  p_name text,
  p_matchup_id uuid,
  p_expected_home_profit numeric,
  p_expected_away_profit numeric,
  p_expected_winner uuid
)
returns void
language plpgsql
as $$
declare
  actual_home_profit numeric;
  actual_away_profit numeric;
  actual_winner uuid;
begin
  select home_profit, away_profit, winner_id
  into actual_home_profit, actual_away_profit, actual_winner
  from public.weekly_matchups
  where id = p_matchup_id;

  perform pg_temp.record_result(
    p_name,
    abs(coalesce(actual_home_profit, 999999) - p_expected_home_profit) < 0.005
      and abs(coalesce(actual_away_profit, 999999) - p_expected_away_profit) < 0.005
      and actual_winner is not distinct from p_expected_winner,
    format(
      'expected home=%s away=%s winner=%s, got home=%s away=%s winner=%s',
      p_expected_home_profit,
      p_expected_away_profit,
      coalesce(p_expected_winner::text, 'null'),
      coalesce(actual_home_profit::text, 'null'),
      coalesce(actual_away_profit::text, 'null'),
      coalesce(actual_winner::text, 'null')
    )
  );
end;
$$;

create or replace function pg_temp.assert_standing(
  p_name text,
  p_league_id uuid,
  p_user_id uuid,
  p_expected_weekly_profit numeric,
  p_expected_total_profit numeric,
  p_expected_wins integer,
  p_expected_losses integer,
  p_expected_ties integer,
  p_expected_rank integer
)
returns void
language plpgsql
as $$
declare
  row_record public.standings;
begin
  select *
  into row_record
  from public.standings
  where league_id = p_league_id
    and user_id = p_user_id
    and week_number = 1;

  perform pg_temp.record_result(
    p_name,
    row_record.id is not null
      and abs(row_record.weekly_profit - p_expected_weekly_profit) < 0.005
      and abs(row_record.total_profit - p_expected_total_profit) < 0.005
      and row_record.wins = p_expected_wins
      and row_record.losses = p_expected_losses
      and row_record.ties = p_expected_ties
      and (p_expected_rank is null or row_record.rank = p_expected_rank),
    format(
      'expected weekly=%s total=%s W-L-T=%s-%s-%s rank=%s, got weekly=%s total=%s W-L-T=%s-%s-%s rank=%s',
      p_expected_weekly_profit,
      p_expected_total_profit,
      p_expected_wins,
      p_expected_losses,
      p_expected_ties,
      p_expected_rank,
      coalesce(row_record.weekly_profit::text, 'null'),
      coalesce(row_record.total_profit::text, 'null'),
      coalesce(row_record.wins::text, 'null'),
      coalesce(row_record.losses::text, 'null'),
      coalesce(row_record.ties::text, 'null'),
      coalesce(row_record.rank::text, 'null')
    )
  );
end;
$$;

select pg_temp.add_score('settle_home_win', 24, 17);
select pg_temp.add_score('settle_away_win', 17, 24);
select pg_temp.add_score('settle_tie_game', 21, 21);
select pg_temp.add_score('settle_spread_total_push', 27, 24);
select pg_temp.add_score('settle_teaser_margin', 24, 21);
select pg_temp.add_score('settle_teaser_size', 20, 20);
select pg_temp.add_score('settle_teaser_second_leg', 17, 10);
select pg_temp.add_score('settle_cap_1', 30, 10);
select pg_temp.add_score('settle_cap_2', 31, 10);
select pg_temp.add_score('settle_cap_3', 32, 10);
select pg_temp.add_score('settle_cap_4', 33, 10);
select pg_temp.add_score('settle_half_spread_win', 31, 21);
select pg_temp.add_score('settle_half_spread_loss', 32, 21);
select pg_temp.add_score('settle_half_total_loss', 24, 21);
select pg_temp.add_score('settle_whole_total_push', 24, 23);

select pg_temp.assert_leg_eval(
  'half-point away spread close cover is win',
  'spread',
  'Away Team +10.5',
  10.5,
  31,
  21,
  'win'
);
select pg_temp.assert_leg_eval(
  'half-point away spread close miss is loss',
  'spread',
  'Away Team +10.5',
  10.5,
  32,
  21,
  'loss'
);
select pg_temp.assert_leg_eval(
  'whole-number spread exact margin is push',
  'spread',
  'Away Team +10',
  10,
  31,
  21,
  'push'
);
select pg_temp.assert_leg_eval(
  'Titans +10.5 lost by 17 is loss',
  'spread',
  'Tennessee Titans +10.5',
  10.5,
  31,
  14,
  'loss',
  'Houston Texans',
  'Tennessee Titans'
);
select pg_temp.assert_leg_eval(
  'half-point over total cannot push',
  'over_under',
  'Over 47.5',
  47.5,
  24,
  23,
  'loss'
);
select pg_temp.assert_leg_eval(
  'half-point under total cannot push',
  'over_under',
  'Under 47.5',
  47.5,
  24,
  23,
  'win'
);
select pg_temp.assert_leg_eval(
  'whole-number total exact score is push',
  'over_under',
  'Over 47',
  47,
  24,
  23,
  'push'
);

insert into public.leagues (
  id,
  name,
  commissioner_id,
  type,
  visibility,
  invite_code,
  max_members,
  sport,
  season_year,
  current_week,
  status
)
values
  ('00000000-0000-0000-0000-000000002001'::uuid, 'Settlement Rules Test', pg_temp.test_user(1), 'cumulative', 'private', 'TS2001', 4, 'nfl', 2026, 1, 'active'),
  ('00000000-0000-0000-0000-000000002002'::uuid, 'Settlement Cumulative Test', pg_temp.test_user(1), 'cumulative', 'private', 'TS2002', 4, 'nfl', 2026, 1, 'active'),
  ('00000000-0000-0000-0000-000000002003'::uuid, 'Settlement H2H Winner Test', pg_temp.test_user(1), 'h2h', 'private', 'TS2003', 4, 'nfl', 2026, 1, 'active'),
  ('00000000-0000-0000-0000-000000002004'::uuid, 'Settlement H2H Tie Test', pg_temp.test_user(1), 'h2h', 'private', 'TS2004', 4, 'nfl', 2026, 1, 'active');

insert into public.league_members (league_id, user_id, team_name)
select league_id, user_id, team_name
from (
  values
    ('00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'Rules User 1'),
    ('00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(2), 'Rules User 2'),
    ('00000000-0000-0000-0000-000000002002'::uuid, pg_temp.test_user(1), 'Cumulative User 1'),
    ('00000000-0000-0000-0000-000000002002'::uuid, pg_temp.test_user(2), 'Cumulative User 2'),
    ('00000000-0000-0000-0000-000000002002'::uuid, pg_temp.test_user(3), 'Cumulative User 3'),
    ('00000000-0000-0000-0000-000000002003'::uuid, pg_temp.test_user(1), 'H2H Home'),
    ('00000000-0000-0000-0000-000000002003'::uuid, pg_temp.test_user(2), 'H2H Away'),
    ('00000000-0000-0000-0000-000000002004'::uuid, pg_temp.test_user(1), 'H2H Tie Home'),
    ('00000000-0000-0000-0000-000000002004'::uuid, pg_temp.test_user(2), 'H2H Tie Away')
) as members(league_id, user_id, team_name);

insert into public.weekly_matchups (
  id,
  league_id,
  week_number,
  home_user_id,
  away_user_id,
  is_playoff,
  is_championship
)
values
  ('00000000-0000-0000-0000-000000002013'::uuid, '00000000-0000-0000-0000-000000002003'::uuid, 1, pg_temp.test_user(1), pg_temp.test_user(2), false, false),
  ('00000000-0000-0000-0000-000000002014'::uuid, '00000000-0000-0000-0000-000000002004'::uuid, 1, pg_temp.test_user(1), pg_temp.test_user(2), false, false);

select pg_temp.add_bet('straight_win', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 10, 100);
select pg_temp.add_leg('straight_win', 'settle_home_win', 'moneyline', 'Home Team', null, null, 100);

select pg_temp.add_bet('straight_loss', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 10, 100);
select pg_temp.add_leg('straight_loss', 'settle_home_win', 'moneyline', 'Away Team', null, null, 100);

select pg_temp.add_bet('straight_push', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 10, -110);
select pg_temp.add_leg('straight_push', 'settle_spread_total_push', 'spread', 'Away Team +3', 3, 3, -110);

select pg_temp.add_bet('straight_half_spread_win', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 20, -110);
select pg_temp.add_leg('straight_half_spread_win', 'settle_half_spread_win', 'spread', 'Away Team +10.5', 10.5, 10.5, -110);

select pg_temp.add_bet('straight_half_spread_loss', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 20, -110);
select pg_temp.add_leg('straight_half_spread_loss', 'settle_half_spread_loss', 'spread', 'Away Team +10.5', 10.5, 10.5, -110);

select pg_temp.add_bet('straight_half_total_loss', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 20, -110);
select pg_temp.add_leg('straight_half_total_loss', 'settle_half_total_loss', 'over_under', 'Under 44.5', 44.5, 44.5, -110);

select pg_temp.add_bet('straight_whole_total_push', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 20, -110);
select pg_temp.add_leg('straight_whole_total_push', 'settle_whole_total_push', 'over_under', 'Over 47', 47, 47, -110);

select pg_temp.add_bet('lock_win', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'straight', 10, 100, null, true);
select pg_temp.add_leg('lock_win', 'settle_home_win', 'moneyline', 'Home Team', null, null, 100);

select pg_temp.add_bet('lock_loss', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(2), 'straight', 10, 100, null, true);
select pg_temp.add_leg('lock_loss', 'settle_home_win', 'moneyline', 'Away Team', null, null, 100);

select pg_temp.add_bet('parlay_all_win', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'parlay', 20, 300);
select pg_temp.add_leg('parlay_all_win', 'settle_home_win', 'moneyline', 'Home Team', null, null, 100);
select pg_temp.add_leg('parlay_all_win', 'settle_away_win', 'moneyline', 'Away Team', null, null, 100);

select pg_temp.add_bet('parlay_one_loss', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'parlay', 20, 300);
select pg_temp.add_leg('parlay_one_loss', 'settle_home_win', 'moneyline', 'Home Team', null, null, 100);
select pg_temp.add_leg('parlay_one_loss', 'settle_home_win', 'moneyline', 'Away Team', null, null, 100);

select pg_temp.add_bet('parlay_one_push_recalculation', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'parlay', 20, 300);
select pg_temp.add_leg('parlay_one_push_recalculation', 'settle_spread_total_push', 'spread', 'Away Team +3', 3, 3, -110);
select pg_temp.add_leg('parlay_one_push_recalculation', 'settle_home_win', 'moneyline', 'Home Team', null, null, 100);
select pg_temp.add_leg('parlay_one_push_recalculation', 'settle_away_win', 'moneyline', 'Away Team', null, null, 100);

select pg_temp.add_bet('parlay_all_push', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'parlay', 20, 300);
select pg_temp.add_leg('parlay_all_push', 'settle_spread_total_push', 'spread', 'Away Team +3', 3, 3, -110);
select pg_temp.add_leg('parlay_all_push', 'settle_spread_total_push', 'over_under', 'Over 51', 51, 51, -110);

select pg_temp.add_bet('parlay_push_to_single_leg', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'parlay', 20, 100);
select pg_temp.add_leg('parlay_push_to_single_leg', 'settle_spread_total_push', 'spread', 'Away Team +3', 3, 3, -110);
select pg_temp.add_leg('parlay_push_to_single_leg', 'settle_home_win', 'moneyline', 'Home Team', null, null, -150);

select pg_temp.add_bet('parlay_payout_cap', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'parlay', 35, 5000);
select pg_temp.add_leg('parlay_payout_cap', 'settle_cap_1', 'moneyline', 'Home Team', null, null, 300);
select pg_temp.add_leg('parlay_payout_cap', 'settle_cap_2', 'moneyline', 'Home Team', null, null, 300);
select pg_temp.add_leg('parlay_payout_cap', 'settle_cap_3', 'moneyline', 'Home Team', null, null, 300);
select pg_temp.add_leg('parlay_payout_cap', 'settle_cap_4', 'moneyline', 'Home Team', null, null, 300);

select pg_temp.add_bet('teaser_adjusted_line_win', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'teaser', 20, -110, 6);
select pg_temp.add_leg('teaser_adjusted_line_win', 'settle_teaser_margin', 'spread', 'Home Team -1', -7, -1, -110);
select pg_temp.add_leg('teaser_adjusted_line_win', 'settle_teaser_margin', 'over_under', 'Under 46', 40, 46, -110);

select pg_temp.add_bet('teaser_adjusted_line_loss', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'teaser', 20, -110, 6);
select pg_temp.add_leg('teaser_adjusted_line_loss', 'settle_teaser_margin', 'spread', 'Home Team -3.5', -9.5, -3.5, -110);
select pg_temp.add_leg('teaser_adjusted_line_loss', 'settle_teaser_margin', 'over_under', 'Under 46', 40, 46, -110);

select pg_temp.add_bet('teaser_push_recalculation', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'teaser', 20, 150, 6);
select pg_temp.add_leg('teaser_push_recalculation', 'settle_spread_total_push', 'spread', 'Away Team +3', -3, 3, -110);
select pg_temp.add_leg('teaser_push_recalculation', 'settle_teaser_margin', 'spread', 'Home Team -1', -7, -1, -110);
select pg_temp.add_leg('teaser_push_recalculation', 'settle_teaser_margin', 'over_under', 'Under 46', 40, 46, -110);

select pg_temp.add_bet('teaser_push_below_minimum', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'teaser', 20, -110, 6);
select pg_temp.add_leg('teaser_push_below_minimum', 'settle_spread_total_push', 'spread', 'Away Team +3', -3, 3, -110);
select pg_temp.add_leg('teaser_push_below_minimum', 'settle_teaser_margin', 'over_under', 'Under 46', 40, 46, -110);

select pg_temp.add_bet('teaser_size_6_loss_same_game', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'teaser', 10, -110, 6);
select pg_temp.add_leg('teaser_size_6_loss_same_game', 'settle_teaser_size', 'spread', 'Home Team -0.5', -6.5, -0.5, -110);
select pg_temp.add_leg('teaser_size_6_loss_same_game', 'settle_teaser_second_leg', 'over_under', 'Under 41', 34.5, 41, -110);

select pg_temp.add_bet('teaser_size_65_push_same_game', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'teaser', 10, -120, 6.5);
select pg_temp.add_leg('teaser_size_65_push_same_game', 'settle_teaser_size', 'spread', 'Home Team 0', -6.5, 0, -120);
select pg_temp.add_leg('teaser_size_65_push_same_game', 'settle_teaser_second_leg', 'over_under', 'Under 41', 34.5, 41, -120);

select pg_temp.add_bet('teaser_size_7_win_same_game', '00000000-0000-0000-0000-000000002001'::uuid, pg_temp.test_user(1), 'teaser', 10, -130, 7);
select pg_temp.add_leg('teaser_size_7_win_same_game', 'settle_teaser_size', 'spread', 'Home Team +0.5', -6.5, 0.5, -130);
select pg_temp.add_leg('teaser_size_7_win_same_game', 'settle_teaser_second_leg', 'over_under', 'Under 41', 34.5, 41, -130);

select pg_temp.add_bet('cumulative_rank_win', '00000000-0000-0000-0000-000000002002'::uuid, pg_temp.test_user(1), 'straight', 10, 100);
select pg_temp.add_leg('cumulative_rank_win', 'settle_home_win', 'moneyline', 'Home Team', null, null, 100);
select pg_temp.add_bet('cumulative_rank_loss', '00000000-0000-0000-0000-000000002002'::uuid, pg_temp.test_user(2), 'straight', 10, 100);
select pg_temp.add_leg('cumulative_rank_loss', 'settle_home_win', 'moneyline', 'Away Team', null, null, 100);

select pg_temp.add_bet('h2h_home_winner_pick', '00000000-0000-0000-0000-000000002003'::uuid, pg_temp.test_user(1), 'straight', 10, 100);
select pg_temp.add_leg('h2h_home_winner_pick', 'settle_home_win', 'moneyline', 'Home Team', null, null, 100);
select pg_temp.add_bet('h2h_away_loser_pick', '00000000-0000-0000-0000-000000002003'::uuid, pg_temp.test_user(2), 'straight', 10, 100);
select pg_temp.add_leg('h2h_away_loser_pick', 'settle_home_win', 'moneyline', 'Away Team', null, null, 100);

select pg_temp.add_bet('h2h_tie_home_pick', '00000000-0000-0000-0000-000000002004'::uuid, pg_temp.test_user(1), 'straight', 10, -110);
select pg_temp.add_leg('h2h_tie_home_pick', 'settle_spread_total_push', 'spread', 'Away Team +3', 3, 3, -110);
select pg_temp.add_bet('h2h_tie_away_pick', '00000000-0000-0000-0000-000000002004'::uuid, pg_temp.test_user(2), 'straight', 10, -110);
select pg_temp.add_leg('h2h_tie_away_pick', 'settle_spread_total_push', 'over_under', 'Over 51', 51, 51, -110);

select public.settle_completed_scores(
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', game_id,
        'completed', true,
        'home_team', home_team,
        'away_team', away_team,
        'scores', jsonb_build_array(
          jsonb_build_object('name', home_team, 'score', home_score::text),
          jsonb_build_object('name', away_team, 'score', away_score::text)
        ),
        'sport_key', 'americanfootball_nfl',
        'sport_title', 'NFL',
        'commence_time', '2026-05-06T00:00:00Z',
        'last_update', '2026-05-06T03:00:00Z'
      )
      order by game_id
    )
    from test_scores
  )
);

select pg_temp.assert_bet('straight bet win', 'straight_win', 'win', 10);
select pg_temp.assert_bet('straight bet loss', 'straight_loss', 'loss', -10);
select pg_temp.assert_bet('straight bet push', 'straight_push', 'push', 0);
select pg_temp.assert_bet('settled half-point spread cover is win', 'straight_half_spread_win', 'win', 18.18);
select pg_temp.assert_bet('settled half-point spread miss is loss', 'straight_half_spread_loss', 'loss', -20);
select pg_temp.assert_bet('settled half-point total miss is loss', 'straight_half_total_loss', 'loss', -20);
select pg_temp.assert_bet('settled whole-number total exact score is push', 'straight_whole_total_push', 'push', 0);
select pg_temp.assert_bet('lock multiplier on win', 'lock_win', 'win', 15);
select pg_temp.assert_bet('lock multiplier on loss', 'lock_loss', 'loss', -15);
select pg_temp.assert_straight_bet_economics('settled economics: win outcome equals played plus American-odds profit', 'straight_half_spread_win');
select pg_temp.assert_straight_bet_economics('settled economics: loss outcome is zero and profit is negative stake', 'straight_half_spread_loss');
select pg_temp.assert_straight_bet_economics('settled economics: push returns stake with zero profit', 'straight_whole_total_push');
select pg_temp.assert_straight_bet_economics('settled economics: Pick of the Week win applies 1.5x profit', 'lock_win');
select pg_temp.assert_bet('parlay all-win', 'parlay_all_win', 'win', 60);
select pg_temp.assert_bet('parlay one-loss', 'parlay_one_loss', 'loss', -20);
select pg_temp.assert_bet('parlay one-push recalculation', 'parlay_one_push_recalculation', 'win', 60);
select pg_temp.assert_bet('parlay all-push', 'parlay_all_push', 'push', 0);
select pg_temp.assert_bet('parlay push-to-single-leg', 'parlay_push_to_single_leg', 'win', 13.33);
select pg_temp.assert_bet('parlay payout cap at 500', 'parlay_payout_cap', 'win', 465);
select pg_temp.assert_bet('teaser win against adjusted line', 'teaser_adjusted_line_win', 'win', 18.18);
select pg_temp.assert_bet('teaser loss against adjusted line', 'teaser_adjusted_line_loss', 'loss', -20);
select pg_temp.assert_bet('teaser leg push with lookup recalculation', 'teaser_push_recalculation', 'win', 18.18);
select pg_temp.assert_bet('teaser push below minimum legs', 'teaser_push_below_minimum', 'push', 0);
select pg_temp.assert_bet('teaser size 6pt same-game loss', 'teaser_size_6_loss_same_game', 'loss', -10);
select pg_temp.assert_bet('teaser size 6.5pt same-game push', 'teaser_size_65_push_same_game', 'push', 0);
select pg_temp.assert_bet('teaser size 7pt same-game win', 'teaser_size_7_win_same_game', 'win', 7.69);

select pg_temp.assert_matchup(
  'H2H matchup winner and loser',
  '00000000-0000-0000-0000-000000002013'::uuid,
  10,
  -10,
  pg_temp.test_user(1)
);
select pg_temp.assert_standing(
  'H2H winner standings row',
  '00000000-0000-0000-0000-000000002003'::uuid,
  pg_temp.test_user(1),
  10,
  10,
  1,
  0,
  0,
  1
);
select pg_temp.assert_standing(
  'H2H loser standings row',
  '00000000-0000-0000-0000-000000002003'::uuid,
  pg_temp.test_user(2),
  -10,
  -10,
  0,
  1,
  0,
  2
);
select pg_temp.assert_matchup(
  'H2H matchup tie',
  '00000000-0000-0000-0000-000000002014'::uuid,
  0,
  0,
  null
);
select pg_temp.assert_standing(
  'H2H tie home standings row',
  '00000000-0000-0000-0000-000000002004'::uuid,
  pg_temp.test_user(1),
  0,
  0,
  0,
  0,
  1,
  null
);
select pg_temp.assert_standing(
  'H2H tie away standings row',
  '00000000-0000-0000-0000-000000002004'::uuid,
  pg_temp.test_user(2),
  0,
  0,
  0,
  0,
  1,
  null
);

select pg_temp.assert_standing(
  'cumulative league rank winner',
  '00000000-0000-0000-0000-000000002002'::uuid,
  pg_temp.test_user(1),
  10,
  10,
  0,
  0,
  0,
  1
);
select pg_temp.assert_standing(
  'cumulative league rank no-pick player',
  '00000000-0000-0000-0000-000000002002'::uuid,
  pg_temp.test_user(3),
  -100,
  -100,
  0,
  0,
  0,
  3
);
select pg_temp.assert_standing(
  'cumulative league rank loser',
  '00000000-0000-0000-0000-000000002002'::uuid,
  pg_temp.test_user(2),
  -10,
  -10,
  0,
  0,
  0,
  2
);
select pg_temp.record_result(
  'player who did not place picks gets -100 profit',
  exists (
    select 1
    from public.standings
    where league_id = '00000000-0000-0000-0000-000000002002'::uuid
      and user_id = pg_temp.test_user(3)
      and week_number = 1
      and weekly_profit = -100
      and total_profit = -100
  ),
  'expected no-pick cumulative member to have -100 weekly and total profit'
);

select jsonb_build_object(
  'passed', count(*) filter (where passed),
  'failed', count(*) filter (where not passed),
  'total', count(*),
  'results', jsonb_agg(
    jsonb_build_object(
      'name', name,
      'status', case when passed then 'PASS' else 'FAIL' end,
      'detail', detail
    )
    order by name
  )
) as settlement_test_summary
from settlement_test_results;

rollback;
