-- Coin Store consumable IAP ledger and server-side Arena Coin grants.

alter table if exists public.users
add column if not exists arena_coins integer not null default 500 check (arena_coins >= 0);

create table if not exists public.arena_coin_purchase_transactions (
  apple_transaction_id text primary key,
  apple_original_transaction_id text,
  user_id uuid not null references public.users(id) on delete cascade,
  product_id text not null,
  coin_amount integer not null check (coin_amount > 0),
  iap_environment text,
  iap_purchase_date timestamptz,
  receipt_validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (product_id = 'com.actionarena.app.coins.starter' and coin_amount = 500)
    or (product_id = 'com.actionarena.app.coins.playmaker' and coin_amount = 1200)
    or (product_id = 'com.actionarena.app.coins.commissioner' and coin_amount = 2800)
  )
);

alter table public.arena_coin_purchase_transactions enable row level security;

drop policy if exists "Users can read own Arena Coin purchase transactions"
on public.arena_coin_purchase_transactions;
create policy "Users can read own Arena Coin purchase transactions"
on public.arena_coin_purchase_transactions for select
using (user_id = auth.uid());

drop policy if exists "Service role can manage Arena Coin purchase transactions"
on public.arena_coin_purchase_transactions;
create policy "Service role can manage Arena Coin purchase transactions"
on public.arena_coin_purchase_transactions for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

revoke insert, update, delete on table public.arena_coin_purchase_transactions
from anon, authenticated;

grant select on table public.arena_coin_purchase_transactions to authenticated;

create or replace function public.grant_arena_coin_purchase(
  p_user_id uuid,
  p_apple_transaction_id text,
  p_apple_original_transaction_id text,
  p_product_id text,
  p_coin_amount integer,
  p_iap_environment text,
  p_iap_purchase_date timestamptz
)
returns table (coin_balance integer, granted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_user_id uuid;
  inserted_transaction_id text;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if nullif(trim(p_apple_transaction_id), '') is null then
    raise exception 'Apple transaction id is required';
  end if;

  if not (
    (p_product_id = 'com.actionarena.app.coins.starter' and p_coin_amount = 500)
    or (p_product_id = 'com.actionarena.app.coins.playmaker' and p_coin_amount = 1200)
    or (p_product_id = 'com.actionarena.app.coins.commissioner' and p_coin_amount = 2800)
  ) then
    raise exception 'Unknown Arena Coin product';
  end if;

  insert into public.arena_coin_purchase_transactions (
    apple_transaction_id,
    apple_original_transaction_id,
    user_id,
    product_id,
    coin_amount,
    iap_environment,
    iap_purchase_date,
    receipt_validated_at
  )
  values (
    trim(p_apple_transaction_id),
    nullif(trim(coalesce(p_apple_original_transaction_id, '')), ''),
    p_user_id,
    p_product_id,
    p_coin_amount,
    p_iap_environment,
    p_iap_purchase_date,
    now()
  )
  on conflict (apple_transaction_id) do nothing
  returning apple_transaction_id into inserted_transaction_id;

  if inserted_transaction_id is null then
    select user_id into existing_user_id
    from public.arena_coin_purchase_transactions
    where apple_transaction_id = trim(p_apple_transaction_id);

    if existing_user_id is null then
      raise exception 'Arena Coin purchase transaction could not be resolved';
    end if;

    if existing_user_id <> p_user_id then
      raise exception 'Arena Coin purchase transaction belongs to another user';
    end if;

    select arena_coins into coin_balance
    from public.users
    where id = p_user_id;

    if coin_balance is null then
      raise exception 'User profile not found';
    end if;

    granted := false;
    return next;
    return;
  end if;

  perform set_config('app.allow_arena_coin_update', 'true', true);

  update public.users
  set arena_coins = arena_coins + p_coin_amount
  where id = p_user_id
  returning arena_coins into coin_balance;

  if coin_balance is null then
    raise exception 'User profile not found';
  end if;

  granted := true;
  return next;
end;
$$;

revoke execute on function public.grant_arena_coin_purchase(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.grant_arena_coin_purchase(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  timestamptz
) to service_role;

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
  remaining_balance integer;
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

  perform set_config('app.allow_arena_coin_update', 'true', true);

  update public.users
  set arena_coins = arena_coins - catalog_item.coin_cost
  where id = auth.uid()
    and arena_coins >= catalog_item.coin_cost
  returning arena_coins into remaining_balance;

  if remaining_balance is null then
    raise exception 'Not enough Arena Coins';
  end if;

  insert into public.user_cosmetics (user_id, item_id, category)
  values (auth.uid(), catalog_item.item_id, catalog_item.category)
  returning id into purchased_id;

  return purchased_id;
end;
$$;

grant execute on function public.purchase_cosmetic(text) to authenticated;
