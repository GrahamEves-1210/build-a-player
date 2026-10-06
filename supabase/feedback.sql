-- Feedback inbox for the in-game "Send Feedback" form (src/components/FeedbackModal.jsx).
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Read submissions in Supabase → Table Editor → feedback (newest first: sort by created_at).

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('bug', 'idea', 'ratings', 'other')),
  message     text not null check (char_length(message) between 5 and 1500),
  -- signed-in sender; deleting the account keeps the feedback but drops the link
  user_id     uuid references auth.users (id) on delete set null,
  username    text check (char_length(username) <= 60),
  contact     text check (char_length(contact) <= 200),   -- email for a reply, if given
  app         text check (app in ('nfl', 'bucket')),
  position    text check (char_length(position) <= 20),
  page        text check (char_length(page) <= 200),
  user_agent  text check (char_length(user_agent) <= 300),
  resolved    boolean not null default false              -- tick off in the dashboard
);

alter table public.feedback enable row level security;

-- Anyone (signed in or not) can send feedback; signed-in users can only send as themselves.
-- There is deliberately no SELECT/UPDATE/DELETE policy: players can't read anyone's feedback.
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
