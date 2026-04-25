create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  achievement_key text not null check (achievement_key ~ '^[a-z0-9_]+$'),
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, league_id, achievement_key)
);

create index if not exists user_achievements_user_league_idx
on public.user_achievements (user_id, league_id, earned_at desc);

alter table public.user_achievements enable row level security;

create policy "League members can read member achievements"
on public.user_achievements for select
to authenticated
using (public.is_league_member(league_id));

create policy "Users can store their own achievements"
on public.user_achievements for insert
to authenticated
with check (user_id = auth.uid() and public.is_league_member(league_id));

create policy "Users can refresh their own achievements"
on public.user_achievements for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.is_league_member(league_id));
