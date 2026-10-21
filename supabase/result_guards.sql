-- ════════════════════════════════════════════════════════════════════════════
-- Result guards: what a player's own device may write to the boards
-- ════════════════════════════════════════════════════════════════════════════
-- Every result row (seasons, Salary Cap plays, Daily scores, head-to-head games)
-- is written from the player's device with their own session. Without checks,
-- one line in a browser console could post a 99 OVR 17-0 title season under any
-- name, stack a day's Salary Cap board, add thousands of head-to-head wins, or
-- freeze tomorrow's Salary Cap board for everyone.
--
-- These triggers trim what can't be real instead of failing the save (a dropped
-- row looks saved to whoever sent it), so an honest player is never affected:
--   • the row is always the sender's: user_id is their own, username the one on
--     their account (not whatever the device sent)
--   • one row per table every 15 seconds per player, and a daily ceiling
--   • numbers inside what the game can produce (OVR 0-99, a season's games,
--     a title only with a playoff run)
--   • a daily Salary Cap play: today's board (or yesterday's, just after
--     midnight), once per player per day
--   • rows can't be edited by players at all, or deleted by anyone but their owner
--   • Salary Cap boards can only be frozen for today (or yesterday), never ahead
-- The live server (live/src/submit.js) saves checked results with the service key and
-- names the player in an x-bap-user header: those rows get the same per-player checks.
-- Anything else from the server (webhooks) and SQL run in the dashboard aren't limited.
-- Columns a table doesn't have are simply skipped, so this is safe on every table.
-- Run once in the Supabase SQL editor. Safe to run again.

create or replace function public.guard_result_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  hdr text := (nullif(current_setting('request.headers', true), '')::json) ->> 'x-bap-user';
  r jsonb;
  fix jsonb := '{}'::jsonb;
  today date := (now() at time zone 'America/New_York')::date;
  day_cap int := case tg_table_name when 'simulations' then 300 when 'vs_results' then 150 else 200 end;
  name text;
  n int;
  games int;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    -- the live server saving a checked result for a player: that player's checks apply
    if tg_op <> 'INSERT' or hdr is null or hdr !~ '^[0-9a-f-]{36}$' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
    me := hdr::uuid;
  end if;

  -- edits: never from a device; deletes: only your own rows
  if tg_op = 'UPDATE' then return null; end if;
  if tg_op = 'DELETE' then
    return case when me is not null and (to_jsonb(old) ->> 'user_id') = me::text then old else null end;
  end if;

  -- a result needs someone signed in
  if me is null then return null; end if;
  r := to_jsonb(new);

  -- it's yours: your id, your account's name
  if r ? 'user_id' then fix := fix || jsonb_build_object('user_id', me); end if;
  if r ? 'username' then
    select username into name from public.accounts where id = me;
    if name is not null then fix := fix || jsonb_build_object('username', name); end if;
  end if;
  new := jsonb_populate_record(new, fix);

  -- how often: one row per table every 15 seconds, and a ceiling a day
  if r ? 'created_at' then
    execute format('select count(*) filter (where created_at > now() - interval ''15 seconds''),
                           count(*) filter (where created_at > now() - interval ''1 day'')
                    from public.%I where user_id = $1', tg_table_name)
      into n, games using me;
    if n > 0 or games >= day_cap then return null; end if;
  end if;

  -- OVR / score: what a build can reach
  if (r ? 'ovr') and r ->> 'ovr' is not null and ((r ->> 'ovr')::numeric < 0 or (r ->> 'ovr')::numeric > 99) then return null; end if;
  if (r ? 'overall_score') and r ->> 'overall_score' is not null and ((r ->> 'overall_score')::numeric < 0 or (r ->> 'overall_score')::numeric > 99) then return null; end if;

  -- a season: no more games than a season has; a title only with a playoff run
  if tg_table_name = 'simulations' then
    games := case when coalesce(r ->> 'game_mode', '') like 'bucket%' then 82 else 17 end;
    if coalesce((r ->> 'wins')::numeric, 0) < 0 or coalesce((r ->> 'losses')::numeric, 0) < 0
       or coalesce((r ->> 'wins')::numeric, 0) + coalesce((r ->> 'losses')::numeric, 0) > games then return null; end if;
    if coalesce((r ->> 'champion')::boolean, false) and not coalesce((r ->> 'playoffs')::boolean, (r ->> 'playoffs') is not null) then return null; end if;
  end if;

  -- a daily Salary Cap play: today's (or yesterday's) board, once a day
  if tg_table_name in ('qb_salary_cap_plays', 'salary_cap_plays') then
    if (r ->> 'date_str') is null or (r ->> 'date_str') !~ '^\d{4}-\d{2}-\d{2}$'
       or (r ->> 'date_str')::date not in (today, today - 1) then return null; end if;
    execute format('select count(*) from public.%I where user_id = $1 and date_str = $2', tg_table_name)
      into n using me, r ->> 'date_str';
    if n > 0 then return null; end if;
  end if;

  return new;
end;
$$;

-- Salary Cap boards: frozen for today (or yesterday) only, and never changed after
create or replace function public.guard_salary_grid() returns trigger
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'America/New_York')::date;
begin
  if coalesce(auth.role(), '') = 'service_role' then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op <> 'INSERT' then return null; end if;
  if new.date_str is null or new.date_str !~ '^\d{4}-\d{2}-\d{2}$' or new.date_str::date not in (today, today - 1) then return null; end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['simulations', 'vs_results', 'salary_cap_plays', 'salary_infinite_plays',
                           'qb_salary_cap_plays', 'qb_salary_infinite_plays', 'daily_challenge_results'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists guard_result_row on public.%I', t);
      execute format('create trigger guard_result_row before insert or update or delete on public.%I
                      for each row execute function public.guard_result_row()', t);
    end if;
  end loop;
  foreach t in array array['salary_cap_grids', 'qb_salary_cap_grids'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists guard_salary_grid on public.%I', t);
      execute format('create trigger guard_salary_grid before insert or update or delete on public.%I
                      for each row execute function public.guard_salary_grid()', t);
    end if;
  end loop;
end $$;
