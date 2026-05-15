create or replace function public.notify_bet_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_leg public.bet_legs;
  leg_count integer;
  notification_kind public.notification_type;
  title text;
  body text;
  profit_text text;
begin
  if old.result = new.result or new.result = 'pending' then
    return new;
  end if;

  select * into first_leg
  from public.bet_legs
  where bet_id = new.id
  order by game_start_time
  limit 1;

  select count(*) into leg_count
  from public.bet_legs
  where bet_id = new.id;

  profit_text := case
    when coalesce(new.profit, 0) > 0 then '+' || round(coalesce(new.profit, 0))::text || ' coins'
    when coalesce(new.profit, 0) < 0 then '-' || round(abs(coalesce(new.profit, 0)))::text || ' coins'
    else '0 coins'
  end;

  notification_kind := case
    when new.result = 'win' and new.bet_type in ('parlay', 'teaser') then 'parlay_hits'::public.notification_type
    else 'bet_results'::public.notification_type
  end;

  title := case
    when new.result = 'win' and new.bet_type = 'parlay' then 'Parlay hit'
    when new.result = 'win' and new.bet_type = 'teaser' then 'Teaser hit'
    when new.result = 'win' then 'Pick won'
    when new.result = 'loss' then 'Pick lost'
    else 'Pick pushed'
  end;

  body := case
    when new.result = 'win' and new.bet_type = 'straight' then
      'Your ' || coalesce(first_leg.selection, 'pick') || ' pick hit. ' || profit_text
    when new.result = 'win' and new.bet_type in ('parlay', 'teaser') then
      'Your ' || leg_count || '-leg ' || new.bet_type || ' hit. ' || profit_text
    when new.result = 'loss' then
      'Your ' || new.bet_type || ' pick settled as a loss. ' || profit_text
    else
      'Your ' || new.bet_type || ' pick pushed. 0 coins'
  end;

  perform public.enqueue_notification(
    new.user_id,
    notification_kind,
    title,
    body,
    jsonb_build_object('type', 'bet', 'betId', new.id, 'leagueId', new.league_id),
    new.league_id,
    new.id,
    null,
    'bet_result:' || new.id::text || ':' || new.result::text
  );

  return new;
end;
$$;

create or replace function public.notify_multi_leg_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_bet public.bets;
  won_count integer;
  pending_count integer;
  total_count integer;
begin
  if old.result = new.result or new.result = 'pending' then
    return new;
  end if;

  select * into parent_bet from public.bets where id = new.bet_id;

  if parent_bet.id is null or parent_bet.bet_type = 'straight' or parent_bet.result <> 'pending' then
    return new;
  end if;

  select
    count(*) filter (where result = 'win'),
    count(*) filter (where result = 'pending'),
    count(*)
  into won_count, pending_count, total_count
  from public.bet_legs
  where bet_id = new.bet_id;

  if pending_count = 0 then
    return new;
  end if;

  perform public.enqueue_notification(
    parent_bet.user_id,
    'parlay_leg_updates',
    initcap(parent_bet.bet_type::text) || ' leg update',
    won_count || ' of ' || total_count || ' ' || parent_bet.bet_type || ' legs hit, ' || pending_count || ' game' ||
      case when pending_count = 1 then '' else 's' end || ' remaining',
    jsonb_build_object('type', 'bet', 'betId', parent_bet.id, 'leagueId', parent_bet.league_id),
    parent_bet.league_id,
    parent_bet.id,
    null,
    'leg_update:' || new.id::text || ':' || new.result::text
  );

  return new;
end;
$$;

create or replace function public.notify_bets_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  placed_count integer;
  profile public.users;
  matchup public.weekly_matchups;
  opponent_id uuid;
