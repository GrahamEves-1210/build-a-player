-- ════════════════════════════════════════════════════════════════════════════
-- Crash / error reports from the app and the website
-- ════════════════════════════════════════════════════════════════════════════
-- Written by src/lib/errorLog.js (window errors, unhandled promise rejections)
-- and src/components/ErrorBoundary.jsx (React render errors). At most 5 a
-- session per device, the same message once a session / once a day.
--
-- Anyone (signed in or not) can insert; nobody can read through the anon or
-- authenticated keys. Read them in the dashboard (Table editor / SQL editor),
-- which uses the service role.
--
-- Safe to run more than once. Run in the Supabase SQL editor.

create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  message     text not null check (char_length(message) <= 1000),
  stack       text check (char_length(stack) <= 4000),
  kind        text check (char_length(kind) <= 20),          -- error | rejection | react | manual
  page        text check (char_length(page) <= 500),         -- path + query
  platform    text check (char_length(platform) <= 20),      -- ios | android | web
  app_version text check (char_length(app_version) <= 60),
  user_id     uuid,
  user_agent  text check (char_length(user_agent) <= 400)
);

create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;

-- insert only; a signed-in player can only file under their own id (or none)
drop policy if exists "anyone can report an error" on public.client_errors;
create policy "anyone can report an error" on public.client_errors
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- no select / update / delete policies: the API can't read or change reports
revoke select, update, delete on public.client_errors from anon, authenticated;
grant insert on public.client_errors to anon, authenticated;

-- Handy queries (dashboard):
--   select message, count(*), max(created_at) from client_errors
--     where created_at > now() - interval '7 days' group by message order by 2 desc;
--   delete from client_errors where created_at < now() - interval '90 days';
