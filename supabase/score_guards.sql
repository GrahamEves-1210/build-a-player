-- ════════════════════════════════════════════════════════════════════════════
-- Score guards: what a player's own device can write to their account row
-- ════════════════════════════════════════════════════════════════════════════
-- The game saves progress from the player's device (src/lib/progress.js):
--   accounts.cos.today / .yday   today's (and yesterday's) XP + games: Players of the Day
--   accounts.app_profile.coins   the coin wallet
-- A player may update their own row, so without a check a crafted save could
-- claim 999,999 XP (and the Players of the Day payout) or any coin balance.
-- This trigger trims a save to what's possible instead of refusing it, so a
-- real player's save never fails:
--   • a day's XP: at most 10,000 (a title season is ~220), and at most +1,000
--     XP per save on the same day (one save covers a few seconds of play)
--   • a day's date: today or yesterday (New York time, the game's day), or it's dropped
--   • coins: at most +6,000 per save, plus coin purchases/gifts collected in the
--     last hour (coin_purchases), so a real purchase always lands in full
-- The server itself (Stripe/RevenueCat webhooks, service role) and SQL you run
-- by hand in the dashboard aren't limited.
-- Run once in the Supabase SQL editor. Safe to run again.

create or replace function public.guard_account_save() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  day_max   constant int := 10000;
  step_max  constant int := 1000;
  coin_step constant int := 6000;
  today date := (now() at time zone 'America/New_York')::date;
  f text;
  t jsonb; o jsonb;
  xp int; old_xp int;
  coins_new bigint; coins_old bigint; bought bigint;
begin
  -- the server and the dashboard (service role / postgres) aren't limited
  if coalesce(auth.role(), '') = 'service_role' or auth.uid() is null then
    return new;
  end if;

  -- ── Players of the Day: today's and yesterday's tally ──
  if new.cos is not null and jsonb_typeof(new.cos) = 'object' then
    foreach f in array array['today', 'yday'] loop
      t := new.cos -> f;
      continue when t is null or jsonb_typeof(t) <> 'object';
      -- a date that isn't today or yesterday: drop it
      if (t ->> 'd') is null or (t ->> 'd') !~ '^\d{4}-\d{2}-\d{2}$'
         or (t ->> 'd')::date not in (today, today - 1) then
        new.cos := new.cos - f;
        continue;
      end if;
      xp := greatest(0, least(day_max, coalesce((t ->> 'xp')::numeric, 0)::int));
      -- the same day as the row already holds: it can only grow so much in one save
      o := case when old.cos is not null and jsonb_typeof(old.cos) = 'object' then old.cos -> f end;
      if o is not null and (o ->> 'd') = (t ->> 'd') then
        old_xp := coalesce((o ->> 'xp')::numeric, 0)::int;
        xp := least(xp, old_xp + step_max);
      elsif f = 'yday' then
        -- yesterday's tally arrives already whole: keep it to what "today" said it was
        o := case when old.cos is not null and jsonb_typeof(old.cos) = 'object' then old.cos -> 'today' end;
        if o is not null and (o ->> 'd') = (t ->> 'd') then
          xp := least(xp, coalesce((o ->> 'xp')::numeric, 0)::int + step_max);
        end if;
      else
        xp := least(xp, step_max);   -- a new day starts from nothing
      end if;
      new.cos := jsonb_set(new.cos, array[f, 'xp'], to_jsonb(xp));
      new.cos := jsonb_set(new.cos, array[f, 'g'], to_jsonb(greatest(0, least(500, coalesce((t ->> 'g')::numeric, 0)::int))));
    end loop;
  end if;

  -- ── Coins: how much the wallet can grow in one save ──
  if new.app_profile is not null and jsonb_typeof(new.app_profile) = 'object'
     and (new.app_profile ? 'coins') then
    coins_new := greatest(0, coalesce((new.app_profile ->> 'coins')::numeric, 0)::bigint);
    coins_old := case when old.app_profile is not null and jsonb_typeof(old.app_profile) = 'object'
                      then coalesce((old.app_profile ->> 'coins')::numeric, 0)::bigint end;
    if coins_old is not null and coins_new > coins_old + coin_step then
      bought := 0;
      if to_regclass('public.coin_purchases') is not null then
        execute 'select coalesce(sum(coins), 0) from public.coin_purchases
                 where user_id = $1 and claimed_at > now() - interval ''1 hour'''
          into bought using new.id;
      end if;
      coins_new := least(coins_new, coins_old + coin_step + bought);
    end if;
    new.app_profile := jsonb_set(new.app_profile, '{coins}', to_jsonb(coins_new));
  end if;

  return new;
end;
$$;

drop trigger if exists guard_account_save on public.accounts;
create trigger guard_account_save
  before update on public.accounts
  for each row execute function public.guard_account_save();

-- Clean up anything already on the board that couldn't be real
update public.accounts
set cos = jsonb_set(cos, '{today,xp}', to_jsonb(least(10000, (cos -> 'today' ->> 'xp')::numeric::int)))
where jsonb_typeof(cos -> 'today') = 'object' and (cos -> 'today' ->> 'xp')::numeric > 10000;
update public.accounts
set cos = jsonb_set(cos, '{yday,xp}', to_jsonb(least(10000, (cos -> 'yday' ->> 'xp')::numeric::int)))
where jsonb_typeof(cos -> 'yday') = 'object' and (cos -> 'yday' ->> 'xp')::numeric > 10000;
