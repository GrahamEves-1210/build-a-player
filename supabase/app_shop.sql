-- App shop: coins, owned items, equipped cosmetics and achievements follow the
-- account (src/lib/progress.js reads and writes accounts.app_profile).
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Until this runs, the app keeps everything on the device and simply skips the sync.

alter table public.accounts add column if not exists app_profile jsonb;

-- Players update only their own row (most projects already have this policy;
-- this adds it if it's missing).
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'accounts' and policyname = 'own account app profile'
  ) then
    create policy "own account app profile" on public.accounts
      for update to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;
