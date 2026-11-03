-- ════════════════════════════════════════════════════════════════════════════
-- Players online: a live count for Home and the online modes
-- ════════════════════════════════════════════════════════════════════════════
-- Every open game (website and app, the new version) checks in once a minute with
-- its device id and where it is ('home', 'compete', 'blacktop', 'auction'…) through
-- ping_presence(), which answers with the counts in the same call: everyone seen in the
-- last 2 minutes, in all and by place (src/lib/presence.js). Old check-ins are cleared
-- as it goes. Nobody reads or writes the table except through the function.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.presence (
  dev  text primary key,
  area text not null default 'home',
  at   timestamptz not null default now()
);
create index if not exists presence_at_idx on public.presence (at);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

create or replace function public.ping_presence(p_dev text, p_area text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if p_dev is null or length(p_dev) not between 8 and 64 then return null; end if;
  insert into public.presence (dev, area, at)
  values (p_dev, coalesce(nullif(left(regexp_replace(coalesce(p_area, ''), '[^a-z0-9_-]', '', 'g'), 20), ''), 'home'), now())
  on conflict (dev) do update set area = excluded.area, at = now();
  if random() < 0.02 then delete from public.presence where at < now() - interval '10 minutes'; end if;
  select jsonb_build_object('total', coalesce(sum(n), 0), 'areas', coalesce(jsonb_object_agg(area, n), '{}'::jsonb))
    into out
    from (select area, count(*) as n from public.presence where at > now() - interval '2 minutes' group by area) a;
  return out;
end;
$$;
revoke all on function public.ping_presence(text, text) from public;
grant execute on function public.ping_presence(text, text) to anon, authenticated;
