-- ════════════════════════════════════════════════════════════════════════════
-- Soccer: what the live database has to allow for soccer's rows
--   seasons   simulations rows with game_mode 'soccer-classic' (TOP DIVISIONS) or
--             'soccer-all-time' (WORLD CUP), position 'st', in the columns every season already
--             has (src/lib/soccerAwards.js says which holds what; SoccerApp.jsx soccerSeasonRow;
--             the live worker sets game_mode and position itself: live/src/submit.js)
--   Salary Cap  its own tables: supabase/soccer_salary.sql
--   Compete   nothing here: the pools, the scoring and the rating live in the worker
--             (live/src/compete.js); the rating is bump_rating, which takes any sport
-- ════════════════════════════════════════════════════════════════════════════
-- Soccer is wired behind SOCCER_LIVE (src/lib/soccerLive.js). Nothing here shows it to anyone:
-- this only lets its rows in once the flag is flipped. Run it before the flip.
--
-- The table that matters, simulations, isn't created by any file in this repo, and the repo's
-- SQL isn't proof of what's live, so each step looks at the live database first and only
-- changes something it finds:
--   1. a check on simulations that lists the game modes: soccer's two go in beside 'db-classic'
--   2. a check on simulations that lists the positions: 'st' goes in beside 'qb'
--   3. result_guards.sql's row guard (guard_result_row): a season there is at most 17 games
--      unless its mode is bucket%. A soccer season's wins + losses are its league record, up
--      to 38 (a Premier League, La Liga or Serie A season; a World Cup row holds the group's
--      three), so soccer% gets 38.
--      Without this every soccer season with more than 17 decided games is dropped
--      silently. If result_guards.sql never ran there's no guard and nothing to change.
--   4. the Daily's position check (weekly_cup.sql): 'st' beside 'big'. Soccer isn't in the
--      Daily's rotation yet (verifyCore.js dailyFor), so this only saves a step later.
-- On a database with none of these it changes nothing and just prints the report at the bottom.
--
-- Run once in the Supabase SQL editor. Safe to run again.

-- ── 1. simulations: a check that lists the modes gets soccer's two ──────────────
do $$
declare
  c record;
  m text;
  def text;
begin
  foreach m in array array['soccer-classic', 'soccer-all-time'] loop
    for c in
      select conname, pg_get_constraintdef(oid) as d
      from pg_constraint
      where conrelid = 'public.simulations'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%game_mode%'
        and pg_get_constraintdef(oid) not ilike '%''' || m || '''%'
    loop
      if c.d !~ '''db-classic''' then
        raise warning 'simulations.% checks game_mode in a way this file can''t widen: %', c.conname, c.d;
        continue;
      end if;
      -- a list of modes: soccer's goes in beside DB's, with the same cast
      def := regexp_replace(c.d, '''db-classic''(::[a-z ]+)?', '''db-classic''\1, ''' || m || '''\1');
      execute format('alter table public.simulations drop constraint %I', c.conname);
      -- (a wider list can't fail an old row, so no scan of the whole table under a lock)
      if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
      execute format('alter table public.simulations add constraint %I %s', c.conname, def);
      raise notice 'simulations.%: % added', c.conname, m;
    end loop;
  end loop;
end $$;

-- ── 2. simulations: a check that lists the positions gets 'st' ──────────────────
do $$
declare
  c record;
  def text;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'simulations' and column_name = 'position') then
    raise warning 'simulations has no position column: the soccer row sends one (position = ''st'')';
    return;
  end if;
  for c in
    select conname, pg_get_constraintdef(oid) as d
    from pg_constraint
    where conrelid = 'public.simulations'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%position%'
      and pg_get_constraintdef(oid) not ilike '%''st''%'
  loop
    if c.d !~ '''qb''' then
      raise warning 'simulations.% checks position in a way this file can''t widen: %', c.conname, c.d;
      continue;
    end if;
    def := regexp_replace(c.d, '''qb''(::[a-z ]+)?', '''qb''\1, ''st''\1');
    execute format('alter table public.simulations drop constraint %I', c.conname);
    if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
    execute format('alter table public.simulations add constraint %I %s', c.conname, def);
    raise notice 'simulations.%: st added', c.conname;
  end loop;
end $$;

-- ── 3. result_guards: a soccer season is up to 38 games, not football's 17 ────────
-- The live function's own text gets one branch more; everything else in it stays as it is.
do $$
declare
  fn regprocedure := to_regprocedure('public.guard_result_row()');
  def text;
  old_case text := 'like ''bucket%'' then 82 else 17 end';
  new_case text := 'like ''bucket%'' then 82 when coalesce(r ->> ''game_mode'', '''') like ''soccer%'' then 38 else 17 end';
begin
  if fn is null then
    raise notice 'no guard_result_row (result_guards.sql hasn''t run): nothing to change';
    return;
  end if;
  def := pg_get_functiondef(fn);
  if strpos(def, 'soccer%') > 0 then
    raise notice 'guard_result_row already knows soccer';
    return;
  end if;
  if strpos(def, old_case) = 0 then
    raise warning 'guard_result_row counts a season''s games in a way this file can''t widen: look for "games :=" in it';
    return;
  end if;
  execute replace(def, old_case, new_case);
  raise notice 'guard_result_row: soccer seasons up to 38 games';
end $$;

-- ── 4. The Daily's position check: 'st' beside 'big' (for later; see the top) ─────
do $$
declare
  c record;
  def text;
begin
  if to_regclass('public.daily_challenge_results') is null then return; end if;
  for c in
    select conname, pg_get_constraintdef(oid) as d
    from pg_constraint
    where conrelid = 'public.daily_challenge_results'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%position%'
      and pg_get_constraintdef(oid) not ilike '%''st''%'
  loop
    if c.d !~ '''big''' then
      raise warning 'daily_challenge_results.% checks position in a way this file can''t widen: %', c.conname, c.d;
      continue;
    end if;
    def := regexp_replace(c.d, '''big''(::[a-z ]+)?', '''big''\1, ''st''\1');
    execute format('alter table public.daily_challenge_results drop constraint %I', c.conname);
    if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
    execute format('alter table public.daily_challenge_results add constraint %I %s', c.conname, def);
    raise notice 'daily_challenge_results.%: st added', c.conname;
  end loop;
end $$;

-- ── 5. Report: nothing below changes anything. Every line should say OK (the last lists triggers) ──
-- Line 5 lists the columns the soccer season row sends (SoccerApp.jsx soccerSeasonRow) that the
-- live simulations table doesn't have: a row with a column the table lacks is refused whole, so
-- each one listed there needs adding (or the row needs to stop sending it) before the boards go on.
-- The hourly job that fills leaderboard_user_stats isn't in the repo either; line 4 flags it if its
-- code names modes and leaves soccer's out.
select 'simulations game_mode check' as what,
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%game_mode%'
                           and (pg_get_constraintdef(oid) not ilike '%soccer-classic%'
                                or pg_get_constraintdef(oid) not ilike '%soccer-all-time%'))
            then 'NEEDS A LOOK: see the warning above' else 'OK' end as status
