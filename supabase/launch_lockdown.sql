-- ════════════════════════════════════════════════════════════════════════════
-- Launch lockdown: boards only take results the live server has checked
-- ════════════════════════════════════════════════════════════════════════════
-- Run on launch day, AFTER the new site/app are live and the live server is
-- deployed with its SUPABASE_SERVICE_ROLE_KEY secret (GO-LIVE.md). From then on a
-- device can't write these tables itself: seasons and Daily scores arrive only through
-- the live server (live/src/submit.js), which checks them (real players at real
-- ratings, the real OVR, the Daily's own spins). Salary Cap plays aren't checked by
-- the server yet, so they stay as they are (result_guards.sql still limits them).
-- Reading the boards is unchanged. Safe to run again.
-- To undo (if the live server is down): grant insert on <table> to authenticated;

do $$
declare t text;
begin
  foreach t in array array['simulations', 'daily_challenge_results'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
