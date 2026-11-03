-- ════════════════════════════════════════════════════════════════════════════
-- Daily Challenge: basketball days + the Weekly Cup
-- ════════════════════════════════════════════════════════════════════════════
-- 1. The Daily alternates football and basketball days (src/lib/verifyCore.js dailyFor):
--    the board takes the basketball positions too.
-- 2. The Weekly Cup (src/lib/progress.js): every Daily a player posts in a week (Monday
--    to Sunday, New York) adds its OVR. weekly_cup(monday) is that week's top 50.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table public.daily_challenge_results drop constraint if exists daily_challenge_results_position_check;
alter table public.daily_challenge_results add constraint daily_challenge_results_position_check
  check (position in ('qb', 'rb', 'wr', 'te', 'db', 'guard', 'big'));

create or replace function public.weekly_cup(p_start date)
returns table (user_id uuid, username text, total int, days int, best int)
language sql stable security definer set search_path = public as $$
  select r.user_id, max(r.username), sum(r.ovr)::int, count(*)::int, max(r.ovr)::int
    from public.daily_challenge_results r
   where r.day between p_start and p_start + 6
   group by r.user_id
   order by sum(r.ovr) desc, count(*) asc, min(r.created_at) asc
   limit 50;
$$;
revoke all on function public.weekly_cup(date) from public;
grant execute on function public.weekly_cup(date) to anon, authenticated;
