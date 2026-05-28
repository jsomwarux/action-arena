create or replace function public.enforce_teaser_leg_count_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_bet_id uuid;
  affected_old_bet_id uuid;
  candidate_bet_id uuid;
  leg_count integer;
  target_bet_type public.bet_type;
begin
  if tg_table_name = 'bet_legs' then
    affected_bet_id := coalesce(new.bet_id, old.bet_id);
    affected_old_bet_id := case
      when tg_op = 'UPDATE' and old.bet_id is distinct from new.bet_id then old.bet_id
      else null
    end;
  else
    affected_bet_id := coalesce(new.id, old.id);
    affected_old_bet_id := null;
  end if;

  foreach candidate_bet_id in array array_remove(array[affected_bet_id, affected_old_bet_id], null) loop
    select bet_type
    into target_bet_type
    from public.bets
    where id = candidate_bet_id;

    if target_bet_type = 'teaser' then
      select count(*)
      into leg_count
      from public.bet_legs
      where bet_id = candidate_bet_id;

      if leg_count < 2 or leg_count > 4 then
        raise exception 'Teasers must have 2 to 4 legs';
      end if;
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists bets_enforce_teaser_leg_count_integrity on public.bets;
create constraint trigger bets_enforce_teaser_leg_count_integrity
after insert or update of bet_type on public.bets
deferrable initially deferred
for each row
execute function public.enforce_teaser_leg_count_integrity();

drop trigger if exists bet_legs_enforce_teaser_leg_count_integrity on public.bet_legs;
create constraint trigger bet_legs_enforce_teaser_leg_count_integrity
after insert or update of bet_id or delete on public.bet_legs
deferrable initially deferred
for each row
execute function public.enforce_teaser_leg_count_integrity();