begin
  select count(*) into placed_count
  from public.bets
  where user_id = new.user_id
    and league_id = new.league_id
    and week_number = new.week_number;

  if placed_count <> 5 then
    return new;
  end if;

  select * into profile from public.users where id = new.user_id;

  perform public.post_system_chat_message(
    new.league_id,
    coalesce(profile.display_name, 'A player') || ' submitted their picks for Week ' || new.week_number,
    jsonb_build_object('event', 'bets_locked', 'userId', new.user_id, 'weekNumber', new.week_number),
    'bets_locked:' || new.league_id::text || ':' || new.week_number || ':' || new.user_id::text
  );

  select * into matchup
  from public.weekly_matchups
  where league_id = new.league_id
    and week_number = new.week_number
    and (home_user_id = new.user_id or away_user_id = new.user_id)
  limit 1;

  if matchup.id is not null then
    opponent_id := case
      when matchup.home_user_id = new.user_id then matchup.away_user_id
      else matchup.home_user_id
    end;

    if opponent_id is not null then
      perform public.enqueue_notification(
        opponent_id,
        'opponent_bets_locked',
        'Opponent submitted picks',
        coalesce(profile.display_name, 'Your opponent') || ' submitted their Week ' || new.week_number || ' picks.',
        jsonb_build_object('type', 'matchup', 'matchupId', matchup.id, 'leagueId', new.league_id),
        new.league_id,
        null,
        matchup.id,
        'opponent_locked:' || matchup.id::text || ':' || new.user_id::text
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.notify_matchup_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  home_profile public.users;
  away_profile public.users;
  home_body text;
  away_body text;
  home_profit_text text;
  away_profit_text text;
begin
  if new.home_profit is null or new.away_profit is null then
    return new;
  end if;

  if old.home_profit is not null and old.away_profit is not null and old.winner_id is not distinct from new.winner_id then
    return new;
  end if;

  select * into home_profile from public.users where id = new.home_user_id;
  select * into away_profile from public.users where id = new.away_user_id;

  home_profit_text := round(new.home_profit)::text || ' coins';
  away_profit_text := round(new.away_profit)::text || ' coins';

  home_body := case
    when new.winner_id = new.home_user_id then 'You beat ' || coalesce(away_profile.display_name, 'your opponent')
    when new.winner_id = new.away_user_id then 'You lost to ' || coalesce(away_profile.display_name, 'your opponent')
    else 'You tied ' || coalesce(away_profile.display_name, 'your opponent')
  end || ' ' || home_profit_text || ' to ' || away_profit_text;

  away_body := case
    when new.winner_id = new.away_user_id then 'You beat ' || coalesce(home_profile.display_name, 'your opponent')
    when new.winner_id = new.home_user_id then 'You lost to ' || coalesce(home_profile.display_name, 'your opponent')
    else 'You tied ' || coalesce(home_profile.display_name, 'your opponent')
  end || ' ' || away_profit_text || ' to ' || home_profit_text;

  perform public.enqueue_notification(
    new.home_user_id,
    'matchup_results',
    'Weekly matchup result',
    home_body,
    jsonb_build_object('type', 'matchup', 'matchupId', new.id, 'leagueId', new.league_id),
    new.league_id,
    null,
    new.id,
    'matchup_result:' || new.id::text || ':' || new.home_user_id::text
  );

  if new.away_user_id is not null then
    perform public.enqueue_notification(
      new.away_user_id,
      'matchup_results',
      'Weekly matchup result',
      away_body,
      jsonb_build_object('type', 'matchup', 'matchupId', new.id, 'leagueId', new.league_id),
      new.league_id,
      null,
      new.id,
      'matchup_result:' || new.id::text || ':' || new.away_user_id::text
    );
  end if;

  perform public.post_system_chat_message(
    new.league_id,
    'Week ' || new.week_number || ' results are in!',
    jsonb_build_object('event', 'week_results', 'weekNumber', new.week_number, 'matchupId', new.id),
    'week_results:' || new.league_id::text || ':' || new.week_number
  );

  return new;
end;
$$;
