-- Reconcile deterministic fixture rows whose settled profit drifted from
-- their displayed American odds/stake math.

with corrected_bets (
  id,
  odds,
  potential_payout,
  result,
  profit,
  teaser_points
) as (
  values
    ('00000000-0000-0000-0000-000000031401'::uuid, 120, 44::numeric, 'win'::public.bet_result, 36::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031402'::uuid, 232, 66.46::numeric, 'win'::public.bet_result, 46.46::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031403'::uuid, -110, 38.18::numeric, 'win'::public.bet_result, 18.18::numeric, 6::numeric),
    ('00000000-0000-0000-0000-000000031404'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031405'::uuid, -105, 39.05::numeric, 'win'::public.bet_result, 19.05::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031411'::uuid, -110, 38.18::numeric, 'win'::public.bet_result, 18.18::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031412'::uuid, 125, 45::numeric, 'win'::public.bet_result, 37.5::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031413'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031414'::uuid, -110, 38.18::numeric, 'win'::public.bet_result, 18.18::numeric, 6::numeric),
    ('00000000-0000-0000-0000-000000031415'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031421'::uuid, 115, 43::numeric, 'win'::public.bet_result, 34.5::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031422'::uuid, 210, 62.09::numeric, 'win'::public.bet_result, 42.09::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031423'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031424'::uuid, -105, 39.05::numeric, 'win'::public.bet_result, 19.05::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031425'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031431'::uuid, -110, 38.18::numeric, 'win'::public.bet_result, 18.18::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031432'::uuid, 120, 44::numeric, 'win'::public.bet_result, 36::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031433'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031434'::uuid, 165, 52.94::numeric, 'win'::public.bet_result, 32.94::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031435'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031501'::uuid, 120, 44::numeric, 'win'::public.bet_result, 36::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031502'::uuid, -110, 38.18::numeric, 'win'::public.bet_result, 18.18::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031503'::uuid, 105, 41::numeric, 'win'::public.bet_result, 21::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031504'::uuid, -115, 37.39::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031505'::uuid, -110, 38.18::numeric, 'push'::public.bet_result, 0::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031511'::uuid, 120, 44::numeric, 'win'::public.bet_result, 36::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031512'::uuid, 232, 66.46::numeric, 'win'::public.bet_result, 46.46::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031513'::uuid, -105, 39.05::numeric, 'win'::public.bet_result, 19.05::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031514'::uuid, 105, 41::numeric, 'win'::public.bet_result, 21::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000031515'::uuid, -110, 38.18::numeric, 'loss'::public.bet_result, -20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000021411'::uuid, 100, 40::numeric, 'win'::public.bet_result, 20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000021412'::uuid, 100, 40::numeric, 'win'::public.bet_result, 20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000021413'::uuid, 100, 40::numeric, 'win'::public.bet_result, 20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000021414'::uuid, 100, 40::numeric, 'win'::public.bet_result, 20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000021421'::uuid, 100, 40::numeric, 'win'::public.bet_result, 20::numeric, null::numeric),
    ('00000000-0000-0000-0000-000000021431'::uuid, 800, 315::numeric, 'win'::public.bet_result, 420::numeric, null::numeric)
)
update public.bets b
set odds = corrected_bets.odds,
    potential_payout = corrected_bets.potential_payout,
    result = corrected_bets.result,
    profit = corrected_bets.profit,
    teaser_points = corrected_bets.teaser_points
from corrected_bets
where b.id = corrected_bets.id;

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
select
  '00000000-0000-0000-0000-000000031414'::uuid,
  'appstore_w03_bal_pit',
  'spread'::public.bet_market,
  'Pittsburgh Steelers +11.5',
  5.5::numeric,
  11.5::numeric,
  -110,
  'win'::public.bet_result,
  now() - interval '1 day',
  true
where exists (
    select 1
    from public.bets
    where id = '00000000-0000-0000-0000-000000031414'::uuid
  )
  and not exists (
    select 1
    from public.bet_legs
    where bet_id = '00000000-0000-0000-0000-000000031414'::uuid
      and game_id = 'appstore_w03_bal_pit'
      and selection = 'Pittsburgh Steelers +11.5'
  );

update public.bet_legs
set leg_odds = -138
where bet_id = '00000000-0000-0000-0000-000000031422'::uuid
  and game_id = 'appstore_w03_min_gb';

update public.bet_legs
set leg_odds = -170
where bet_id = '00000000-0000-0000-0000-000000031434'::uuid
  and game_id = 'appstore_w03_sf_sea';

update public.bet_legs
set leg_odds = -150
where bet_id = '00000000-0000-0000-0000-000000031434'::uuid
  and game_id = 'appstore_w03_det_chi';

update public.bet_legs
set selection = 'Over 42',
    original_line = 42,
    adjusted_line = 42
where bet_id = '00000000-0000-0000-0000-000000031505'::uuid
  and game_id = 'appstore_w03_bal_pit';

update public.weekly_matchups
set home_profit = 55.18,
    away_profit = -28,
    winner_id = (select user_id from public.bets where id = '00000000-0000-0000-0000-000000031501'::uuid)
where id = '00000000-0000-0000-0000-000000031201'::uuid;

update public.weekly_matchups
set home_profit = 99.69,
    away_profit = 33.86,
    winner_id = (select user_id from public.bets where id = '00000000-0000-0000-0000-000000031401'::uuid)
where id = '00000000-0000-0000-0000-000000031301'::uuid;

update public.weekly_matchups
set home_profit = 55.64,
    away_profit = 47.12,
    winner_id = (select user_id from public.bets where id = '00000000-0000-0000-0000-000000031421'::uuid)
where id = '00000000-0000-0000-0000-000000031302'::uuid;

with corrected_standings (bet_id, week_number, weekly_profit, total_profit, rank) as (
  values
    ('00000000-0000-0000-0000-000000031501'::uuid, 2, 55.18::numeric, 137.18::numeric, 1),
    ('00000000-0000-0000-0000-000000031511'::uuid, 2, 102.51::numeric, 78.51::numeric, 2),
    ('00000000-0000-0000-0000-000000031411'::uuid, 2, 50::numeric, 74::numeric, 3),
    ('00000000-0000-0000-0000-000000031421'::uuid, 3, 55.64::numeric, 192.82::numeric, 1),
    ('00000000-0000-0000-0000-000000031401'::uuid, 3, 99.69::numeric, 178.20::numeric, 2),
    ('00000000-0000-0000-0000-000000031411'::uuid, 3, 33.86::numeric, 107.86::numeric, 3),
    ('00000000-0000-0000-0000-000000031431'::uuid, 3, 47.12::numeric, 55.12::numeric, 5)
)
update public.standings s
set weekly_profit = corrected_standings.weekly_profit,
    total_profit = corrected_standings.total_profit,
    rank = corrected_standings.rank
from corrected_standings
join public.bets b on b.id = corrected_standings.bet_id
where s.league_id = '00000000-0000-0000-0000-000000031001'::uuid
  and s.user_id = b.user_id
  and s.week_number = corrected_standings.week_number;
