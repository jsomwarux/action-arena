delete from public.league_week_slate_games slate
using public.leagues league
where slate.league_id = league.id
  and league.sport = 'nfl'
  and league.name in ('Public Test League', 'Test Cumulative League', 'Test H2H League')
  and not public.is_global_week_exempt_fixture(league.name, league.settings)
  and slate.week_number < league.current_week
  and not exists (
    select 1
    from public.bets bet
    join public.bet_legs leg on leg.bet_id = bet.id
    where bet.league_id = league.id
      and leg.game_id = slate.game_id
  );
