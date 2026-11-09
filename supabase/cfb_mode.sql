-- ════════════════════════════════════════════════════════════════════════════
-- College Football mode: its own table for saved seasons. NOT RUN. Check with the owner first.
-- ════════════════════════════════════════════════════════════════════════════
-- Why a table of its own, and not `simulations` with a cfb- game_mode:
--   • football's profile and achievement reads take `simulations` by leaving modes OUT, not by
--     listing them: ProfilePage.jsx's QB career stats (.not('game_mode','in',...) and
--     .not ilike 'rb-%'), lib/progress.js's 10-win and award counts (game_mode not like bucket/soccer).
--     A cfb- row there would be counted as an NFL season.
--   • the live server checks every season it saves against its own NFL rosters
--     (live/src/submit.js → src/lib/verifyCore.js checkSeason), so it can't take a college build yet.
-- Until this runs, a college season is kept on the device only (src/components/cfb/cfbShared.js,
-- localStorage 'bap_cfb_seasons'). The hook is saveSeasonCloud() there, off behind CFB_CLOUD = false.
--
-- To turn the saves on: run this, add a college check to the live server (a cfb kit in verifyCore.js
-- over src/data/cfb-players.js) and send college seasons through it, then set CFB_CLOUD = true.
-- (While rows are written straight from the client, as the hook does, the scores aren't checked:
-- keep any board over this table hidden until the server check is in.)
--
-- Safe to run again.

create table if not exists public.cfb_seasons (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  position      text not null check (position in ('qb', 'wr', 'rb')),
  ovr           smallint not null check (ovr between 0 and 99),
  wins          smallint not null check (wins between 0 and 17),
  losses        smallint not null check (losses between 0 and 17),
  team          text not null,                 -- the school (CFB_TEAMS short)
  conf          text,                          -- its conference id
  final_rank    smallint check (final_rank between 1 and 25),
  conf_champ    boolean not null default false,
  cfp_seed      smallint check (cfp_seed between 1 and 12),
  national_champ boolean not null default false,
  heisman       boolean not null default false,
  all_american  text check (all_american in ('first', 'second')),
  draft         text,                          -- 'Projected top-10 pick' …
  build         jsonb not null                 -- { trait: { qb, team, val } }
);
create index if not exists cfb_seasons_user_idx on public.cfb_seasons (user_id, created_at desc);
create index if not exists cfb_seasons_board_idx on public.cfb_seasons (position, ovr desc, wins desc);

alter table public.cfb_seasons enable row level security;
drop policy if exists cfb_seasons_read on public.cfb_seasons;
create policy cfb_seasons_read on public.cfb_seasons for select using (true);
drop policy if exists cfb_seasons_insert_own on public.cfb_seasons;
create policy cfb_seasons_insert_own on public.cfb_seasons for insert with check (auth.uid() = user_id);
-- no update or delete from the client
