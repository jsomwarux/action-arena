create or replace function public.set_pick_of_week(p_bet_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_bet public.bets%rowtype;
  reveal_time timestamptz;
  lock_count integer;
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
    raise exception 'You can only change Pick of the Week on your own card';
  end if;

  if target_bet.result <> 'pending' then
    raise exception 'Settled picks cannot become Pick of the Week';
  end if;

  reveal_time := public.league_week_reveal_time(target_bet.league_id, target_bet.week_number);
  if reveal_time is not null and now() >= reveal_time then
    raise exception 'Pick of the Week can no longer be changed after first kickoff';
  end if;

  if exists (
    select 1
    from public.bet_legs bl
    where bl.bet_id = target_bet.id
      and (bl.locked or bl.game_start_time <= now())
  ) then
    raise exception 'That pick is locked and cannot become Pick of the Week';
  end if;

  update public.bets
  set is_lock = false
  where league_id = target_bet.league_id
    and user_id = target_bet.user_id
    and week_number = target_bet.week_number
    and is_lock
    and id <> target_bet.id;

  update public.bets
  set is_lock = true
  where id = target_bet.id;

  select count(*)
  into lock_count
  from public.bets
  where league_id = target_bet.league_id
    and user_id = target_bet.user_id
    and week_number = target_bet.week_number
    and is_lock;

  if lock_count <> 1 then
    raise exception 'Exactly one Pick of the Week is required';
  end if;

  return target_bet.id;
end;
$$;

grant execute on function public.set_pick_of_week(uuid) to authenticated;
