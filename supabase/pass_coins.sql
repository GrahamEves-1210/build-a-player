-- ════════════════════════════════════════════════════════════════════════════
-- Builder Pass for coins: the premium track bought with 16,000 coins
-- ════════════════════════════════════════════════════════════════════════════
-- The game calls this with the player's own session (lib/progress.js buyPassCoins:
-- supabase.rpc('buy_pass_with_coins')). Everything is decided here, in one
-- transaction, so it can't be faked from a browser: the player can't write
-- pass_owners (builder_pass.sql), and this is the only way coins turn into a pass.
--   • the season has to be on sale today (New York time) and not already his
--   • his accounts row is locked, so two calls at once can't both pay
--   • the account has to hold the price in app_profile.coins (the coins the server
--     has, not what a device says)
--   • the coins come off, the wallet gets a new rev, and the pass_owners row goes in.
--     All of it or none of it.
-- The new rev is what keeps the coins from coming back: a save a device built on the
-- wallet from before the purchase no longer matches and is refused (the game saves
-- with "only if rev is still what I read"), so it reads the wallet again and merges.
-- The coin guard (account_guards.sql guard_account_save) runs on this update like on
-- any player's save. It only limits gains, so a drop goes through; this function
-- still checks the row afterwards and takes the whole purchase back if the coins
-- aren't what it wrote.
-- Answers (jsonb): { ok: true, coins, rev, prev }   coins left, the wallet's new rev and the one before
--                  { ok: false, reason }            'signin' | 'closed' | 'price' | 'owned' | 'short' (with coins)
--
-- The price: 16000 below and PASS_COINS in src/lib/pass.js. The game sends the price
-- it showed and this refuses a different one, so a player is never charged anything
-- but the number on the button. node scripts/pass-coins-check.mjs checks the two match.
-- A new season: add its row to the list below (with src/lib/pass.js SEASONS).
--
-- Needs: accounts.app_profile (app_shop.sql) and pass_owners (builder_pass.sql).
-- Run once in the Supabase SQL editor. Safe to run again.

create or replace function public.buy_pass_with_coins(p_season text, p_price int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  price constant int := 16000;
  me uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
  on_sale boolean;
  w jsonb;
  have numeric;
  remain numeric;
  held numeric;
  old_rev text;
  new_rev text;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'reason', 'signin');
  end if;

  -- the seasons, as src/lib/pass.js SEASONS: on sale from start up to (not including) end
  select today >= s.starts and today < s.ends into on_sale
    from (values ('s1', date '2026-10-29', date '2026-12-29')) as s(id, starts, ends)
   where s.id = p_season;
  if not coalesce(on_sale, false) then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if p_price is distinct from price then
    return jsonb_build_object('ok', false, 'reason', 'price', 'price', price);
  end if;

  -- his row, held until this ends: a second call waits here and then finds the pass
  select app_profile into w from public.accounts where id = me for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'short', 'coins', 0);
  end if;
  if exists (select 1 from public.pass_owners where user_id = me and season = p_season) then
    return jsonb_build_object('ok', false, 'reason', 'owned');
  end if;

  if w is null or jsonb_typeof(w) <> 'object' or jsonb_typeof(w -> 'coins') <> 'number' then
    return jsonb_build_object('ok', false, 'reason', 'short', 'coins', 0);
  end if;
  have := (w ->> 'coins')::numeric;
  if have < price then
    return jsonb_build_object('ok', false, 'reason', 'short', 'coins', have);
  end if;

  remain := round(have - price);
  old_rev := w ->> 'rev';
  new_rev := 'pass-' || p_season || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text;
  update public.accounts
     set app_profile = jsonb_set(jsonb_set(w, '{coins}', to_jsonb(remain)), '{rev}', to_jsonb(new_rev))
   where id = me
  returning (app_profile ->> 'coins')::numeric into held;
  -- whatever triggers the table has, the coins must be exactly what was written
  if held is distinct from remain then
    raise exception 'pass_coins: the wallet did not take the charge (wrote %, holds %)', remain, held;
  end if;

  -- ref is unique across the table, so it carries the account too
  insert into public.pass_owners (user_id, season, ref)
  values (me, p_season, 'coins:' || p_season || ':' || me::text);

  return jsonb_build_object('ok', true, 'coins', remain, 'rev', new_rev, 'prev', old_rev);
end;
$$;

revoke all on function public.buy_pass_with_coins(text, int) from public, anon;
grant execute on function public.buy_pass_with_coins(text, int) to authenticated;
