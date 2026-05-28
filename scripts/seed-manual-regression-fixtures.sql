-- Idempotent manual QA fixtures for simulator verification.
-- These leagues are explicit global-week test fixtures so week alignment and
-- simulation tools skip them.

begin;

create temporary table qa_manual_users on commit drop as
select id, email, display_name, row_number() over (
  order by
    case when lower(email) = 'appreview@actionarena.app' then 0 else 1 end,
    created_at,
    id
) as slot
from public.users
order by
  case when lower(email) = 'appreview@actionarena.app' then 0 else 1 end,
  created_at,
  id
limit 8;

do $$
begin
  if (select count(*) from qa_manual_users) < 8 then
    raise exception 'Manual regression fixtures require at least 8 public.users rows';
  end if;
end;
$$;

create temporary table qa_manual_leagues (
  key text primary key,
  id uuid not null,
  invite_code text not null,
  name text not null,
  type public.league_type not null,
  current_week integer not null,
  status public.league_status not null,
  description text not null
) on commit drop;

insert into qa_manual_leagues (key, id, invite_code, name, type, current_week, status, description)
values
  (
    'post_submit',
    '00000000-0000-0000-0000-000000021001'::uuid,
    'QAPOST',
    'QA Manual Regression - Post Submit Editing',
    'cumulative',
    1,
    'active',
    'Submitted Week 1 card with a multi-leg pick containing a started sibling leg.'
  ),
  (
    'visibility_before',
    '00000000-0000-0000-0000-000000021002'::uuid,
    'QAVISB',
    'QA Manual Regression - Visibility Before Kickoff',
    'h2h',
    2,
    'active',
    'Week 2 H2H matchup before kickoff; opponent picks should remain hidden.'
  ),
  (
    'visibility_after',
    '00000000-0000-0000-0000-000000021003'::uuid,
    'QAVISA',
    'QA Manual Regression - Visibility After Kickoff',
    'h2h',
    2,
    'active',
    'Week 2 H2H matchup after kickoff; opponent picks should be revealed.'
  ),
  (
    'potw_lockout',
    '00000000-0000-0000-0000-000000021004'::uuid,
    'QAPOTW',
    'QA Manual Regression - Pick Board Actions',
    'cumulative',
    1,
    'active',
    'Submitted Week 1 card after first kickoff; Pick of the Week swap should be closed.'
  ),
  (
    'championship',
    '00000000-0000-0000-0000-000000021005'::uuid,
    'QACHMP',
    'QA Manual Regression - Championship Snapshot',
    'h2h',
    17,
    'complete',
    'Completed playoff league where champion won the title game but is not the final standings leader.'
  );

delete from public.leagues
where id in (select id from qa_manual_leagues)
   or name like 'QA Manual Regression - %';

delete from public.games
where game_id like 'qa_manual_%';

create or replace function pg_temp.qa_user(p_slot integer)
returns uuid
language sql
stable
as $$
  select id from qa_manual_users where slot = p_slot
$$;

create or replace function pg_temp.qa_fixture_settings(p_key text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'global_week_exempt', true,
    'global_week_test_fixture', true,
    'manual_regression_fixture', true,
    'fixture_key', p_key
  )
$$;

insert into public.leagues (
  id,
  name,
  description,
  commissioner_id,
  type,
  visibility,
  invite_code,
  max_members,
  sport,
  season_year,
  current_week,
  status,
  settings
)
select
  league_fixture.id,
  league_fixture.name,
  league_fixture.description,
  pg_temp.qa_user(1),
  league_fixture.type,
  'private'::public.league_visibility,
  league_fixture.invite_code,
  case when league_fixture.key = 'championship' then 8 else 4 end,
  'nfl'::public.league_sport,
  2098,
  league_fixture.current_week,
  league_fixture.status,
  pg_temp.qa_fixture_settings(league_fixture.key)
from qa_manual_leagues league_fixture;

