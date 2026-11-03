-- Daily Challenge board for the iOS/Android app (src/lib/progress.js).
-- Everyone gets the same seeded spins each day; a player's first simulated
-- build of the day is their score (its OVR). One row per player per day.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create table if not exists public.daily_challenge_results (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  day         date not null,                                   -- America/New_York date of the challenge
  user_id     uuid not null references auth.users (id) on delete cascade,
  username    text check (char_length(username) <= 60),
  ovr         smallint not null check (ovr between 0 and 120),
  position    text check (position in ('qb', 'rb', 'wr', 'te', 'db')),
  mode        text check (mode in ('classic', 'all-time')),
  build       jsonb,                                           -- { trait: { qb, team, val } } for checking scores
  unique (day, user_id)
);

alter table public.daily_challenge_results enable row level security;

-- Everyone can read the board
drop policy if exists "read daily challenge board" on public.daily_challenge_results;
create policy "read daily challenge board" on public.daily_challenge_results
  for select to anon, authenticated
  using (true);

-- Signed-in players post their own score, for today (or yesterday, for a run
-- that finished just after midnight). No updates or deletes: one shot per day.
drop policy if exists "post own daily score" on public.daily_challenge_results;
create policy "post own daily score" on public.daily_challenge_results
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and day between (now() at time zone 'America/New_York')::date - 1
                and (now() at time zone 'America/New_York')::date
  );

create index if not exists daily_challenge_board_idx
  on public.daily_challenge_results (day, ovr desc, created_at);
