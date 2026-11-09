-- ════════════════════════════════════════════════════════════════════════════
-- Baseball: what the live database has to allow for baseball's rows. NOT RUN YET.
--   seasons   simulations rows with game_mode 'baseball-classic' (CURRENT) or 'baseball-all-time'
--             (ALL-TIME), position 'bat' (BATTER) or 'pit' (PITCHER), in the columns every season
--             already has (src/lib/baseballAwards.js says which holds what; BaseballApp.jsx
--             baseballSeasonRow; the live worker sets game_mode and position itself: live/src/submit.js)
--   Ranks     reads those rows (src/lib/boards.js: the season records by position and pool)
--   Salary Cap  its own tables (the Salary Cap's own file)
--   Compete   nothing here: the pools, the scoring and the rating live in the worker
-- ════════════════════════════════════════════════════════════════════════════
-- Baseball is wired behind BASEBALL_LIVE (src/lib/baseballLive.js). Nothing here shows it to anyone:
-- this only lets its rows in once the flag is flipped. Run it before the flip (and before the worker
-- that saves baseball seasons goes out).
--
-- The table that matters, simulations, isn't created by any file in this repo, and the repo's SQL
-- isn't proof of what's live, so each step looks at the live database first and only changes
-- something it finds:
--   1. a check on simulations that lists the game modes: baseball's two go in beside 'db-classic'
--   2. a check on simulations that lists the positions: 'bat' and 'pit' go in beside 'qb'
--   3. result_guards.sql's row guard (guard_result_row): a season there is at most 17 games
--      unless its mode is bucket% (82) or soccer% (38, once soccer_mode.sql ran). A baseball
--      season's wins + losses are the club's record: 162 games, so baseball% gets 162.
--      Without this every baseball season is dropped silently. If result_guards.sql never ran
--      there's no guard and nothing to change. Works whether soccer_mode.sql ran first or not.
--   4. the Daily's position check (weekly_cup.sql): 'bat' and 'pit' beside 'big', as soccer's
--      file does for 'st'. Baseball isn't in the Daily's rotation yet, so this only saves a step later.
-- On a database with none of these it changes nothing and just prints the report at the bottom.
--
-- Run once in the Supabase SQL editor. Safe to run again.

-- ── 1. simulations: a check that lists the modes gets baseball's two ────────────
do $$
declare
  c record;
  m text;
  def text;
begin
  foreach m in array array['baseball-classic', 'baseball-all-time'] loop
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
      -- a list of modes: baseball's goes in beside DB's, with the same cast
      def := regexp_replace(c.d, '''db-classic''(::[a-z ]+)?', '''db-classic''\1, ''' || m || '''\1');
      execute format('alter table public.simulations drop constraint %I', c.conname);
      -- (a wider list can't fail an old row, so no scan of the whole table under a lock)
      if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
      execute format('alter table public.simulations add constraint %I %s', c.conname, def);
      raise notice 'simulations.%: % added', c.conname, m;
    end loop;
  end loop;
end $$;

-- ── 2. simulations: a check that lists the positions gets 'bat' and 'pit' ───────
do $$
declare
  c record;
  p text;
  def text;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'simulations' and column_name = 'position') then
    raise warning 'simulations has no position column: the baseball row sends one (position = ''bat'' or ''pit'')';
    return;
  end if;
  foreach p in array array['bat', 'pit'] loop
    for c in
      select conname, pg_get_constraintdef(oid) as d
      from pg_constraint
      where conrelid = 'public.simulations'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%position%'
        and pg_get_constraintdef(oid) not ilike '%''' || p || '''%'
    loop
      if c.d !~ '''qb''' then
        raise warning 'simulations.% checks position in a way this file can''t widen: %', c.conname, c.d;
        continue;
      end if;
      def := regexp_replace(c.d, '''qb''(::[a-z ]+)?', '''qb''\1, ''' || p || '''\1');
      execute format('alter table public.simulations drop constraint %I', c.conname);
      if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
      execute format('alter table public.simulations add constraint %I %s', c.conname, def);
      raise notice 'simulations.%: % added', c.conname, p;
    end loop;
  end loop;
end $$;

-- ── 3. result_guards: a baseball season is up to 162 games, not football's 17 ─────
-- The live function's own text gets one branch more, just before its "else 17 end" (after
-- basketball's 82 and soccer's 38 if those are there); everything else in it stays as it is.
do $$
declare
  fn regprocedure := to_regprocedure('public.guard_result_row()');
  def text;
  i int;
  k int;
  p int;
begin
  if fn is null then
    raise notice 'no guard_result_row (result_guards.sql hasn''t run): nothing to change';
    return;
  end if;
  def := pg_get_functiondef(fn);
  if strpos(def, 'baseball%') > 0 then
    raise notice 'guard_result_row already knows baseball';
    return;
  end if;
  i := strpos(def, 'games := case');
  k := case when i > 0 then strpos(substr(def, i), ' else 17 end') else 0 end;
  if i = 0 or k = 0 then
    raise warning 'guard_result_row counts a season''s games in a way this file can''t widen: look for "games :=" in it';
    return;
  end if;
  p := i + k - 1;   -- where " else 17 end" starts
  execute left(def, p - 1) || ' when coalesce(r ->> ''game_mode'', '''') like ''baseball%'' then 162' || substr(def, p);
  raise notice 'guard_result_row: baseball seasons up to 162 games';
end $$;

-- ── 4. The Daily's position check: 'bat' and 'pit' beside 'big' (for later; see the top) ──
do $$
declare
  c record;
  p text;
  def text;
begin
  if to_regclass('public.daily_challenge_results') is null then return; end if;
  foreach p in array array['bat', 'pit'] loop
    for c in
      select conname, pg_get_constraintdef(oid) as d
      from pg_constraint
      where conrelid = 'public.daily_challenge_results'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%position%'
        and pg_get_constraintdef(oid) not ilike '%''' || p || '''%'
    loop
      if c.d !~ '''big''' then
        raise warning 'daily_challenge_results.% checks position in a way this file can''t widen: %', c.conname, c.d;
        continue;
      end if;
      def := regexp_replace(c.d, '''big''(::[a-z ]+)?', '''big''\1, ''' || p || '''\1');
      execute format('alter table public.daily_challenge_results drop constraint %I', c.conname);
      if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
      execute format('alter table public.daily_challenge_results add constraint %I %s', c.conname, def);
      raise notice 'daily_challenge_results.%: % added', c.conname, p;
    end loop;
  end loop;
end $$;

-- ── 5. Report: nothing below changes anything. Every line should say OK (the last lists triggers) ──
-- "simulations columns" lists the columns the baseball season row sends (BaseballApp.jsx baseballSeasonRow)
-- that the live simulations table doesn't have: a row with a column the table lacks is refused whole, so
-- each one listed there needs adding (or the row needs to stop sending it) before the boards go on.
select 'simulations game_mode check' as what,
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%game_mode%'
                           and (pg_get_constraintdef(oid) not ilike '%baseball-classic%'
                                or pg_get_constraintdef(oid) not ilike '%baseball-all-time%'))
            then 'NEEDS A LOOK: see the warning above' else 'OK' end as status
