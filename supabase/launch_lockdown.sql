-- ════════════════════════════════════════════════════════════════════════════
-- Launch lockdown: boards only take results the live server has checked
-- ════════════════════════════════════════════════════════════════════════════
-- Run on launch day, AFTER the new site/app are live and the live server is
-- deployed with its SUPABASE_SERVICE_ROLE_KEY secret (GO-LIVE.md). From then on a
-- device can't write these tables itself: seasons, Daily scores and Salary Cap plays
-- arrive only through the live server (live/src/submit.js), which checks them
-- (real players at real ratings, the real OVR, the Daily's own spins, the day's board).
-- Reading the boards is unchanged. Safe to run again.
-- To undo (if the live server is down): grant insert on <table> to authenticated;

do $$
declare t text;
begin
  foreach t in array array['simulations', 'daily_challenge_results', 'qb_salary_cap_plays', 'salary_cap_plays',
                           'qb_salary_infinite_plays', 'salary_infinite_plays'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
