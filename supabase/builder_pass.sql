-- ════════════════════════════════════════════════════════════════════════════
-- Builder Pass: who bought which season's premium track
-- ════════════════════════════════════════════════════════════════════════════
-- Stripe's webhook (server/server.js, functions/api/stripe-webhook.js) writes a row
-- when a pass checkout is paid and deletes it on a refund or chargeback. The game
-- reads the player's own rows (lib/progress.js loadPassOwners). Players can't write
-- here at all: only the server (service role).
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.pass_owners (
  user_id    uuid not null references auth.users (id) on delete cascade,
  season     text not null,
  ref        text unique,                  -- the Stripe Checkout session
  created_at timestamptz not null default now(),
  primary key (user_id, season)
);

alter table public.pass_owners enable row level security;

drop policy if exists "read own pass" on public.pass_owners;
create policy "read own pass" on public.pass_owners
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.pass_owners from anon, authenticated;
grant select on public.pass_owners to authenticated;