insert into public.league_members (league_id, user_id, team_name, joined_at)
select
  league_fixture.id,
  users.id,
  case
    when users.slot = 1 then 'QA Tester'
    when users.slot = 2 then 'QA Rival'
    else 'QA Seed ' || users.slot::text
  end,
  now() + (users.slot::text || ' seconds')::interval
from qa_manual_leagues league_fixture
join qa_manual_users users
  on league_fixture.key = 'championship'
  or users.slot <= 2;

-- Post-submit editing fixture: full 5-pick/100-coin submitted card with one
-- open straight and one multi-leg teaser that contains a started sibling leg.
insert into public.league_week_slate_games (league_id, week_number, game_id, commence_time, away_team, home_team)
select league_fixture.id, slate.week_number, slate.game_id, slate.commence_time, slate.away_team, slate.home_team
from qa_manual_leagues league_fixture
join (
  values
    (1, 'qa_manual_post_dal_phi', now() + interval '7 days', 'Dallas Cowboys', 'Philadelphia Eagles'),
    (1, 'qa_manual_post_sea_lar', now() - interval '2 minutes', 'Seattle Seahawks', 'Los Angeles Rams'),
    (1, 'qa_manual_post_mia_nyj', now() + interval '8 days', 'Miami Dolphins', 'New York Jets'),
    (1, 'qa_manual_post_kc_den', now() + interval '9 days', 'Kansas City Chiefs', 'Denver Broncos'),
    (1, 'qa_manual_post_cin_cle', now() + interval '10 days', 'Cincinnati Bengals', 'Cleveland Browns'),
    (1, 'qa_manual_post_buf_nyj', now() + interval '11 days', 'Buffalo Bills', 'New York Jets')
) as slate(week_number, game_id, commence_time, away_team, home_team) on true
where league_fixture.key = 'post_submit';

insert into public.bets (id, user_id, league_id, week_number, bet_type, amount, odds, potential_payout, result, teaser_points, is_lock)
select
  bet.bet_id,
  pg_temp.qa_user(1),
  league_fixture.id,
  1,
  bet.bet_type,
  20,
  bet.odds,
  bet.potential_payout,
  'pending'::public.bet_result,
  bet.teaser_points,
  bet.is_lock
from qa_manual_leagues league_fixture
join (
  values
    ('00000000-0000-0000-0000-000000021101'::uuid, 'straight'::public.bet_type, 120, 44::numeric, null::numeric, false),
    ('00000000-0000-0000-0000-000000021102'::uuid, 'teaser'::public.bet_type, 200, 60::numeric, 6.5, true),
    ('00000000-0000-0000-0000-000000021103'::uuid, 'straight'::public.bet_type, -110, 38.18::numeric, null::numeric, false),
    ('00000000-0000-0000-0000-000000021104'::uuid, 'straight'::public.bet_type, 105, 41::numeric, null::numeric, false),
    ('00000000-0000-0000-0000-000000021105'::uuid, 'straight'::public.bet_type, -115, 37.39::numeric, null::numeric, false)
) as bet(bet_id, bet_type, odds, potential_payout, teaser_points, is_lock) on true
where league_fixture.key = 'post_submit';

