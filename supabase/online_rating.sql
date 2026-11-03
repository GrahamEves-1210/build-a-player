-- ════════════════════════════════════════════════════════════════════════════
-- The online rating, booked by the live server
-- ════════════════════════════════════════════════════════════════════════════
-- Compete pools, Trait Auctions and Blacktop games (1v1, 2v2, 3v3) run on the live
-- server, so it books each player's rating change itself (live/src/rating.js, the
-- amounts in src/lib/rating.js) through bump_rating(), which only the server can call.
-- Players read anyone's rating (profiles show it) and can't write it. A player's first
-- booked game starts from the rating their game had kept (within 100–1400), else 800.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.online_ratings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  rating     int not null default 800,
  best       int not null default 800,
  played     int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.online_ratings enable row level security;
drop policy if exists "read online ratings" on public.online_ratings;
create policy "read online ratings" on public.online_ratings for select to anon, authenticated using (true);
revoke insert, update, delete on public.online_ratings from anon, authenticated;
grant select on public.online_ratings to anon, authenticated;

create or replace function public.bump_rating(p_user uuid, p_delta int)
returns table (rating int, best int, played int)
language plpgsql security definer set search_path = public as $$
declare start int;
begin
  if not exists (select 1 from public.online_ratings r where r.user_id = p_user) then
    select greatest(100, least(1400, coalesce((a.app_profile -> 'stats' -> 'online' ->> 'rating')::numeric, 800)::int))
      into start from public.accounts a where a.id = p_user;
    insert into public.online_ratings (user_id, rating, best, played) values (p_user, coalesce(start, 800), coalesce(start, 800), 0)
      on conflict (user_id) do nothing;
  end if;
  return query
    update public.online_ratings r
       set rating = greatest(100, r.rating + p_delta),
           best = greatest(r.best, greatest(100, r.rating + p_delta)),
           played = r.played + 1,
           updated_at = now()
     where r.user_id = p_user
  returning r.rating, r.best, r.played;
end;
$$;
revoke all on function public.bump_rating(uuid, int) from public, anon, authenticated;
grant execute on function public.bump_rating(uuid, int) to service_role;
