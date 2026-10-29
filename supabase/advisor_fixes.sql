-- ═════════════════════════════════════════════════════════════════════════════
-- Fixes for the two Supabase Security Advisor warnings
-- ═════════════════════════════════════════════════════════════════════════════
-- 1. simulations_removed (the backup leaderboard_cleanup.sql made) had no RLS, so the
--    public API could read and change it. Nothing in the game uses it: RLS on with no
--    policies leaves it to the dashboard and the server only.
-- 2. leaderboard_profiles is a SECURITY DEFINER view nothing in the game reads any more.
--    It now runs with the caller's rights, and the public API can't read it.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table if exists public.simulations_removed enable row level security;
revoke all on table public.simulations_removed from anon, authenticated;

alter view if exists public.leaderboard_profiles set (security_invoker = true);
revoke all on table public.leaderboard_profiles from anon, authenticated;
