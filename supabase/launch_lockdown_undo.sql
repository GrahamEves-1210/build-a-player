-- ════════════════════════════════════════════════════════════════════════════
-- Undo the launch lockdown: devices can save their own results again
-- ════════════════════════════════════════════════════════════════════════════
-- launch_lockdown.sql takes away the devices' insert on the boards, so only the live
-- server (with its SUPABASE_SERVICE_ROLE_KEY secret) can post results. Run this when
-- that can't happen yet: before launch (the old site on build-a-player.com saves its
-- seasons, Salary Cap plays and Daily scores itself), or if the live server is down.
-- Run launch_lockdown.sql again on launch day. Safe to run again.

do $$
declare t text;
begin
  foreach t in array array['simulations', 'daily_challenge_results', 'qb_salary_cap_plays', 'qb_salary_infinite_plays', 'salary_cap_plays', 'salary_infinite_plays'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant insert on public.%I to authenticated', t);
    end if;
  end loop;
end $$;
