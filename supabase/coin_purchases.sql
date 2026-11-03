-- ════════════════════════════════════════════════════════════════════════════
-- Coin purchases (website, Stripe)
-- ════════════════════════════════════════════════════════════════════════════
-- Stripe's webhook (functions/api/stripe-webhook.js, service role) records each
-- paid coin pack here. The game collects them with claim_coin_purchases(),
-- which marks them collected in the same statement, so a purchase can only
-- ever be collected once, on one device. Players can read their own rows and
-- nothing else; they can't insert or edit any.
-- App purchases (Apple / Google, RevenueCat) credit the wallet directly and
-- don't use this table.

create table if not exists coin_purchases (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  coins       int  not null check (coins > 0),
  source      text not null default 'stripe',
  pack        text,
  ref         text unique,                 -- Stripe Checkout session id
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz
);
create index if not exists coin_purchases_unclaimed on coin_purchases (user_id) where claimed_at is null;

alter table coin_purchases enable row level security;
drop policy if exists "own purchases" on coin_purchases;
create policy "own purchases" on coin_purchases for select using (user_id = auth.uid());

create or replace function claim_coin_purchases() returns int
language sql security definer set search_path = public as $$
  with done as (
    update coin_purchases set claimed_at = now()
    where user_id = auth.uid() and claimed_at is null
    returning coins
  )
  select coalesce(sum(coins), 0)::int from done;
$$;
revoke all on function claim_coin_purchases() from public;
grant execute on function claim_coin_purchases() to authenticated;
