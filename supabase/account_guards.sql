-- ════════════════════════════════════════════════════════════════════════════
-- Account guards: what a player's own device may write to their accounts row
-- ════════════════════════════════════════════════════════════════════════════
-- The game saves from the player's device with their own session, and the
-- "own account" policy lets a player update their whole row. Without this, one
-- line in a browser console could:
--   • turn on BAP Pro or ad-free (is_plus, subscription_status, ads_disabled)
--   • set any coin balance (score_guards.sql capped one save at +6,000, but
--     nothing limited how many saves, and a wallet set to null first had no cap)
--   • set any MVP / OPOY / DPOY count
--   • take a rude or someone else's username, skipping set-username.js
--
-- This replaces guard_account_save from score_guards.sql (same trigger name, now
-- on INSERT too). It trims a bad save instead of refusing it, so an honest
-- player's save never fails:
--   • Pro, ad-free and subscription fields: only the server (Stripe webhook,
--     service role) changes them; a player's write keeps what was there
--   • coins: a budget of 6,000 that refills 3,000 an hour (an honest hour of
--     play earns a few hundred), plus every coin pack collected since the last
--     save, counted once
--   • awards: +1 at a time, at most one every 20 seconds
--   • username: 2-32 letters, numbers, . _ or -, nothing rude, not taken by
--     another account (case-insensitive); otherwise the old name stays
--   • today's XP (Players of the Day): as score_guards.sql (a day tops out at
--     10,000), and also a budget of 1,000 that refills 3,000 an hour, so the
--     board takes hours of real play, not ten quick saves; yesterday's tally
--     can't arrive bigger than what today said it was
--   • the wallet's "last changed" time can't be in the future (a far-future time
--     made a tampered wallet win every merge on every device)
-- The server and SQL run in the dashboard aren't limited.
-- Run once in the Supabase SQL editor, after score_guards.sql. Safe to run again.

alter table public.accounts add column if not exists coin_guard jsonb;
alter table public.accounts add column if not exists award_at timestamptz;