union all
select 'simulations position check',
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%position%'
                           and (pg_get_constraintdef(oid) not ilike '%''bat''%' or pg_get_constraintdef(oid) not ilike '%''pit''%'))
            then 'NEEDS A LOOK: see the warning above' else 'OK' end
union all
select 'result guard: baseball seasons (162 games)',
       case when to_regprocedure('public.guard_result_row()') is null then 'OK (no guard installed)'
            when strpos(pg_get_functiondef(to_regprocedure('public.guard_result_row()')), 'baseball%') > 0 then 'OK'
            else 'NEEDS A LOOK: see the warning above' end
union all
select 'functions naming db-classic but not baseball',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(p.proname, ', ') from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prokind = 'f'
                   and p.prosrc ilike '%db-classic%' and p.prosrc not ilike '%baseball%'), 'OK')
union all
select 'simulations columns the baseball row sends',
       coalesce((select 'MISSING: ' || string_agg(col, ', ')
                 from unnest(array['user_id', 'username', 'ovr', 'archetype', 'game_mode', 'position', 'wins', 'losses',
                                   'champion', 'playoffs', 'season_tds', 'season_ints', 'ppg', 'season_rating',
                                   'season_pass_yds', 'finals_opp', 'finals_series', 'season_award', 'team_short', 'build']) as col
                 where not exists (select 1 from information_schema.columns
                                   where table_schema = 'public' and table_name = 'simulations' and column_name = col)), 'OK')