union all
select 'simulations position check',
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%position%'
                           and pg_get_constraintdef(oid) not ilike '%''st''%')
            then 'NEEDS A LOOK: see the warning above' else 'OK' end
union all
select 'result guard: soccer seasons',
       case when to_regprocedure('public.guard_result_row()') is null then 'OK (no guard installed)'
            when strpos(pg_get_functiondef(to_regprocedure('public.guard_result_row()')), 'soccer%') > 0 then 'OK'
            else 'NEEDS A LOOK: see the warning above' end
union all
select 'functions naming db-classic but not soccer',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(p.proname, ', ') from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prokind = 'f'
                   and p.prosrc ilike '%db-classic%' and p.prosrc not ilike '%soccer%'), 'OK')
union all
select 'simulations columns the soccer row sends',
       coalesce((select 'MISSING: ' || string_agg(col, ', ')
                 from unnest(array['user_id', 'username', 'ovr', 'archetype', 'game_mode', 'position', 'wins', 'losses',
                                   'season_comp_pct', 'champion', 'playoffs', 'season_tds', 'season_ints', 'ppg', 'season_rating',
                                   'season_pass_yds', 'finals_opp', 'finals_series', 'season_award', 'team_short', 'build']) as col
                 where not exists (select 1 from information_schema.columns
                                   where table_schema = 'public' and table_name = 'simulations' and column_name = col)), 'OK')
union all
-- the Ranks tab's soccer records (src/lib/boards.js): an award is a tag in season_award, and a season can
-- hold two ('boot,bdor'); a check that lists season_award's values would refuse those rows
select 'season_award free text (soccer award tags)',
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%season_award%')
            then 'NEEDS A LOOK: a check on season_award: it must take ''boot,bdor'' and the like' else 'OK' end
union all
-- Goals, Assists a Season and Average Match Rating read leaderboard_user_stats' total_tds, total_ints and
-- total_ppg: the hourly job has to sum season_tds, season_ints and ppg for every mode, not only football's
-- or basketball's. A view shows its query here; a table filled by a cron job can't be read from SQL
select 'leaderboard_user_stats totals (soccer records)',
       case when to_regclass('public.leaderboard_user_stats') is null then 'NEEDS A LOOK: no leaderboard_user_stats'
            when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leaderboard_user_stats' and column_name = 'total_ints')
              then 'NEEDS A LOOK: no total_ints column (Assists a Season)'
            when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leaderboard_user_stats' and column_name = 'total_ppg')
              then 'NEEDS A LOOK: no total_ppg column (Average Match Rating)'
            when exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'leaderboard_user_stats')
              then case when (select definition from pg_matviews where schemaname = 'public' and matviewname = 'leaderboard_user_stats') ~* 'bucket'
                        then 'NEEDS A LOOK: the view names modes: check it sums ppg / season_ints for soccer-classic' else 'OK (a view over every mode)' end
            else 'OK (a table: its job is outside SQL; check a soccer row shows up an hour after the first season)' end
union all
select 'simulations policies naming modes',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(policyname, ', ') from pg_policies
                 where schemaname = 'public' and tablename = 'simulations'
                   and coalesce(qual, '') || coalesce(with_check, '') ilike '%db-%'
                   and coalesce(qual, '') || coalesce(with_check, '') not ilike '%soccer%'), 'OK')
union all
select 'triggers on simulations',
       coalesce((select string_agg(tgname, ', ') from pg_trigger
                 where tgrelid = 'public.simulations'::regclass and not tgisinternal), 'none');