create or replace function public.guard_account_save() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- columns only the server writes (any that don't exist are simply ignored)
  server_only constant text[] := array['is_plus', 'ads_disabled', 'subscription_status', 'subscription_id',
                                       'stripe_customer_id', 'coin_guard', 'award_at'];
  awards constant text[] := array['classic_mvps', 'alltime_mvps', 'classic_opoys', 'alltime_opoys', 'classic_dpoys', 'alltime_dpoys'];
  bad constant text[] := array['fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'bastard', 'slut', 'whore',
                               'fag', 'nigg', 'retard', 'kys', 'killyourself', 'rape', 'nazi', 'porn', 'sex', 'admin', 'buildaplayer'];
  day_max   constant int := 10000;
  step_max  constant int := 1000;
  coin_cap  constant numeric := 6000;   -- the most one save can add (a full budget)
  coin_rate constant numeric := 3000;   -- budget refilled per hour
  today date := (now() at time zone 'America/New_York')::date;
  is_ins boolean := tg_op = 'INSERT';
  o_row jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  n_row jsonb;
  keep jsonb;
  f text; t jsonb; o jsonb; xp int; old_xp int; xg jsonb; xbudget numeric; xgain numeric := 0;
  coins_new numeric; coins_old numeric; bought numeric := 0; budget numeric; g jsonb; since timestamptz; gain numeric;
  a text; a_new numeric; a_old numeric; award_ok boolean;
  nm text; plain text;
begin
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;

  -- ── Server-only columns: a player's write keeps what was there (nothing, on a new row) ──
  select coalesce(jsonb_object_agg(k, case when not is_ins then o_row -> k
                                           when k in ('is_plus', 'ads_disabled') then 'false'::jsonb
                                           else 'null'::jsonb end), '{}'::jsonb)
    into keep from unnest(server_only) k;
  new := jsonb_populate_record(new, keep);

  -- ── Players of the Day: today's and yesterday's tally ──
  xg := case when not is_ins then old.coin_guard end;
  xbudget := least(1000, coalesce((xg ->> 'xb')::numeric, 1000)
             + 3000 * extract(epoch from now() - coalesce(to_timestamp((xg ->> 'xt')::numeric), now() - interval '1 hour')) / 3600);
  if new.cos is not null and jsonb_typeof(new.cos) = 'object' then
    foreach f in array array['today', 'yday'] loop
      t := new.cos -> f;
      continue when t is null or jsonb_typeof(t) <> 'object';
      if (t ->> 'd') is null or (t ->> 'd') !~ '^\d{4}-\d{2}-\d{2}$'
         or (t ->> 'd')::date not in (today, today - 1) then
        new.cos := new.cos - f;
        continue;
      end if;
      xp := greatest(0, least(day_max, coalesce((t ->> 'xp')::numeric, 0)::int));
      o := case when not is_ins and old.cos is not null and jsonb_typeof(old.cos) = 'object' then old.cos -> f end;
      if o is not null and (o ->> 'd') = (t ->> 'd') then
        old_xp := coalesce((o ->> 'xp')::numeric, 0)::int;
        xp := least(xp, old_xp + step_max);
      elsif f = 'yday' then
        o := case when not is_ins and old.cos is not null and jsonb_typeof(old.cos) = 'object' then old.cos -> 'today' end;
        if o is not null and (o ->> 'd') = (t ->> 'd') then
          xp := least(xp, coalesce((o ->> 'xp')::numeric, 0)::int + step_max);
        else
          xp := least(xp, step_max);
        end if;
      else
        xp := least(xp, step_max);
      end if;
      -- today's growth also spends the hourly budget
      if f = 'today' then
        old_xp := case when o is not null and (o ->> 'd') = (t ->> 'd') then coalesce((o ->> 'xp')::numeric, 0)::int else 0 end;
        if xp > old_xp then
          xp := least(xp, old_xp + greatest(0, floor(xbudget))::int);
          xgain := xp - old_xp;
        end if;
      end if;
      new.cos := jsonb_set(new.cos, array[f, 'xp'], to_jsonb(xp));
      new.cos := jsonb_set(new.cos, array[f, 'g'], to_jsonb(greatest(0, least(500, coalesce((t ->> 'g')::numeric, 0)::int))));
    end loop;
  end if;

  if xgain > 0 then
    new.coin_guard := coalesce(new.coin_guard, '{}'::jsonb)
      || jsonb_build_object('xt', extract(epoch from now()), 'xb', round(xbudget - xgain));
  end if;

  -- ── Coins: a refilling budget, plus coin packs collected since the last save ──
  if new.app_profile is not null and jsonb_typeof(new.app_profile) = 'object' and (new.app_profile ? 'coins') then
    coins_new := greatest(0, coalesce((new.app_profile ->> 'coins')::numeric, 0));
    -- a missing old wallet counts as empty (no more "null it first, then write anything")
    coins_old := case when not is_ins and old.app_profile is not null and jsonb_typeof(old.app_profile) = 'object'
                      then coalesce((old.app_profile ->> 'coins')::numeric, 0) else 0 end;
    g := case when not is_ins then old.coin_guard end;
    since := coalesce(to_timestamp((g ->> 'p')::numeric), now() - interval '1 hour');
    if coins_new > coins_old then
      budget := least(coin_cap, coalesce((g ->> 'b')::numeric, coin_cap)
                + coin_rate * extract(epoch from now() - coalesce(to_timestamp((g ->> 't')::numeric), now() - interval '2 hours')) / 3600);
      if to_regclass('public.coin_purchases') is not null then
        execute 'select coalesce(sum(coins), 0) from public.coin_purchases
                 where user_id = $1 and claimed_at > $2'
          into bought using new.id, since;
      end if;
      coins_new := least(coins_new, coins_old + greatest(0, budget) + bought);
      gain := coins_new - coins_old;
      budget := greatest(0, budget - greatest(0, gain - bought));
      new.coin_guard := coalesce(new.coin_guard, '{}'::jsonb)
        || jsonb_build_object('t', extract(epoch from now()), 'b', round(budget), 'p', extract(epoch from now()));
    end if;
    new.app_profile := jsonb_set(new.app_profile, '{coins}', to_jsonb(round(coins_new)));
  end if;
  if new.app_profile is not null and jsonb_typeof(new.app_profile) = 'object'
     and jsonb_typeof(new.app_profile -> 'at') = 'number'
     and (new.app_profile ->> 'at')::numeric > extract(epoch from now()) * 1000 then
    new.app_profile := jsonb_set(new.app_profile, '{at}', to_jsonb(floor(extract(epoch from now()) * 1000)));
  end if;

  -- ── Awards: +1 at a time, one every 20 seconds ──
  award_ok := is_ins or (o_row ->> 'award_at') is null or (o_row ->> 'award_at')::timestamptz < now() - interval '20 seconds';
  n_row := to_jsonb(new);
  foreach a in array awards loop
    continue when not (n_row ? a);
    a_new := coalesce((n_row ->> a)::numeric, 0);
    a_old := coalesce((o_row ->> a)::numeric, 0);
    if a_new <> a_old then
      if award_ok and a_new = a_old + 1 then
        new := jsonb_populate_record(new, jsonb_build_object('award_at', now()));
        award_ok := false;
      else
        new := jsonb_populate_record(new, jsonb_build_object(a, a_old));
      end if;
    end if;
  end loop;

  -- ── Username: valid, clean and free, or the old one stays ──
  nm := new.username;
  if nm is distinct from (o_row ->> 'username') and nm is not null then
    plain := regexp_replace(translate(lower(nm), '0134 57', 'oiea st'), '[^a-z]', '', 'g');
    if nm !~ '^[A-Za-z0-9_.-]{2,32}$'
       or exists (select 1 from unnest(bad) b where position(b in plain) > 0)
       or exists (select 1 from public.accounts x where lower(x.username) = lower(nm) and x.id <> new.id) then
      new.username := o_row ->> 'username';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_account_save on public.accounts;
create trigger guard_account_save
  before insert or update on public.accounts
  for each row execute function public.guard_account_save();

-- ── Refunds (stripe-webhook.js): a refunded coin pack is marked, and can't be collected ──
alter table public.coin_purchases add column if not exists refunded_at timestamptz;
create or replace function claim_coin_purchases() returns int
language sql security definer set search_path = public as $$
  with done as (
    update coin_purchases set claimed_at = now()
    where user_id = auth.uid() and claimed_at is null and refunded_at is null
    returning coins
  )
  select coalesce(sum(coins), 0)::int from done;
$$;
revoke all on function claim_coin_purchases() from public;
grant execute on function claim_coin_purchases() to authenticated;
