-- QB Salary Cap (football version of basketball's Salary Cap mode)
-- Used by src/components/QBSalaryCap.jsx. Safe to re-run.

-- ─── Frozen daily boards ─────────────────────────────────────────────────────
create table if not exists public.qb_salary_cap_grids (
  date_str    text primary key,
  grid        jsonb not null,
  created_at  timestamptz not null default now()
);

-- ─── Daily plays ─────────────────────────────────────────────────────────────
create table if not exists public.qb_salary_cap_plays (
  id             bigint generated always as identity primary key,
  date_str       text not null,
  user_id        uuid references auth.users(id) on delete cascade,
  username       text,
  picks          jsonb not null,
  overall_score  int  not null,
  pass_yds       int,
  pass_tds       int,
  ints           int,
  budget_used    int,
  created_at     timestamptz not null default now()
);

create index if not exists qb_salary_cap_plays_date_score_idx
  on public.qb_salary_cap_plays (date_str, overall_score desc);
create index if not exists qb_salary_cap_plays_user_date_idx
  on public.qb_salary_cap_plays (user_id, date_str);

-- ─── Infinite-mode plays ─────────────────────────────────────────────────────
create table if not exists public.qb_salary_infinite_plays (
  id             bigint generated always as identity primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  username       text,
  picks          jsonb not null,
  overall_score  int  not null,
  pass_yds       int,
  pass_tds       int,
  ints           int,
  budget_used    int,
  created_at     timestamptz not null default now()
);

create index if not exists qb_salary_infinite_plays_score_idx
  on public.qb_salary_infinite_plays (overall_score desc);

-- ─── Row level security ──────────────────────────────────────────────────────
alter table public.qb_salary_cap_grids      enable row level security;
alter table public.qb_salary_cap_plays      enable row level security;
alter table public.qb_salary_infinite_plays enable row level security;

grant select on public.qb_salary_cap_grids, public.qb_salary_cap_plays, public.qb_salary_infinite_plays to anon, authenticated;
grant insert on public.qb_salary_cap_grids, public.qb_salary_cap_plays, public.qb_salary_infinite_plays to authenticated;

-- Grids: anyone can read; any signed-in user can freeze a day's board (insert
-- only — no update policy, so a frozen board can never be rewritten).
drop policy if exists "qb grids readable" on public.qb_salary_cap_grids;
create policy "qb grids readable" on public.qb_salary_cap_grids
  for select to anon, authenticated using (true);

drop policy if exists "qb grids insert" on public.qb_salary_cap_grids;
create policy "qb grids insert" on public.qb_salary_cap_grids
  for insert to authenticated with check (true);

-- Daily plays: public leaderboard; users insert only their own rows.
drop policy if exists "qb plays readable" on public.qb_salary_cap_plays;
create policy "qb plays readable" on public.qb_salary_cap_plays
  for select to anon, authenticated using (true);

drop policy if exists "qb plays insert own" on public.qb_salary_cap_plays;
create policy "qb plays insert own" on public.qb_salary_cap_plays
  for insert to authenticated with check (user_id = auth.uid());

-- Infinite plays: same rules.
drop policy if exists "qb infinite readable" on public.qb_salary_infinite_plays;
create policy "qb infinite readable" on public.qb_salary_infinite_plays
  for select to anon, authenticated using (true);

drop policy if exists "qb infinite insert own" on public.qb_salary_infinite_plays;
create policy "qb infinite insert own" on public.qb_salary_infinite_plays
  for insert to authenticated with check (user_id = auth.uid());
