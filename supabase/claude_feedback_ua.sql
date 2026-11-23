-- Patch for supabase/claude_feedback.sql (already run): the inbox also returns the browser's user agent, and takes
-- p_since (only feedback sent from then on). Run once in Supabase → SQL Editor.

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

revoke all on function public.claude_feedback_inbox(int, timestamptz) from public;
grant execute on function public.claude_feedback_inbox(int, timestamptz) to anon;
