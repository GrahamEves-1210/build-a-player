-- ════════════════════════════════════════════════════════════════════════════
-- Leaderboard cleanup: re-simmed builds and Sandbox 99s
-- ════════════════════════════════════════════════════════════════════════════
-- Run in the Supabase SQL editor, one STEP at a time, reading each preview first.
-- Nothing is lost for good: every removed row is copied to simulations_removed
-- (with the reason) before it's deleted, and STEP 5 puts rows back.
--
-- What happened (audit of the live data, Oct 2026):
--   * The same build saved again and again. A refresh restored a finished
--     build and SIMULATE saved a new season each time (basketball: Back to
--     Build → simulate). 4,121 of the 5,401 QB Classic 99s are an account
--     re-saving its own build; one account has 927 rows from 15 builds.
--   * Sandbox "Add to build" hand-picks saved as normal seasons after a
--     refresh (the sandbox flag only lived in memory).
--   * Honest play reaches 99 about once in 16,000 builds (simulated on the
--     real spin rules), so 99s should be rarer than 98s. Live: 12x more.
-- The game no longer saves any of these (src/lib/saveGuard.js).

set statement_timeout = '20min';

-- ── STEP 0 · What is leaderboard_user_stats? ────────────────────────────────
-- A VIEW updates by itself. A MATERIALIZED VIEW needs STEP 4's refresh. A
-- TABLE is filled by your own job or trigger: re-run that after the cleanup.
select table_name, table_type from information_schema.tables where table_name = 'leaderboard_user_stats'
union all
select matviewname, 'MATERIALIZED VIEW' from pg_matviews where matviewname = 'leaderboard_user_stats';

-- ── STEP 1 · Preview ────────────────────────────────────────────────────────
-- Repeats: a season whose account already saved the exact same build in that mode
with ranked as (
  select game_mode,
         row_number() over (partition by user_id, game_mode, md5(build::text) order by created_at, id) as rn
  from simulations
  where build is not null
)
select game_mode,
       count(*)                       as seasons,
       count(*) filter (where rn > 1) as repeats_to_remove
from ranked group by game_mode order by repeats_to_remove desc;

-- 99s from accounts with 3+ DIFFERENT 99 builds in one mode (after repeats go)
with per as (
  select user_id, game_mode, count(distinct md5(build::text)) as builds_99
  from simulations
  where ovr = 99 and build is not null
  group by user_id, game_mode
)
select game_mode, count(*) as accounts, sum(builds_99) as rows_99
from per where builds_99 >= 3 group by game_mode order by rows_99 desc;

-- ── STEP 2 · Remove repeats (backup first) ──────────────────────────────────
create table if not exists simulations_removed as
  select s.*, ''::text as removed_reason, now() as removed_at from simulations s where false;

with ranked as (
  select id, row_number() over (partition by user_id, game_mode, md5(build::text) order by created_at, id) as rn
  from simulations
  where build is not null
)
insert into simulations_removed
select s.*, 'repeat of the same build', now()
from simulations s join ranked r on r.id = s.id
where r.rn > 1;

delete from simulations s
using simulations_removed r
where r.id = s.id and r.removed_reason = 'repeat of the same build';

-- ── STEP 3 (optional) · Remove 99s from repeat 99-makers ────────────────────
-- An account with 3+ different 99 builds in one mode: honest odds are tiny.
-- Change the 3 to be stricter or looser; STEP 1's second preview shows the size.
with per as (
  select user_id, game_mode
  from simulations
  where ovr = 99 and build is not null
  group by user_id, game_mode
  having count(distinct md5(build::text)) >= 3
)
insert into simulations_removed
select s.*, 'one of 3+ different 99 builds', now()
from simulations s join per p on p.user_id = s.user_id and p.game_mode = s.game_mode
where s.ovr = 99;

delete from simulations s
using simulations_removed r
where r.id = s.id and r.removed_reason = 'one of 3+ different 99 builds';

-- ── STEP 4 · Lock it in ─────────────────────────────────────────────────────
-- One season per build per account per mode, enforced by the database too
-- (the game shows "This build already has a saved season" if it's ever hit).
-- RUN THIS STATEMENT ON ITS OWN: CONCURRENTLY can't run with other statements.
create unique index concurrently if not exists simulations_one_season_per_build
  on simulations (user_id, game_mode, md5(build::text))
  where build is not null;

-- If STEP 0 said MATERIALIZED VIEW:
-- refresh materialized view leaderboard_user_stats;

-- ── STEP 5 · Undo (only if needed) ──────────────────────────────────────────
-- Copies removed rows back with their original columns. Narrow the WHERE to
-- undo part of it (one reason, one user_id), then delete those backup rows.
-- do $$
-- declare cols text;
-- begin
--   select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
--   from information_schema.columns where table_schema = 'public' and table_name = 'simulations';
--   execute format('insert into simulations (%s) select %s from simulations_removed where removed_reason = %L', cols, cols, 'one of 3+ different 99 builds');
-- end $$;
