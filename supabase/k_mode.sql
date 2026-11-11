-- ════════════════════════════════════════════════════════════════════════════
-- K mode: what the live database has to allow for k-classic, k-all-time, k-lite,
-- and a kicker's Salary Cap board (Infinite plays tagged pos = 'k', if he is ever offered there)
-- ════════════════════════════════════════════════════════════════════════════
-- K is wired behind K_LIVE (src/lib/kLive.js). Nothing here shows it to anyone: this only
-- lets the rows in once the flag is flipped. Run it before the flip.
--
-- Nothing in the repo's SQL gates a season on its position:
--   result_guards.sql   a football season is any mode but bucket%: 17 games, same bounds
--   account_guards.sql  a kicker's All-Pros never touch accounts (see below), so nothing to change
--   best_builds_index   the index is on game_mode itself, so it covers the kicker's rows too
--   daily_challenge / weekly_cup  the position checks don't list 'k', and don't need to:
--                       K isn't in the Daily rotation (DC_POS in src/lib/verifyCore.js) or the Cup's
--   Compete / Trait Auction  the live worker keeps no position list in the database, and K has no Compete pool
-- But the table that matters, simulations, isn't created by any file in this repo, and the
-- repo's SQL isn't proof of what's live. If it has a list of modes, each of the kicker's three is
-- added on its own, only where it's missing. On a database with no such list it changes nothing.
--
-- Awards: a kicker's All-Pros are season_award = 'allpro' tags on his own rows (no counter on
-- accounts), the way OL's are.
-- A K season row: season_pass_yds = points, season_tds = field goals made, season_ints = field
-- goals tried, season_comp_pct = field goal percentage, season_rating = his longest (App.jsx).
-- Works whether or not dl_mode.sql / lb_mode.sql / ol_mode.sql have run: K's modes go in beside 'db-classic'.
--
-- Run once in the Supabase SQL editor. Safe to run again.

-- ── 1. A check constraint on simulations that lists the modes: add the kicker's three ──
do $$
declare
  c record;
  m text;
  def text;
begin
  foreach m in array array['k-classic', 'k-all-time', 'k-lite'] loop
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
      -- a list of modes: the kicker's mode goes in beside DB's, with the same cast
      def := regexp_replace(c.d, '''db-classic''(::[a-z ]+)?', '''db-classic''\1, ''' || m || '''\1');
      execute format('alter table public.simulations drop constraint %I', c.conname);
      -- (a wider list can't fail an old row, so no scan of the whole table under a lock)
      if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
      execute format('alter table public.simulations add constraint %I %s', c.conname, def);
      raise notice 'simulations.%: % added', c.conname, m;
    end loop;
  end loop;
end $$;

-- ── 2. Salary Cap: a kicker's Infinite plays (salary_positions.sql made the pos column) ──
-- The position check gets 'k' beside 'dl', keeping whatever else it already lists.
do $$
declare
  c record;
  def text;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'qb_salary_infinite_plays' and column_name = 'pos') then
    raise warning 'qb_salary_infinite_plays has no pos column: run salary_positions.sql first, then this again';
    return;
  end if;
  for c in
    select conname, pg_get_constraintdef(oid) as d
    from pg_constraint
    where conrelid = 'public.qb_salary_infinite_plays'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%pos%'
      and pg_get_constraintdef(oid) not ilike '%''k''%'
  loop
    if c.d !~ '''dl''' then
      raise warning 'qb_salary_infinite_plays.% checks pos in a way this file can''t widen: %', c.conname, c.d;
      continue;
    end if;
    def := regexp_replace(c.d, '''dl''(::[a-z ]+)?', '''dl''\1, ''k''\1');
    execute format('alter table public.qb_salary_infinite_plays drop constraint %I', c.conname);
    if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
    execute format('alter table public.qb_salary_infinite_plays add constraint %I %s', c.conname, def);
    raise notice 'qb_salary_infinite_plays.%: k added', c.conname;
  end loop;
end $$;

-- ── 3. Report: nothing below changes anything. The first four lines should say OK ──
-- The hourly job that fills leaderboard_user_stats isn't in the repo either. If it groups by
-- game_mode it picks up the kicker's three modes by itself;
-- line 3 flags it if its code names modes and leaves the kicker's out.
select 'simulations game_mode check' as what,
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%game_mode%'
                           and (pg_get_constraintdef(oid) not ilike '%''k-classic''%'
                                or pg_get_constraintdef(oid) not ilike '%''k-all-time''%'
                                or pg_get_constraintdef(oid) not ilike '%''k-lite''%'))
            then 'NEEDS A LOOK: see the warning above' else 'OK' end as status
union all
select 'simulations policies naming modes',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(policyname, ', ') from pg_policies
                 where schemaname = 'public' and tablename = 'simulations'
                   and coalesce(qual, '') || coalesce(with_check, '') ilike '%db-%'
                   and coalesce(qual, '') || coalesce(with_check, '') not ilike '%''k-all-time''%'), 'OK')
union all
select 'functions naming db-all-time but not k-all-time',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(p.proname, ', ') from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prokind = 'f'
                   and p.prosrc ilike '%db-all-time%' and p.prosrc not ilike '%''k-all-time''%'), 'OK')
union all
select 'salary pos check allows k',
       case when not exists (select 1 from information_schema.columns
                             where table_schema = 'public' and table_name = 'qb_salary_infinite_plays' and column_name = 'pos')
              then 'NEEDS A LOOK: no pos column (salary_positions.sql)'
            when exists (select 1 from pg_constraint
                         where conrelid = 'public.qb_salary_infinite_plays'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%pos%'
                           and pg_get_constraintdef(oid) not ilike '%''k''%')
              then 'NEEDS A LOOK: see the warning above' else 'OK' end
union all
select 'triggers on simulations',
       coalesce((select string_agg(tgname, ', ') from pg_trigger
                 where tgrelid = 'public.simulations'::regclass and not tgisinternal), 'none');
