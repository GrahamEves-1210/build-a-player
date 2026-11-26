-- Blacktop · King of the Hill online (2026-11-26): the live server (live/src/btlive.js book) saves each King of the
-- Hill game on the Blacktop record as vs_results.match_type = 'koth' (next to '1v1', '2v2', '3v3'), and the boards
-- (src/lib/boards.js) read it back. Run once in the Supabase SQL editor. Safe to run again.
--
-- vs_results isn't defined in this repo, so this doesn't assume what the live table has: a CHECK on match_type that
-- lists the values it takes gets 'koth' added to its list (everything it already allowed still goes in); with no such
-- check, nothing changes.
do $$
declare
  c record;
  nd text;
begin
  for c in
    select con.conname, pg_get_constraintdef(con.oid) as def
    from pg_constraint con
    where con.conrelid = 'public.vs_results'::regclass and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%match_type%'
      and pg_get_constraintdef(con.oid) not ilike '%koth%'
  loop
    nd := replace(c.def, 'ARRAY[', 'ARRAY[''koth''::text, ');
    if nd = c.def then
      raise notice 'left % alone (not a list of values): %', c.conname, c.def;
      continue;
    end if;
    execute format('alter table public.vs_results drop constraint %I', c.conname);
    execute format('alter table public.vs_results add constraint %I %s', c.conname, nd);
    raise notice '% now: %', c.conname, nd;
  end loop;
end $$;

-- check: a match_type check (if there is one) should now list 'koth'
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.vs_results'::regclass and contype = 'c';
