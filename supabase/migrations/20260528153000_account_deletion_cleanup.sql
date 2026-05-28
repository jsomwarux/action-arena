alter table public.league_chat_messages
drop constraint if exists league_chat_messages_user_id_fkey;

alter table public.league_chat_messages
add constraint league_chat_messages_user_id_fkey
foreign key (user_id)
references public.users (id)
on delete cascade;

create or replace function public.reassign_or_remove_leagues_before_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_league record;
  next_commissioner_id uuid;
begin
  update public.seasons
  set
    champion_user_id = case
      when champion_user_id = old.id then null
      else champion_user_id
    end,
    final_standings = case
      when jsonb_typeof(final_standings) = 'array' then (
        select coalesce(jsonb_agg(standing order by ordinality), '[]'::jsonb)
        from jsonb_array_elements(final_standings) with ordinality as standings(standing, ordinality)
        where standing ->> 'user_id' is distinct from old.id::text
      )
      else final_standings
    end,
    awards = case
      when jsonb_typeof(awards) = 'array' then (
        select coalesce(jsonb_agg(award order by ordinality), '[]'::jsonb)
        from jsonb_array_elements(awards) with ordinality as award_rows(award, ordinality)
        where award ->> 'user_id' is distinct from old.id::text
      )
      else awards
    end,
    championship_summary = case
      when championship_summary ->> 'champion_user_id' = old.id::text
        or championship_summary ->> 'opponent_user_id' = old.id::text
        then null
      else championship_summary
    end
  where champion_user_id = old.id
    or final_standings @> jsonb_build_array(jsonb_build_object('user_id', old.id))
    or awards @> jsonb_build_array(jsonb_build_object('user_id', old.id))
    or championship_summary ->> 'champion_user_id' = old.id::text
    or championship_summary ->> 'opponent_user_id' = old.id::text;

  for target_league in
    select id
    from public.leagues
    where commissioner_id = old.id
    for update
  loop
    select lm.user_id into next_commissioner_id
    from public.league_members lm
    where lm.league_id = target_league.id
      and lm.user_id <> old.id
    order by lm.joined_at asc, lm.id asc
    limit 1;

    if next_commissioner_id is null then
      delete from public.leagues
      where id = target_league.id;
    else
      update public.leagues
      set commissioner_id = next_commissioner_id
      where id = target_league.id;
    end if;
  end loop;

  return old;
end;
$$;

drop trigger if exists users_reassign_or_remove_leagues_before_delete on public.users;

create trigger users_reassign_or_remove_leagues_before_delete
before delete on public.users
for each row
execute function public.reassign_or_remove_leagues_before_user_delete();

alter table public.leagues
drop constraint if exists leagues_commissioner_id_fkey;

alter table public.leagues
add constraint leagues_commissioner_id_fkey
foreign key (commissioner_id)
references public.users (id)
on delete restrict;