insert into public.bet_legs (bet_id, game_id, market, selection, original_line, adjusted_line, leg_odds, result, game_start_time, locked)
values
  ('00000000-0000-0000-0000-000000021101'::uuid, 'qa_manual_post_dal_phi', 'moneyline'::public.bet_market, 'Dallas Cowboys', null, null, 120, 'pending'::public.bet_result, now() + interval '7 days', false),
  ('00000000-0000-0000-0000-000000021102'::uuid, 'qa_manual_post_sea_lar', 'spread'::public.bet_market, 'Seattle Seahawks +1.5', 1.5, 8, -110, 'pending'::public.bet_result, now() - interval '2 minutes', false),
  ('00000000-0000-0000-0000-000000021102'::uuid, 'qa_manual_post_mia_nyj', 'spread'::public.bet_market, 'Miami Dolphins -6.5', -6.5, 0, -110, 'pending'::public.bet_result, now() + interval '8 days', false),
  ('00000000-0000-0000-0000-000000021103'::uuid, 'qa_manual_post_kc_den', 'over_under'::public.bet_market, 'Under 44.5', 44.5, 44.5, -110, 'pending'::public.bet_result, now() + interval '9 days', false),
  ('00000000-0000-0000-0000-000000021104'::uuid, 'qa_manual_post_cin_cle', 'moneyline'::public.bet_market, 'Cincinnati Bengals', null, null, 105, 'pending'::public.bet_result, now() + interval '10 days', false),
  ('00000000-0000-0000-0000-000000021105'::uuid, 'qa_manual_post_buf_nyj', 'spread'::public.bet_market, 'Buffalo Bills -3.5', -3.5, -3.5, -115, 'pending'::public.bet_result, now() + interval '11 days', false);

insert into public.standings (league_id, user_id, week_number, wins, losses, ties, weekly_profit, total_profit, rank)
select id, pg_temp.qa_user(1), 1, 0, 0, 0, 0, 0, 1
from qa_manual_leagues where key = 'post_submit';

-- Visibility fixtures: full submitted cards for both sides. The before fixture
-- keeps every kickoff in the future; the after fixture starts every game.
insert into public.weekly_matchups (id, league_id, week_number, home_user_id, away_user_id, is_playoff, is_championship)
select '00000000-0000-0000-0000-000000021201'::uuid, id, 2, pg_temp.qa_user(1), pg_temp.qa_user(2), false, false
from qa_manual_leagues where key = 'visibility_before'
union all
select '00000000-0000-0000-0000-000000021202'::uuid, id, 2, pg_temp.qa_user(1), pg_temp.qa_user(2), false, false
from qa_manual_leagues where key = 'visibility_after';

insert into public.standings (league_id, user_id, week_number, wins, losses, ties, weekly_profit, total_profit, rank)
select id, pg_temp.qa_user(1), 2, 1, 0, 0, 0, 0, 1
from qa_manual_leagues where key in ('visibility_before', 'visibility_after')
union all
select id, pg_temp.qa_user(2), 2, 0, 1, 0, 0, 0, 2
from qa_manual_leagues where key in ('visibility_before', 'visibility_after');

insert into public.league_week_slate_games (league_id, week_number, game_id, commence_time, away_team, home_team)
select league_fixture.id, 2, slate.game_id, slate.commence_time, slate.away_team, slate.home_team
from qa_manual_leagues league_fixture
join (
  values
    ('visibility_before', 'qa_manual_visibility_before_dal_phi', now() + interval '7 days', 'Dallas Cowboys', 'Philadelphia Eagles'),
    ('visibility_before', 'qa_manual_visibility_before_kc_lv', now() + interval '8 days', 'Kansas City Chiefs', 'Las Vegas Raiders'),
    ('visibility_before', 'qa_manual_visibility_before_mia_nyj', now() + interval '9 days', 'Miami Dolphins', 'New York Jets'),
    ('visibility_before', 'qa_manual_visibility_before_buf_ne', now() + interval '10 days', 'Buffalo Bills', 'New England Patriots'),
    ('visibility_before', 'qa_manual_visibility_before_cin_cle', now() + interval '11 days', 'Cincinnati Bengals', 'Cleveland Browns'),
    ('visibility_after', 'qa_manual_visibility_after_dal_phi', now() - interval '2 minutes', 'Dallas Cowboys', 'Philadelphia Eagles'),
    ('visibility_after', 'qa_manual_visibility_after_kc_lv', now() - interval '3 minutes', 'Kansas City Chiefs', 'Las Vegas Raiders'),
    ('visibility_after', 'qa_manual_visibility_after_mia_nyj', now() - interval '4 minutes', 'Miami Dolphins', 'New York Jets'),
    ('visibility_after', 'qa_manual_visibility_after_buf_ne', now() - interval '5 minutes', 'Buffalo Bills', 'New England Patriots'),
    ('visibility_after', 'qa_manual_visibility_after_cin_cle', now() - interval '6 minutes', 'Cincinnati Bengals', 'Cleveland Browns')
) as slate(league_key, game_id, commence_time, away_team, home_team)
  on slate.league_key = league_fixture.key
