-- ════════════════════════════════════════════════════════════════════════════
-- Contact emails off the public accounts row
-- ════════════════════════════════════════════════════════════════════════════
-- The accounts row is read by leaderboards, friend search and profiles, so an email
-- kept on it could be read by other players. The game now keeps the email password
-- resets go to in the account's own sign-in data (auth.users metadata, contact_email:
-- only the player and the server can read it; src/lib/contactEmail.js), and the reset
-- server reads it there (live/src/reset.js).
-- This moves every email still on accounts.email into that private copy (it wins over
-- an older copy there: the profile's Save Email used to write accounts.email), clears
-- the column, and keeps players' saves from putting one back.
-- Run once in the Supabase SQL editor. Safe to run again.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'accounts' and column_name = 'email') then
    raise notice 'accounts has no email column: nothing to move';
    return;
  end if;

  update auth.users u
     set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('contact_email', trim(a.email))
    from public.accounts a
   where a.id = u.id and a.email is not null and trim(a.email) <> '';

  update public.accounts set email = null where email is not null;

  create or replace function public.accounts_no_email() returns trigger
  language plpgsql set search_path = public as $f$
  begin
    if coalesce(auth.role(), '') <> 'service_role' then new.email := null; end if;
    return new;
  end;
  $f$;
  drop trigger if exists accounts_no_email on public.accounts;
  create trigger accounts_no_email before insert or update on public.accounts
    for each row execute function public.accounts_no_email();
end $$;

-- Check afterwards (should say 0):  select count(*) from public.accounts where email is not null;
