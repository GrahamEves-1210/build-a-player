-- ════════════════════════════════════════════════════════════════════════════
-- Best / worst builds: an index so the lists load
-- ════════════════════════════════════════════════════════════════════════════
-- The "best builds" lists don't come from the cached leaderboard_user_stats:
-- each one asks the whole simulations table for the top 200 seasons of a mode
-- by OVR then wins (and the worst 20 the other way). With no index for that
-- order Postgres sorts every row of the mode, and it times out (57014).
-- These indexes hold the rows already in that order, so it's a short read.
-- Run each statement ON ITS OWN in the Supabase SQL editor (CONCURRENTLY can't
-- run inside a batch); it builds without locking the table.

-- Football: classic, rb-classic, wr-classic, te-classic, db-classic, ol-classic, all-time…
create index concurrently if not exists simulations_mode_ovr_wins
  on simulations (game_mode, ovr desc, wins desc)
  where build is not null;

-- Basketball's best builds also filter by position
create index concurrently if not exists simulations_mode_pos_ovr
  on simulations (game_mode, position, ovr desc)
  where build is not null;
