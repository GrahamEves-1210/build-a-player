-- Claude's read of the crash log (client_errors, lib/errorLog.js): the same key as the feedback inbox
-- (supabase/claude_feedback.sql, run first). No user ids; the rest is what the crash screen's report sent.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
create or replace function public.claude_errors(p_hours int default 24, p_limit int default 100)
returns table (created_at timestamptz, kind text, message text, stack text, page text, platform text, app_version text, user_agent text, signed_in boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.claude_key_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select e.created_at, e.kind, e.message, e.stack, e.page, e.platform, e.app_version, e.user_agent, e.user_id is not null
    from public.client_errors e
    where e.created_at >= now() - make_interval(hours => least(greatest(p_hours, 1), 720))
    order by e.created_at desc
    limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function public.claude_errors(int, int) from public;
grant execute on function public.claude_errors(int, int) to anon;
