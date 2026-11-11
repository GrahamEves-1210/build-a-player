-- ════════════════════════════════════════════════════════════════════════════
-- College Football All-Time: which pool a saved season's build was spun from. NOT RUN. Check with the owner first.
-- ════════════════════════════════════════════════════════════════════════════
-- The mode has two pools (src/components/cfb/cfbShared.js CFB_POOLS): 'current', this season's rosters, and
-- 'alltime', each school's legends (src/data/cfb-legends.js). Everything after the build is the same season, so the
-- only thing that tells the two apart on a saved row is this column. A board or a list over cfb_seasons must filter
-- on it: an All-Time build is made of Heisman winners and would sit on top of every current-pool board.
--
-- Nothing is written to this table today: college seasons are kept on the device only (localStorage
-- 'bap_cfb_seasons', where every row already carries pool: 'current' | 'alltime'), and the cloud hook
-- (cfbShared.js saveSeasonCloud) is off behind CFB_CLOUD = false.
--
-- Run AFTER supabase/cfb_mode.sql (it adds to that file's table). The hook sends pool only for an All-Time season,
-- so current-pool saves work with or without this file; an All-Time save needs it (without the column that insert
-- is refused, which is the safe way round: it is never stored as a current season).
-- The server check that file asks for (a cfb kit in verifyCore.js) will need the legends too: an All-Time build is
-- checked against src/data/cfb-legends.js, a current one against src/data/cfb-players.js.
--
-- Safe to run again.

alter table if exists public.cfb_seasons
  add column if not exists pool text not null default 'current' check (pool in ('current', 'alltime'));

-- the board index, per pool
create index if not exists cfb_seasons_pool_board_idx on public.cfb_seasons (pool, position, ovr desc, wins desc);