where league_fixture.key in ('visibility_before', 'visibility_after');

insert into public.bets (id, user_id, league_id, week_number, bet_type, amount, odds, potential_payout, result, is_lock)
select
  bet.bet_id,
  pg_temp.qa_user(bet.user_slot),
  league_fixture.id,
  2,
  'straight'::public.bet_type,
  20,
  bet.odds,
  bet.potential_payout,
  'pending'::public.bet_result,
  bet.is_lock
from qa_manual_leagues league_fixture
join (
  values
    ('visibility_before', '00000000-0000-0000-0000-000000021211'::uuid, 1, 120, 44::numeric, true),
    ('visibility_before', '00000000-0000-0000-0000-000000021212'::uuid, 1, -110, 38.18::numeric, false),
    ('visibility_before', '00000000-0000-0000-0000-000000021213'::uuid, 1, 115, 43::numeric, false),
    ('visibility_before', '00000000-0000-0000-0000-000000021214'::uuid, 1, -115, 37.39::numeric, false),
    ('visibility_before', '00000000-0000-0000-0000-000000021215'::uuid, 1, 105, 41::numeric, false),
    ('visibility_before', '00000000-0000-0000-0000-000000021221'::uuid, 2, -140, 34.29::numeric, true),
    ('visibility_before', '00000000-0000-0000-0000-000000021222'::uuid, 2, 125, 45::numeric, false),
    ('visibility_before', '00000000-0000-0000-0000-000000021223'::uuid, 2, -105, 39.05::numeric, false),
    ('visibility_before', '00000000-0000-0000-0000-000000021224'::uuid, 2, 110, 42::numeric, false),
    ('visibility_before', '00000000-0000-0000-0000-000000021225'::uuid, 2, -120, 36.67::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021231'::uuid, 1, 120, 44::numeric, true),
    ('visibility_after', '00000000-0000-0000-0000-000000021232'::uuid, 1, -110, 38.18::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021233'::uuid, 1, 115, 43::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021234'::uuid, 1, -115, 37.39::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021235'::uuid, 1, 105, 41::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021241'::uuid, 2, -140, 34.29::numeric, true),
    ('visibility_after', '00000000-0000-0000-0000-000000021242'::uuid, 2, 125, 45::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021243'::uuid, 2, -105, 39.05::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021244'::uuid, 2, 110, 42::numeric, false),
    ('visibility_after', '00000000-0000-0000-0000-000000021245'::uuid, 2, -120, 36.67::numeric, false)
) as bet(league_key, bet_id, user_slot, odds, potential_payout, is_lock)
  on bet.league_key = league_fixture.key
where league_fixture.key in ('visibility_before', 'visibility_after');

insert into public.bet_legs (bet_id, game_id, market, selection, original_line, adjusted_line, leg_odds, result, game_start_time, locked)
values
  ('00000000-0000-0000-0000-000000021211'::uuid, 'qa_manual_visibility_before_dal_phi', 'moneyline'::public.bet_market, 'Dallas Cowboys', null, null, 120, 'pending'::public.bet_result, now() + interval '7 days', false),
  ('00000000-0000-0000-0000-000000021212'::uuid, 'qa_manual_visibility_before_kc_lv', 'moneyline'::public.bet_market, 'Kansas City Chiefs', null, null, -110, 'pending'::public.bet_result, now() + interval '8 days', false),
  ('00000000-0000-0000-0000-000000021213'::uuid, 'qa_manual_visibility_before_mia_nyj', 'moneyline'::public.bet_market, 'Miami Dolphins', null, null, 115, 'pending'::public.bet_result, now() + interval '9 days', false),
  ('00000000-0000-0000-0000-000000021214'::uuid, 'qa_manual_visibility_before_buf_ne', 'spread'::public.bet_market, 'Buffalo Bills -3.5', -3.5, -3.5, -115, 'pending'::public.bet_result, now() + interval '10 days', false),
  ('00000000-0000-0000-0000-000000021215'::uuid, 'qa_manual_visibility_before_cin_cle', 'moneyline'::public.bet_market, 'Cincinnati Bengals', null, null, 105, 'pending'::public.bet_result, now() + interval '11 days', false),
  ('00000000-0000-0000-0000-000000021221'::uuid, 'qa_manual_visibility_before_dal_phi', 'moneyline'::public.bet_market, 'Philadelphia Eagles', null, null, -140, 'pending'::public.bet_result, now() + interval '7 days', false),
  ('00000000-0000-0000-0000-000000021222'::uuid, 'qa_manual_visibility_before_kc_lv', 'moneyline'::public.bet_market, 'Las Vegas Raiders', null, null, 125, 'pending'::public.bet_result, now() + interval '8 days', false),
  ('00000000-0000-0000-0000-000000021223'::uuid, 'qa_manual_visibility_before_mia_nyj', 'moneyline'::public.bet_market, 'New York Jets', null, null, -105, 'pending'::public.bet_result, now() + interval '9 days', false),
  ('00000000-0000-0000-0000-000000021224'::uuid, 'qa_manual_visibility_before_buf_ne', 'spread'::public.bet_market, 'New England Patriots +3.5', 3.5, 3.5, 110, 'pending'::public.bet_result, now() + interval '10 days', false),
  ('00000000-0000-0000-0000-000000021225'::uuid, 'qa_manual_visibility_before_cin_cle', 'moneyline'::public.bet_market, 'Cleveland Browns', null, null, -120, 'pending'::public.bet_result, now() + interval '11 days', false),
  ('00000000-0000-0000-0000-000000021231'::uuid, 'qa_manual_visibility_after_dal_phi', 'moneyline'::public.bet_market, 'Dallas Cowboys', null, null, 120, 'pending'::public.bet_result, now() - interval '2 minutes', true),
  ('00000000-0000-0000-0000-000000021232'::uuid, 'qa_manual_visibility_after_kc_lv', 'moneyline'::public.bet_market, 'Kansas City Chiefs', null, null, -110, 'pending'::public.bet_result, now() - interval '3 minutes', true),
  ('00000000-0000-0000-0000-000000021233'::uuid, 'qa_manual_visibility_after_mia_nyj', 'moneyline'::public.bet_market, 'Miami Dolphins', null, null, 115, 'pending'::public.bet_result, now() - interval '4 minutes', true),
  ('00000000-0000-0000-0000-000000021234'::uuid, 'qa_manual_visibility_after_buf_ne', 'spread'::public.bet_market, 'Buffalo Bills -3.5', -3.5, -3.5, -115, 'pending'::public.bet_result, now() - interval '5 minutes', true),
  ('00000000-0000-0000-0000-000000021235'::uuid, 'qa_manual_visibility_after_cin_cle', 'moneyline'::public.bet_market, 'Cincinnati Bengals', null, null, 105, 'pending'::public.bet_result, now() - interval '6 minutes', true),
  ('00000000-0000-0000-0000-000000021241'::uuid, 'qa_manual_visibility_after_dal_phi', 'moneyline'::public.bet_market, 'Philadelphia Eagles', null, null, -140, 'pending'::public.bet_result, now() - interval '2 minutes', true),
  ('00000000-0000-0000-0000-000000021242'::uuid, 'qa_manual_visibility_after_kc_lv', 'moneyline'::public.bet_market, 'Las Vegas Raiders', null, null, 125, 'pending'::public.bet_result, now() - interval '3 minutes', true),
  ('00000000-0000-0000-0000-000000021243'::uuid, 'qa_manual_visibility_after_mia_nyj', 'moneyline'::public.bet_market, 'New York Jets', null, null, -105, 'pending'::public.bet_result, now() - interval '4 minutes', true),
  ('00000000-0000-0000-0000-000000021244'::uuid, 'qa_manual_visibility_after_buf_ne', 'spread'::public.bet_market, 'New England Patriots +3.5', 3.5, 3.5, 110, 'pending'::public.bet_result, now() - interval '5 minutes', true),
  ('00000000-0000-0000-0000-000000021245'::uuid, 'qa_manual_visibility_after_cin_cle', 'moneyline'::public.bet_market, 'Cleveland Browns', null, null, -120, 'pending'::public.bet_result, now() - interval '6 minutes', true);

-- Pick-board action fixture: full submitted card after first kickoff, so POTW
-- swap must be closed while normal card rendering remains realistic.
insert into public.league_week_slate_games (league_id, week_number, game_id, commence_time, away_team, home_team)
select league_fixture.id, 1, slate.game_id, slate.commence_time, slate.away_team, slate.home_team
from qa_manual_leagues league_fixture
join (
  values
    ('qa_manual_potw_started', now() - interval '2 minutes', 'Kansas City Chiefs', 'Las Vegas Raiders'),
    ('qa_manual_potw_mia_nyj', now() + interval '7 days', 'Miami Dolphins', 'New York Jets'),
    ('qa_manual_potw_dal_phi', now() + interval '8 days', 'Dallas Cowboys', 'Philadelphia Eagles'),
    ('qa_manual_potw_buf_ne', now() + interval '9 days', 'Buffalo Bills', 'New England Patriots'),
    ('qa_manual_potw_cin_cle', now() + interval '10 days', 'Cincinnati Bengals', 'Cleveland Browns')
) as slate(game_id, commence_time, away_team, home_team) on true
where league_fixture.key = 'potw_lockout';

insert into public.bets (id, user_id, league_id, week_number, bet_type, amount, odds, potential_payout, result, is_lock)
select
  bet.bet_id,
  pg_temp.qa_user(1),
  league_fixture.id,
  1,
  'straight'::public.bet_type,
  20,
  bet.odds,
  bet.potential_payout,
  'pending'::public.bet_result,
  bet.is_lock
from qa_manual_leagues league_fixture
join (
  values
    ('00000000-0000-0000-0000-000000021301'::uuid, -110, 38.18::numeric, true),
    ('00000000-0000-0000-0000-000000021302'::uuid, 115, 43::numeric, false),
    ('00000000-0000-0000-0000-000000021303'::uuid, 120, 44::numeric, false),
    ('00000000-0000-0000-0000-000000021304'::uuid, -115, 37.39::numeric, false),
    ('00000000-0000-0000-0000-000000021305'::uuid, 105, 41::numeric, false)
) as bet(bet_id, odds, potential_payout, is_lock) on true
where league_fixture.key = 'potw_lockout';

insert into public.bet_legs (bet_id, game_id, market, selection, original_line, adjusted_line, leg_odds, result, game_start_time, locked)
values
  ('00000000-0000-0000-0000-000000021301'::uuid, 'qa_manual_potw_started', 'over_under'::public.bet_market, 'Under 44.5', 44.5, 44.5, -110, 'pending'::public.bet_result, now() - interval '2 minutes', true),
  ('00000000-0000-0000-0000-000000021302'::uuid, 'qa_manual_potw_mia_nyj', 'moneyline'::public.bet_market, 'Miami Dolphins', null, null, 115, 'pending'::public.bet_result, now() + interval '7 days', false),
  ('00000000-0000-0000-0000-000000021303'::uuid, 'qa_manual_potw_dal_phi', 'moneyline'::public.bet_market, 'Dallas Cowboys', null, null, 120, 'pending'::public.bet_result, now() + interval '8 days', false),
  ('00000000-0000-0000-0000-000000021304'::uuid, 'qa_manual_potw_buf_ne', 'spread'::public.bet_market, 'Buffalo Bills -3.5', -3.5, -3.5, -115, 'pending'::public.bet_result, now() + interval '9 days', false),
  ('00000000-0000-0000-0000-000000021305'::uuid, 'qa_manual_potw_cin_cle', 'moneyline'::public.bet_market, 'Cincinnati Bengals', null, null, 105, 'pending'::public.bet_result, now() + interval '10 days', false);

insert into public.standings (league_id, user_id, week_number, wins, losses, ties, weekly_profit, total_profit, rank)
select id, pg_temp.qa_user(1), 1, 0, 0, 0, 0, 0, 1
from qa_manual_leagues where key = 'potw_lockout';

-- Championship fixture: tester wins the title game; another member remains the standings leader/MVP.
insert into public.weekly_matchups (id, league_id, week_number, home_user_id, away_user_id, home_profit, away_profit, winner_id, is_playoff, is_championship)
select '00000000-0000-0000-0000-000000021401'::uuid, id, 15, pg_temp.qa_user(2), pg_temp.qa_user(8), 40, -10, pg_temp.qa_user(2), true, false from qa_manual_leagues where key = 'championship'
union all
select '00000000-0000-0000-0000-000000021402'::uuid, id, 15, pg_temp.qa_user(4), pg_temp.qa_user(5), 15, 5, pg_temp.qa_user(4), true, false from qa_manual_leagues where key = 'championship'
union all
select '00000000-0000-0000-0000-000000021403'::uuid, id, 15, pg_temp.qa_user(3), pg_temp.qa_user(6), 25, -20, pg_temp.qa_user(3), true, false from qa_manual_leagues where key = 'championship'
union all
select '00000000-0000-0000-0000-000000021404'::uuid, id, 15, pg_temp.qa_user(1), pg_temp.qa_user(7), 35, -5, pg_temp.qa_user(1), true, false from qa_manual_leagues where key = 'championship'
union all
select '00000000-0000-0000-0000-000000021405'::uuid, id, 16, pg_temp.qa_user(2), pg_temp.qa_user(4), 30, 10, pg_temp.qa_user(2), true, false from qa_manual_leagues where key = 'championship'
union all
select '00000000-0000-0000-0000-000000021406'::uuid, id, 16, pg_temp.qa_user(1), pg_temp.qa_user(3), 45, 20, pg_temp.qa_user(1), true, false from qa_manual_leagues where key = 'championship'
union all
select '00000000-0000-0000-0000-000000021407'::uuid, id, 17, pg_temp.qa_user(1), pg_temp.qa_user(2), 60, 1, pg_temp.qa_user(1), true, true from qa_manual_leagues where key = 'championship';

insert into public.standings (league_id, user_id, week_number, wins, losses, ties, weekly_profit, total_profit, rank)
select league_fixture.id, users.id, 17,
  case users.slot
    when 2 then 15
    when 1 then 14
    else 10 - users.slot
  end,
  case users.slot
    when 2 then 2
    when 1 then 3
    else 7 + users.slot
  end,
  0,
  case users.slot
    when 1 then 60
    when 2 then 1
    else 0
  end,
  case users.slot
    when 2 then 1200
    when 1 then 900
    else 800 - (users.slot * 75)
  end,
  case users.slot
    when 2 then 1
    when 1 then 2
    else users.slot
  end
from qa_manual_leagues league_fixture
join qa_manual_users users on true
where league_fixture.key = 'championship';

-- Settled season activity for the trophy case. These rows make the completed
-- season snapshot generate all Test 22 awards from the same function used in
-- production, including Parlay King and Biggest Single Pick details.
insert into public.bets (
  id,
  user_id,
  league_id,
  week_number,
  bet_type,
  amount,
  odds,
  potential_payout,
  result,
  profit,
  is_lock,
  created_at
)
select
  bet.bet_id,
  pg_temp.qa_user(bet.user_slot),
  league_fixture.id,
  bet.week_number,
  bet.bet_type,
  bet.amount,
  bet.odds,
  bet.potential_payout,
  'win'::public.bet_result,
  bet.profit,
  bet.is_lock,
  now() - (bet.created_minutes_ago::text || ' minutes')::interval
from qa_manual_leagues league_fixture
join (
  values
    ('00000000-0000-0000-0000-000000021411'::uuid, 1, 1, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 8::numeric, false, 90),
    ('00000000-0000-0000-0000-000000021412'::uuid, 1, 2, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 9::numeric, false, 89),
    ('00000000-0000-0000-0000-000000021413'::uuid, 1, 3, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 10::numeric, false, 88),
    ('00000000-0000-0000-0000-000000021414'::uuid, 1, 4, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 11::numeric, false, 87),
    ('00000000-0000-0000-0000-000000021415'::uuid, 1, 5, 'parlay'::public.bet_type, 20::numeric, 175, 55::numeric, 35::numeric, false, 86),
    ('00000000-0000-0000-0000-000000021421'::uuid, 2, 1, 'straight'::public.bet_type, 20::numeric, 100, 40::numeric, 7::numeric, false, 85),
    ('00000000-0000-0000-0000-000000021422'::uuid, 2, 6, 'parlay'::public.bet_type, 20::numeric, 250, 70::numeric, 50::numeric, false, 84),
    ('00000000-0000-0000-0000-000000021423'::uuid, 2, 7, 'parlay'::public.bet_type, 20::numeric, 300, 80::numeric, 60::numeric, false, 83),
    ('00000000-0000-0000-0000-000000021431'::uuid, 3, 8, 'straight'::public.bet_type, 35::numeric, 800, 315::numeric, 280::numeric, true, 82),
    ('00000000-0000-0000-0000-000000021441'::uuid, 4, 9, 'parlay'::public.bet_type, 20::numeric, 160, 52::numeric, 32::numeric, false, 81)
) as bet(
  bet_id,
  user_slot,
  week_number,
  bet_type,
  amount,
  odds,
  potential_payout,
  profit,
  is_lock,
  created_minutes_ago
) on true
where league_fixture.key = 'championship'
on conflict (id) do nothing;

insert into public.bet_legs (bet_id, game_id, market, selection, original_line, adjusted_line, leg_odds, result, game_start_time, locked)
values
  ('00000000-0000-0000-0000-000000021431'::uuid, 'qa_manual_championship_den_kc', 'moneyline'::public.bet_market, 'Denver Broncos', null, null, 800, 'win'::public.bet_result, now() - interval '30 days', true);

select public.capture_completed_season(id)
from qa_manual_leagues
where key = 'championship';

select jsonb_build_object(
  'tester_user',
  (
    select jsonb_build_object('email', email, 'display_name', display_name, 'id', id)
    from qa_manual_users
    where slot = 1
  ),
  'opponent_user',
  (
    select jsonb_build_object('email', email, 'display_name', display_name, 'id', id)
    from qa_manual_users
    where slot = 2
  ),
  'fixtures',
  (
    select jsonb_agg(
      jsonb_build_object(
        'name', name,
        'invite_code', invite_code,
        'league_id', id,
        'current_week', current_week,
        'status', status,
        'description', description
      )
      order by key
    )
    from qa_manual_leagues
  )
) as manual_regression_fixture_summary;

commit;
