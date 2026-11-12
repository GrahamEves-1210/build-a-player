-- ════════════════════════════════════════════════════════════════════════════
-- College Basketball mode: its own table for saved seasons. NOT RUN. Check with the owner first.
-- ════════════════════════════════════════════════════════════════════════════
-- The basketball counterpart of supabase/cfb_mode.sql + cfb_alltime.sql, in one file (the pool column is here
-- from the start: an All-Time build is made of national players of the year and must never sit on a
-- current-pool board).
-- Why a table of its own, and not `simulations` with a cbb- game_mode:
--   • basketball's profile and achievement reads take `simulations` by leaving modes OUT, not by listing them
--     (lib/progress.js's counts, the profile's career stats). A cbb- row there would be counted as an NBA season.
--   • the live server checks every season it saves against its own NBA rosters (live/src/submit.js →
--     src/lib/verifyCore.js checkSeason), so it can't take a college build yet.
-- Until this runs, a college season is kept on the device only (src/components/cbb/cbbShared.js, localStorage
-- 'bap_cbb_seasons'). The hook is saveSeasonCloud() there, off behind CBB_CLOUD = false.
--
-- To turn the saves on: run this, add a college check to the live server (a cbb kit in verifyCore.js over
-- src/data/cbb-players.js, and src/data/cbb-legends.js for an All-Time build) and send college seasons through
-- it, then set CBB_CLOUD = true. (While rows are written straight from the client, as the hook does, the scores
-- aren't checked: keep any board over this table hidden until the server check is in.)
--
-- Safe to run again.

create table if not exists public.cbb_seasons (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  position       text not null check (position in ('guard', 'big')),
  pool           text not null default 'current' check (pool in ('current', 'alltime')),
  ovr            smallint not null check (ovr between 0 and 99),
  wins           smallint not null check (wins between 0 and 45),
  losses         smallint not null check (losses between 0 and 45),
  team           text not null,                 -- the school (CBB_TEAMS short)
  conf           text,                          -- its conference id
  final_rank     smallint check (final_rank between 1 and 25),
  conf_champ     boolean not null default false, -- won the conference tournament
  ncaa_seed      smallint check (ncaa_seed between 1 and 16),
  finish         text,                          -- 'National champions', 'Final Four', 'Sweet 16', 'NIT', 'No postseason' …
  national_champ boolean not null default false,
  wooden         boolean not null default false,
  all_american   text check (all_american in ('first', 'second', 'third')),
  ppg            numeric(4,1),
  rpg            numeric(4,1),
  apg            numeric(4,1),
  draft          text,                          -- 'Projected lottery pick' …
  build          jsonb not null                 -- { trait: { p, team, val } }
);
create index if not exists cbb_seasons_user_idx on public.cbb_seasons (user_id, created_at desc);
create index if not exists cbb_seasons_board_idx on public.cbb_seasons (pool, position, ovr desc, wins desc);

alter table public.cbb_seasons enable row level security;
drop policy if exists cbb_seasons_read on public.cbb_seasons;
create policy cbb_seasons_read on public.cbb_seasons for select using (true);
drop policy if exists cbb_seasons_insert_own on public.cbb_seasons;
create policy cbb_seasons_insert_own on public.cbb_seasons for insert with check (auth.uid() = user_id);
-- no update or delete from the client
