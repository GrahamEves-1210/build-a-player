-- ════════════════════════════════════════════════════════════════════════════
-- DL mode: what the live database has to allow for dl-classic, dl-all-time, dl-lite
-- ════════════════════════════════════════════════════════════════════════════
-- Nothing in the repo's SQL gates a season on its position:
--   result_guards.sql   a football season is any mode but bucket%: 17 games, same bounds
--   account_guards.sql  DL's DPOYs never touch accounts (see below), so nothing to change
--   best_builds_index   the index is on game_mode itself, so it covers DL's rows too
--   daily_challenge / weekly_cup  the position check doesn't list 'dl', and doesn't need to:
--                       DL isn't in the Daily rotation (DC_POS in src/lib/verifyCore.js)
-- But the table that matters, simulations, isn't created by any file in this repo, and the
-- repo's SQL isn't proof of what's live. So this looks at the live table and only changes
-- something if it finds a list of modes that leaves DL out. On a database with no such
-- list it changes nothing and just prints the report at the bottom.
--
-- Awards: DL's DPOYs are season_award = 'dpoy' tags on its own rows, the way OL's All-Pros
-- work. classic_dpoys / alltime_dpoys stay DB's, so DL can't leak into DB's DPOY board.
--
-- Run once in the Supabase SQL editor. Safe to run again.

-- ── 1. A check constraint on simulations that lists the modes: add DL's three ──
do $$
declare
  c record;
  def text;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as d
    from pg_constraint
    where conrelid = 'public.simulations'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%game_mode%'
      and pg_get_constraintdef(oid) not ilike '%dl-classic%'
  loop
    if c.d !~ '''db-classic''' then
      raise warning 'simulations.% checks game_mode in a way this file can''t widen: %', c.conname, c.d;
      continue;
    end if;
    -- a list of modes: the DL modes go in beside DB's, with the same cast
    def := regexp_replace(c.d, '''db-classic''(::[a-z ]+)?',
                          '''db-classic''\1, ''dl-classic''\1, ''dl-all-time''\1, ''dl-lite''\1');
    execute format('alter table public.simulations drop constraint %I', c.conname);
    -- (a wider list can't fail an old row, so no scan of the whole table under a lock)
    if def !~* 'not valid\s*$' then def := def || ' not valid'; end if;
    execute format('alter table public.simulations add constraint %I %s', c.conname, def);
    raise notice 'simulations.%: DL modes added', c.conname;
  end loop;
end $$;

-- ── 2. Report: nothing below changes anything. The first three lines should say OK ──
-- The hourly job that fills leaderboard_user_stats isn't in the repo either. Its rows already
-- hold every mode that exists (ol-classic, lite, legends), so it should group by game_mode and
-- pick DL up by itself; line 3 flags it if its code names modes and leaves DL out.
select 'simulations game_mode check' as what,
       case when exists (select 1 from pg_constraint
                         where conrelid = 'public.simulations'::regclass and contype = 'c'
                           and pg_get_constraintdef(oid) ilike '%game_mode%'
                           and pg_get_constraintdef(oid) not ilike '%dl-classic%')
            then 'NEEDS A LOOK: see the warning above' else 'OK' end as status
union all
select 'simulations policies naming modes',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(policyname, ', ') from pg_policies
                 where schemaname = 'public' and tablename = 'simulations'
                   and coalesce(qual, '') || coalesce(with_check, '') ilike '%db-%'
                   and coalesce(qual, '') || coalesce(with_check, '') not ilike '%dl-%'), 'OK')
union all
select 'functions naming db-classic but not dl-classic',
       coalesce((select 'NEEDS A LOOK: ' || string_agg(p.proname, ', ') from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.prokind = 'f'
                   and p.prosrc ilike '%db-classic%' and p.prosrc not ilike '%dl-classic%'), 'OK')
union all
select 'triggers on simulations',
       coalesce((select string_agg(tgname, ', ') from pg_trigger
                 where tgrelid = 'public.simulations'::regclass and not tgisinternal), 'none');
