-- Monetization foundation: Arena Coins, cosmetics, Season Passes, and ad-access hooks.

alter type public.chat_message_type add value if not exists 'sticker';

alter table public.users
add column if not exists arena_coins integer not null default 500 check (arena_coins >= 0);

update public.users
set arena_coins = 500
where arena_coins is null;

create table if not exists public.cosmetic_catalog (
  item_id text primary key,
  category text not null check (
    category in (
      'team_logo',
      'trophy_skin',
      'lock_effect',
      'win_celebration',
      'chat_sticker_pack',
      'profile_frame'
    )
  ),
  name text not null,
  coin_cost integer not null default 0 check (coin_cost >= 0),
  is_season_pass_exclusive boolean not null default false,
  season_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_cosmetics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null references public.cosmetic_catalog(item_id) on delete restrict,
  category text not null check (
    category in (
      'team_logo',
      'trophy_skin',
      'lock_effect',
      'win_celebration',
      'chat_sticker_pack',
      'profile_frame'
    )
  ),
  is_equipped boolean not null default false,
  purchased_at timestamptz not null default now(),
  equipped_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, item_id)
);

create unique index if not exists user_cosmetics_one_equipped_per_category_idx
on public.user_cosmetics(user_id, category)
where is_equipped;

create index if not exists user_cosmetics_user_equipped_idx
on public.user_cosmetics(user_id, is_equipped);

create table if not exists public.season_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  season_year integer not null,
  redeemed_code text,
  source text not null default 'redeem_code',
  created_at timestamptz not null default now(),
  unique (user_id, season_year)
);

create index if not exists season_passes_user_year_idx
on public.season_passes(user_id, season_year);

