alter table if exists public.season_passes
add column if not exists iap_product_id text,
add column if not exists iap_transaction_id text,
add column if not exists iap_original_transaction_id text,
add column if not exists iap_environment text,
add column if not exists iap_purchase_date timestamptz,
add column if not exists receipt_validated_at timestamptz;

create index if not exists season_passes_iap_original_transaction_idx
on public.season_passes(iap_original_transaction_id)
where iap_original_transaction_id is not null;

create index if not exists season_passes_iap_transaction_idx
on public.season_passes(iap_transaction_id)
where iap_transaction_id is not null;
