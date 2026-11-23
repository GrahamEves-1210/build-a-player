-- BAP Pro's Discord role: who should have it. The Pro accounts (subscription_status 'active') with Discord linked,
-- and their Discord ids, straight from Supabase's sign-in links (auth.identities). Only the server's own key can call
-- it (functions/api/_discordPro.js); players can't.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
create or replace function public.pro_discord_members()
returns table (user_id uuid, discord_id text)
language sql stable security definer set search_path = '' as $$
  select a.id, coalesce(i.identity_data->>'provider_id', i.identity_data->>'sub')
  from public.accounts a
  join auth.identities i on i.user_id = a.id and i.provider = 'discord'
  where a.subscription_status = 'active'
    and coalesce(i.identity_data->>'provider_id', i.identity_data->>'sub') is not null
  order by a.id
$$;
revoke all on function public.pro_discord_members() from public, anon, authenticated;
grant execute on function public.pro_discord_members() to service_role;
