-- Career cloud save: one row per user + sport holding the whole career JSON.
-- Used by src/lib/careerCloud.js (merged with the device copy in src/lib/career.js:
-- the newer `data->updatedAt` wins). Safe to re-run.

create table if not exists public.careers (
  user_id     uuid not null references auth.users(id) on delete cascade,
  sport       text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, sport)
);

alter table public.careers enable row level security;

grant select, insert, update, delete on public.careers to authenticated;

-- Owner only: nobody can read or touch another player's career
drop policy if exists "careers select own" on public.careers;
create policy "careers select own" on public.careers
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "careers insert own" on public.careers;
create policy "careers insert own" on public.careers
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "careers update own" on public.careers;
create policy "careers update own" on public.careers
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "careers delete own" on public.careers;
create policy "careers delete own" on public.careers
  for delete to authenticated using (user_id = auth.uid());
