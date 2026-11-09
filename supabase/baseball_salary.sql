-- ════════════════════════════════════════════════════════════════════════════
-- Baseball Salary Cap: its own three tables (components/BaseballSalaryCap.jsx)
-- ════════════════════════════════════════════════════════════════════════════
-- Each sport's Salary Cap keeps its own tables (basketball: salary_cap_*, football: qb_salary_cap_*,
-- soccer: soccer_salary_*), so baseball gets baseball_salary_cap_grids / _plays / baseball_salary_infinite_plays.
-- Batters only: one board a day, like basketball's (no position column; a pitcher's play is turned away by the
-- live server, lib/baseballKits.js has no pitcher kit).
-- Nothing here shows baseball to anyone (that's BASEBALL_LIVE in src/lib/baseballLive.js): it only lets the
-- rows in. Until it runs, a baseball play's save fails quietly and the board in the corner of the screen reads
-- empty; nothing else is touched.
--
-- A row: picks (the five cards), overall_score (the batter's OVR, worked out by the live server), hr / rbi (the
-- board's stat line, the tiebreak), budget_used.
-- The same guards as the other Salary Cap tables, where this database has them:
--   result_guards.sql   guard_result_row (the row is the sender's, rate limits, OVR 0-99) and
--                       guard_salary_grid (a board frozen only for today or yesterday)
--   launch_lockdown.sql plays only through the live server, if basketball's are locked already
-- A daily play is once per player per day (a unique index: the live server reads a repeat as already saved) and
-- only for today's board or yesterday's.
--
-- Run once in the Supabase SQL editor. Safe to run again.

-- ─── Frozen daily boards ─────────────────────────────────────────────────────
create table if not exists public.baseball_salary_cap_grids (
  date_str    text primary key,
  grid        jsonb not null,
  created_at  timestamptz not null default now()
);

-- ─── Daily plays ─────────────────────────────────────────────────────────────
create table if not exists public.baseball_salary_cap_plays (
  id             bigint generated always as identity primary key,
  date_str       text not null,
  user_id        uuid references auth.users(id) on delete cascade,
  username       text,
  picks          jsonb not null,
  overall_score  int  not null check (overall_score between 0 and 99),
  hr             int,
  rbi            int,
  budget_used    int,
  created_at     timestamptz not null default now()
);

create index if not exists baseball_salary_cap_plays_date_score_idx
  on public.baseball_salary_cap_plays (date_str, overall_score desc);
create unique index if not exists baseball_salary_cap_plays_user_date_key
  on public.baseball_salary_cap_plays (user_id, date_str);

-- ─── Infinite plays ──────────────────────────────────────────────────────────
create table if not exists public.baseball_salary_infinite_plays (
  id             bigint generated always as identity primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  username       text,
  picks          jsonb not null,
  overall_score  int  not null check (overall_score between 0 and 99),
  hr             int,
  rbi            int,
  budget_used    int,
  created_at     timestamptz not null default now()
);

create index if not exists baseball_salary_infinite_plays_score_idx
  on public.baseball_salary_infinite_plays (overall_score desc);

-- ─── Row level security ──────────────────────────────────────────────────────
alter table public.baseball_salary_cap_grids      enable row level security;
alter table public.baseball_salary_cap_plays      enable row level security;
alter table public.baseball_salary_infinite_plays enable row level security;

grant select on public.baseball_salary_cap_grids, public.baseball_salary_cap_plays, public.baseball_salary_infinite_plays to anon, authenticated;
grant insert on public.baseball_salary_cap_grids, public.baseball_salary_cap_plays, public.baseball_salary_infinite_plays to authenticated;

-- Boards: anyone reads; a signed-in player freezes the day's (insert only, never rewritten)
drop policy if exists "baseball grids readable" on public.baseball_salary_cap_grids;
create policy "baseball grids readable" on public.baseball_salary_cap_grids
  for select to anon, authenticated using (true);
drop policy if exists "baseball grids insert" on public.baseball_salary_cap_grids;
create policy "baseball grids insert" on public.baseball_salary_cap_grids
  for insert to authenticated with check (true);

-- Plays: public boards; a player inserts only their own rows
drop policy if exists "baseball plays readable" on public.baseball_salary_cap_plays;
create policy "baseball plays readable" on public.baseball_salary_cap_plays
  for select to anon, authenticated using (true);
drop policy if exists "baseball plays insert own" on public.baseball_salary_cap_plays;
create policy "baseball plays insert own" on public.baseball_salary_cap_plays
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "baseball infinite readable" on public.baseball_salary_infinite_plays;
create policy "baseball infinite readable" on public.baseball_salary_infinite_plays
  for select to anon, authenticated using (true);
drop policy if exists "baseball infinite insert own" on public.baseball_salary_infinite_plays;
create policy "baseball infinite insert own" on public.baseball_salary_infinite_plays
  for insert to authenticated with check (user_id = auth.uid());

-- ─── A daily play: today's board or yesterday's (New York time, like the game) ──
create or replace function public.guard_baseball_salary_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'America/New_York')::date;
begin
  if new.date_str is null or new.date_str !~ '^\d{4}-\d{2}-\d{2}$' or new.date_str::date not in (today, today - 1) then
    return null;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_baseball_salary_day on public.baseball_salary_cap_plays;
create trigger guard_baseball_salary_day before insert on public.baseball_salary_cap_plays
  for each row execute function public.guard_baseball_salary_day();

-- ─── The other Salary Cap tables' guards, where this database has them ─────────
do $$
declare t text;
begin
  if to_regprocedure('public.guard_result_row()') is not null then
    foreach t in array array['baseball_salary_cap_plays', 'baseball_salary_infinite_plays'] loop
      execute format('drop trigger if exists guard_result_row on public.%I', t);
      execute format('create trigger guard_result_row before insert or update or delete on public.%I
                      for each row execute function public.guard_result_row()', t);
    end loop;
  else
    raise notice 'guard_result_row() is not on this database (result_guards.sql): baseball plays have no rate limit';
  end if;
  if to_regprocedure('public.guard_salary_grid()') is not null then
    drop trigger if exists guard_salary_grid on public.baseball_salary_cap_grids;
    create trigger guard_salary_grid before insert or update or delete on public.baseball_salary_cap_grids
      for each row execute function public.guard_salary_grid();
  end if;
  -- launch lockdown: if basketball's plays only arrive through the live server, so do baseball's
  if to_regclass('public.salary_cap_plays') is not null
     and not has_table_privilege('authenticated', 'public.salary_cap_plays', 'INSERT') then
    revoke insert on public.baseball_salary_cap_plays, public.baseball_salary_infinite_plays from anon, authenticated;
    raise notice 'baseball plays locked to the live server, like basketball''s';
  end if;
end $$;