create table if not exists public.season_pass_redeem_codes (
  code text primary key,
  season_year integer not null,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redeemed_count integer not null default 0 check (redeemed_count >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.odds_release_windows (
  id uuid primary key default gen_random_uuid(),
  sport public.league_sport not null default 'nfl',
  season_year integer not null,
  week_number integer not null check (week_number between 1 and 17),
  odds_available_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (sport, season_year, week_number)
);

alter table public.cosmetic_catalog enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.season_passes enable row level security;
alter table public.season_pass_redeem_codes enable row level security;
alter table public.odds_release_windows enable row level security;

drop policy if exists "Authenticated users can read cosmetic catalog" on public.cosmetic_catalog;
create policy "Authenticated users can read cosmetic catalog"
on public.cosmetic_catalog for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read equipped cosmetics" on public.user_cosmetics;
create policy "Authenticated users can read equipped cosmetics"
on public.user_cosmetics for select
to authenticated
using (true);

drop policy if exists "Users can read their own season passes" on public.season_passes;
create policy "Users can read their own season passes"
on public.season_passes for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Service role can manage season passes" on public.season_passes;
create policy "Service role can manage season passes"
on public.season_passes for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage redeem codes" on public.season_pass_redeem_codes;
create policy "Service role can manage redeem codes"
on public.season_pass_redeem_codes for all
to service_role
using (true)
with check (true);

drop policy if exists "Authenticated users can read release windows" on public.odds_release_windows;
create policy "Authenticated users can read release windows"
on public.odds_release_windows for select
to authenticated
using (true);

drop policy if exists "Service role can manage release windows" on public.odds_release_windows;
create policy "Service role can manage release windows"
on public.odds_release_windows for all
to service_role
using (true)
with check (true);

insert into public.cosmetic_catalog (item_id, category, name, coin_cost, is_season_pass_exclusive, season_label)
values
  ('logo_gridiron_wolf', 'team_logo', 'Gridiron Wolf', 150, false, null),
  ('logo_blitz_fox', 'team_logo', 'Blitz Fox', 150, false, null),
  ('logo_ice_viper', 'team_logo', 'Ice Viper', 175, false, null),
  ('logo_crown_lion', 'team_logo', 'Crown Lion', 200, false, null),
  ('logo_neon_bull', 'team_logo', 'Neon Bull', 175, false, null),
  ('logo_chaos_bear', 'team_logo', 'Chaos Bear', 225, false, null),
  ('logo_blue_orbit', 'team_logo', 'Blue Orbit', 200, false, null),
  ('logo_pixel_tiger', 'team_logo', 'Pixel Tiger', 150, false, null),
  ('logo_cash_shark', 'team_logo', 'Cash Shark', 225, false, null),
  ('logo_gold_spire', 'team_logo', 'Gold Spire', 250, false, null),
  ('logo_signal_wave', 'team_logo', 'Signal Wave', 175, false, null),
  ('logo_red_alert', 'team_logo', 'Red Alert', 275, false, null),
  ('logo_fire_hawk', 'team_logo', 'Fire Hawk', 200, false, null),
  ('logo_lucky_bolt', 'team_logo', 'Lucky Bolt', 150, false, null),
  ('logo_cyber_ram', 'team_logo', 'Cyber Ram', 225, false, null),
  ('logo_trophy_ape', 'team_logo', 'Trophy Ape', 300, false, null),
  ('logo_salty_goat', 'team_logo', 'Salty Goat', 200, false, null),
  ('logo_money_press', 'team_logo', 'Money Press', 250, false, null),
  ('logo_four_leaf', 'team_logo', 'Four Leaf', 175, false, null),
  ('logo_midnight_moon', 'team_logo', 'Midnight Moon', 225, false, null),
  ('logo_take_volcano', 'team_logo', 'Take Volcano', 250, false, null),
  ('logo_halo_zero', 'team_logo', 'Halo Zero', 275, false, null),
  ('logo_laser_cat', 'team_logo', 'Laser Cat', 200, false, null),
  ('logo_arctic_crown', 'team_logo', 'Arctic Crown', 300, false, null),
  ('trophy_golden_crown', 'trophy_skin', 'Golden Crown', 200, false, null),
  ('trophy_diamond', 'trophy_skin', 'Diamond Cup', 350, false, null),
  ('trophy_flaming_skull', 'trophy_skin', 'Flaming Skull', 400, false, null),
  ('trophy_money_printer', 'trophy_skin', 'Money Printer', 500, false, null),
  ('lock_fire', 'lock_effect', 'Animated Fire', 150, false, null),
  ('lock_lightning', 'lock_effect', 'Lightning Bolt', 200, false, null),
  ('lock_frost', 'lock_effect', 'Ice/Frost', 225, false, null),
  ('lock_neon', 'lock_effect', 'Neon Glow', 300, false, null),
  ('celebration_money_rain', 'win_celebration', 'Money Rain', 200, false, null),
  ('celebration_crowd', 'win_celebration', 'Stadium Crowd', 250, false, null),
  ('celebration_fireworks', 'win_celebration', 'Fireworks', 400, false, null),
  ('stickers_talk_trash', 'chat_sticker_pack', 'Talk Trash Pack', 100, false, null),
  ('stickers_moneyline', 'chat_sticker_pack', 'Moneyline Pack', 150, false, null),
  ('stickers_sweat', 'chat_sticker_pack', 'Sunday Sweat Pack', 150, false, null),
  ('stickers_trophy_flex', 'chat_sticker_pack', 'Trophy Flex Pack', 200, false, null),
  ('frame_electric', 'profile_frame', 'Electric Frame', 100, false, null),
  ('frame_amber', 'profile_frame', 'Amber Frame', 150, false, null),
  ('frame_cyan', 'profile_frame', 'Cyan Frame', 175, false, null),
  ('frame_gold', 'profile_frame', 'Gold Frame', 250, false, null),
  ('s1_logo_founder', 'team_logo', 'Founder Star', 0, true, 'Season 1 Exclusive'),
  ('s1_frame_champion', 'profile_frame', 'S1 Champion Frame', 0, true, 'Season 1 Exclusive'),
  ('s1_lock_overdrive', 'lock_effect', 'Lock Overdrive', 0, true, 'Season 1 Exclusive'),
  ('s1_trophy_legacy', 'trophy_skin', 'Legacy Trophy', 0, true, 'Season 1 Exclusive')
on conflict (item_id) do update
set category = excluded.category,
    name = excluded.name,
    coin_cost = excluded.coin_cost,
    is_season_pass_exclusive = excluded.is_season_pass_exclusive,
    season_label = excluded.season_label;

insert into public.season_pass_redeem_codes (code, season_year, max_redemptions, active)
values
  ('ARENA-S1-TEST', extract(year from now())::integer, null, true),
  ('LOCK-S1-ACCESS', extract(year from now())::integer, null, true),
  ('PASS-S1-FOUNDER', extract(year from now())::integer, null, true),
  ('ACTION-S1-VIP', extract(year from now())::integer, null, true)
on conflict (code) do update
set active = excluded.active,
    max_redemptions = excluded.max_redemptions,
    season_year = excluded.season_year;

create or replace function public.prevent_direct_arena_coin_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.arena_coins is distinct from old.arena_coins
     and coalesce(current_setting('app.allow_arena_coin_update', true), '') <> 'true' then
    raise exception 'Arena Coins can only be changed by trusted wallet functions';
  end if;

  return new;
end;
$$;

drop trigger if exists users_prevent_direct_arena_coin_update on public.users;
create trigger users_prevent_direct_arena_coin_update
before update of arena_coins on public.users
for each row execute function public.prevent_direct_arena_coin_update();

create or replace function public.has_season_pass(
  target_user_id uuid default auth.uid(),
  target_season_year integer default extract(year from now())::integer
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.season_passes sp
    where sp.user_id = target_user_id
      and sp.season_year = target_season_year
  );
$$;

create or replace function public.grant_season_pass_cosmetics(
  target_user_id uuid,
  target_season_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_cosmetics (user_id, item_id, category, metadata)
  select
    target_user_id,
    item_id,
    category,
    jsonb_build_object('season_year', target_season_year, 'source', 'season_pass')
  from public.cosmetic_catalog
  where is_season_pass_exclusive = true
  on conflict (user_id, item_id) do nothing;
end;
$$;

create or replace function public.purchase_cosmetic(p_item_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  catalog_item public.cosmetic_catalog;
  existing_id uuid;
  purchased_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into catalog_item
  from public.cosmetic_catalog
  where item_id = p_item_id;

  if catalog_item.item_id is null then
    raise exception 'Cosmetic item not found';
  end if;

  if catalog_item.is_season_pass_exclusive then
    raise exception 'This cosmetic is exclusive to the Season Pass';
  end if;

  select id into existing_id
  from public.user_cosmetics
  where user_id = auth.uid()
    and item_id = p_item_id;

  if existing_id is not null then
    return existing_id;
  end if;

  if not exists (
    select 1
    from public.users
    where id = auth.uid()
      and arena_coins >= catalog_item.coin_cost
  ) then
    raise exception 'Not enough Arena Coins';
  end if;

  perform set_config('app.allow_arena_coin_update', 'true', true);

  update public.users
  set arena_coins = arena_coins - catalog_item.coin_cost
  where id = auth.uid();

  insert into public.user_cosmetics (user_id, item_id, category)
  values (auth.uid(), catalog_item.item_id, catalog_item.category)
  returning id into purchased_id;

  return purchased_id;
end;
$$;

create or replace function public.equip_cosmetic(p_item_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owned_item public.user_cosmetics;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into owned_item
  from public.user_cosmetics
  where user_id = auth.uid()
    and item_id = p_item_id;

  if owned_item.id is null then
    raise exception 'Purchase this cosmetic before equipping it';
  end if;

  update public.user_cosmetics
  set is_equipped = false,
      equipped_at = null
  where user_id = auth.uid()
    and category = owned_item.category
    and is_equipped = true;

  update public.user_cosmetics
  set is_equipped = true,
      equipped_at = now()
  where id = owned_item.id;

  return owned_item.id;
end;
$$;

create or replace function public.redeem_season_pass(
  p_code text,
  p_season_year integer default extract(year from now())::integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(p_code));
  code_row public.season_pass_redeem_codes;
  pass_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into pass_id
  from public.season_passes
  where user_id = auth.uid()
    and season_year = p_season_year;

  if pass_id is not null then
    perform public.grant_season_pass_cosmetics(auth.uid(), p_season_year);
    return pass_id;
  end if;

  select * into code_row
  from public.season_pass_redeem_codes
  where code = normalized_code
  for update;

  if code_row.code is null
     or code_row.active = false
     or code_row.season_year <> p_season_year
     or (code_row.expires_at is not null and code_row.expires_at <= now())
     or (code_row.max_redemptions is not null and code_row.redeemed_count >= code_row.max_redemptions) then
    raise exception 'Invalid or expired Season Pass code';
  end if;

  insert into public.season_passes (user_id, season_year, redeemed_code)
  values (auth.uid(), p_season_year, normalized_code)
  returning id into pass_id;

  update public.season_pass_redeem_codes
  set redeemed_count = redeemed_count + 1
  where code = normalized_code;

  perform public.grant_season_pass_cosmetics(auth.uid(), p_season_year);

  return pass_id;
end;
$$;

create or replace function public.can_access_bet_board(
  p_league_id uuid,
  p_week_number integer,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  league_record public.leagues;
  release_record public.odds_release_windows;
begin
  if p_user_id is null then
    return false;
  end if;

  select * into league_record
  from public.leagues
  where id = p_league_id;

  if league_record.id is null then
    return false;
  end if;

  if public.has_season_pass(p_user_id, league_record.season_year) then
    return true;
  end if;

  select * into release_record
  from public.odds_release_windows
  where sport = league_record.sport
    and season_year = league_record.season_year
    and week_number = p_week_number;

  if release_record.id is null then
    return true;
  end if;

  return now() >= release_record.odds_available_at + interval '30 minutes';
end;
$$;

create or replace function public.enforce_bet_board_access_on_bet_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_bet_board(new.league_id, new.week_number, new.user_id) then
    raise exception 'Season Pass holders get the first 30 minutes of new odds access';
  end if;

  return new;
end;
$$;

drop trigger if exists bets_enforce_bet_board_access on public.bets;
create trigger bets_enforce_bet_board_access
before insert on public.bets
for each row execute function public.enforce_bet_board_access_on_bet_insert();

grant execute on function public.has_season_pass(uuid, integer) to authenticated;
grant execute on function public.purchase_cosmetic(text) to authenticated;
grant execute on function public.equip_cosmetic(text) to authenticated;
grant execute on function public.redeem_season_pass(text, integer) to authenticated;
grant execute on function public.can_access_bet_board(uuid, integer, uuid) to authenticated;
