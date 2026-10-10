-- ════════════════════════════════════════════════════════════════════════════
-- Public cosmetics: what everyone sees of a player
-- ════════════════════════════════════════════════════════════════════════════
-- Each player's game writes the look they have equipped here (avatar, name
-- color, name effect, nameplate, victory effect + sound) whenever they sign in
-- or change it (src/lib/progress.js pushCos). Leaderboards, the Daily board and
-- 1v1 results read it by account id (src/lib/peopleCos.js), so a player's look
-- shows wherever their name or picture does.
--
-- It's a separate column on purpose: app_profile also holds coins and stats,
-- and only this public part should be read by other players.
--
-- Run once in the Supabase SQL editor. Until it's run, the game simply shows
-- other players without their look (and live rooms still share it directly).

alter table accounts add column if not exists cos jsonb;

-- Writing: the existing "update own row" policy on accounts already covers it.
-- Reading: leaderboards already read accounts rows by id. If your accounts
-- SELECT policy is restricted, this lets everyone read the rows' public parts:
-- create policy "accounts readable" on accounts for select using (true);