union all
-- OPS and ERA go in ppg with three decimals (.912, 2.874): a whole-number column would round them away
select 'ppg keeps decimals (OPS, ERA)',
       coalesce((select case when data_type in ('numeric', 'real', 'double precision') then 'OK'
                             else 'NEEDS A LOOK: ppg is ' || data_type || ': OPS and ERA need decimals' end
                 from information_schema.columns
                 where table_schema = 'public' and table_name = 'simulations' and column_name = 'ppg'), 'NEEDS A LOOK: no ppg column')
union all
select 'season_rating keeps decimals (WAR)',
       coalesce((select case when data_type in ('numeric', 'real', 'double precision') then 'OK'
                             else 'NEEDS A LOOK: season_rating is ' || data_type || ': WAR needs decimals' end
                 from information_schema.columns
                 where table_schema = 'public' and table_name = 'simulations' and column_name = 'season_rating'), 'NEEDS A LOOK: no season_rating column')
union all
-- the Ranks tab's baseball records (src/lib/boards.js): an award is a tag in season_award, and a season can
-- hold several ('bmvp,ss,asg'); a check that lists season_award's values would refuse those rows
select 'season_award free text (baseball award tags)',
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%season_award%')
            then 'NEEDS A LOOK: a check on season_award: it must take ''bmvp,ss,asg'' and the like' else 'OK' end
union all
-- Most Team Wins and Best Win % read leaderboard_user_stats (one row per mode and player, refreshed hourly):
-- its job has to take every mode, not only football's or basketball's
select 'leaderboard_user_stats (baseball team wins)',
       case when to_regclass('public.leaderboard_user_stats') is null then 'NEEDS A LOOK: no leaderboard_user_stats'
            when exists (select 1 from pg_matviews where schemaname = 'public' and matviewname = 'leaderboard_user_stats')
              then case when (select definition from pg_matviews where schemaname = 'public' and matviewname = 'leaderboard_user_stats') ~* 'bucket'
                        then 'NEEDS A LOOK: the view names modes: check it takes baseball-classic and baseball-all-time' else 'OK (a view over every mode)' end
            else 'OK (a table: its job is outside SQL; check a baseball row shows up an hour after the first season)' end
union all
select 'simulations policies naming modes',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(policyname, ', ') from pg_policies
                 where schemaname = 'public' and tablename = 'simulations'
                   and coalesce(qual, '') || coalesce(with_check, '') ilike '%db-%'
                   and coalesce(qual, '') || coalesce(with_check, '') not ilike '%baseball%'), 'OK')
union all
select 'best builds index (game_mode, position, ovr)',
       case when exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'simulations' and indexname = 'simulations_mode_pos_ovr')
            then 'OK' else 'NEEDS A LOOK: run best_builds_index.sql''s second index: the baseball boards filter by position' end
union all
select 'triggers on simulations',
       coalesce((select string_agg(tgname, ', ') from pg_trigger
                 where tgrelid = 'public.simulations'::regclass and not tgisinternal), 'none');

-- ── Later, only if the baseball boards get slow (many thousands of baseball seasons) ──
-- Each season record sorts one mode and position's rows by a stat. Run each ON ITS OWN (CONCURRENTLY
-- can't run inside a batch); it builds without locking the table:
--   create index concurrently if not exists simulations_baseball_tds on simulations (game_mode, position, season_tds desc) where game_mode like 'baseball-%' and build is not null;
--   create index concurrently if not exists simulations_baseball_war on simulations (game_mode, position, season_rating desc) where game_mode like 'baseball-%' and build is not null;
