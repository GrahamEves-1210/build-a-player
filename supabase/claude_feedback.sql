-- Claude's feedback inbox: lets the scheduled Claude session read new feedback and mark what it did with it.
-- Run once in Supabase → SQL Editor → New query → paste → Run. The last statement prints a key: copy it into
-- the Claude form ("X-Feedback-Token" for byjazrdwrvsduplxkacr.supabase.co). It is shown only this once
-- (only its hash is kept); run the last statement again for a new key, and delete old rows from private.claude_keys.
--
-- What the key can do: call the two functions below, nothing else. It never sees contact emails, user ids or
-- usernames, and it can't read any other table. Players still can't read feedback.

-- 1. what Claude did with each one (null = not looked at yet)
alter table public.feedback add column if not exists triage      text check (triage in ('fixed', 'owner', 'not_a_bug', 'needs_info', 'duplicate', 'cant_reproduce'));
alter table public.feedback add column if not exists triage_note text check (char_length(triage_note) <= 1000);
alter table public.feedback add column if not exists triaged_at  timestamptz;

-- 2. the keys (hashed), in a schema the API doesn't expose
create schema if not exists private;
create table if not exists private.claude_keys (
  hash       text primary key,
  created_at timestamptz not null default now()
);
revoke all on schema private from anon, authenticated;
revoke all on private.claude_keys from anon, authenticated;

create or replace function private.claude_key_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.claude_keys
    where hash = encode(extensions.digest(coalesce(current_setting('request.headers', true)::json->>'x-feedback-token', ''), 'sha256'), 'hex')
  )
$$;
revoke all on function private.claude_key_ok() from public, anon, authenticated;

-- 3. the inbox: feedback not looked at yet, oldest first (no emails, ids or usernames).
--    device = the form's line (device · browser · app or website · screen size), sent since 2026-11-13;
--    user_agent = the browser's own string (device, OS, browser), sent since 2026-10-06.
drop function if exists public.claude_feedback_inbox(int);
drop function if exists public.claude_feedback_inbox(int, timestamptz);
create or replace function public.claude_feedback_inbox(p_limit int default 50, p_since timestamptz default null)
returns table (id bigint, created_at timestamptz, kind text, message text, app text, "position" text, page text, device text, user_agent text, signed_in boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.claude_key_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select f.id, f.created_at, f.kind, f.message, f.app, f.position, f.page,
           substring(f.user_agent from '^\[([^\]]*)\]'), regexp_replace(f.user_agent, '^\[[^\]]*\] ?', ''), f.user_id is not null
    from public.feedback f
    where f.triage is null and not f.resolved and (p_since is null or f.created_at >= p_since)
    order by f.created_at
    limit least(greatest(p_limit, 1), 200);
end $$;

-- 4. mark one: fixed / owner (a feature or ratings call for the owner) / not_a_bug / needs_info / duplicate / cant_reproduce
create or replace function public.claude_feedback_triage(p_id bigint, p_status text, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not private.claude_key_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.feedback
     set triage = p_status, triage_note = left(p_note, 1000), triaged_at = now(),
         resolved = resolved or p_status in ('fixed', 'not_a_bug', 'duplicate')
   where id = p_id;
end $$;

revoke all on function public.claude_feedback_inbox(int, timestamptz) from public;
revoke all on function public.claude_feedback_triage(bigint, text, text) from public;
grant execute on function public.claude_feedback_inbox(int, timestamptz) to anon;
grant execute on function public.claude_feedback_triage(bigint, text, text) to anon;

-- 5. make a key and show it once (copy the value in the result)
with k as (select encode(extensions.gen_random_bytes(24), 'hex') as token),
     ins as (insert into private.claude_keys (hash) select encode(extensions.digest(token, 'sha256'), 'hex') from k)
select token as copy_this_key from k;
