-- ═════════════════════════════════════════════════════════════════════════════
-- Board cache: Players of the Day and the Weekly Cup, worked out once every 5 minutes
-- ═════════════════════════════════════════════════════════════════════════════
-- Before this, every open Home asked the database for Players of the Day (a search
-- of the whole accounts table, on load and every 2 minutes), and every Daily screen
-- added up the week's Daily scores. At launch traffic that took the database down.
-- Now pg_cron works both out every 5 minutes into board_cache, and the game reads
-- that one small row (src/lib/progress.js; it falls back to the old queries only
-- while this file hasn't been run).
--
--   kind 'potd'  day   the top 5 by XP that day: [{ id, username, cos, day: { d, xp, g } }]
--                      (today and yesterday; yesterday's is what the morning payout reads)
--   kind 'cup'   week  the week's top 50 (Monday's date): [{ user_id, username, total, days, best }]
--                      (this week and last week; launch week counts from CUP_START)
--
-- Before running: Database → Extensions → enable pg_cron.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.board_cache (
  kind text not null,
  day  date not null,
  rows jsonb not null default '[]'::jsonb,
  at   timestamptz not null default now(),
  primary key (kind, day)
);
alter table public.board_cache enable row level security;
drop policy if exists "board cache is public" on public.board_cache;
create policy "board cache is public" on public.board_cache for select to anon, authenticated using (true);
revoke insert, update, delete on public.board_cache from anon, authenticated;

-- the cron's searches of accounts, by the day each tally is for
create index if not exists accounts_today_day_idx on public.accounts ((cos -> 'today' ->> 'd'));
create index if not exists accounts_yday_day_idx on public.accounts ((cos -> 'yday' ->> 'd'));

-- A day's top 5: a player's tally for it is still "today" on their row (they haven't
-- played since) or has moved to "yday"
create or replace function public.potd_rows(p_day date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'username', username, 'cos', cos, 'day', day)
                            order by xp desc, id), '[]'::jsonb)
    from (
      select * from (
        select distinct on (id) id, username, cos, day, (day ->> 'xp')::numeric as xp
          from (
            select id, username, cos, cos -> 'today' as day from public.accounts where cos -> 'today' ->> 'd' = p_day::text
            union all
            select id, username, cos, cos -> 'yday' as day from public.accounts where cos -> 'yday' ->> 'd' = p_day::text
          ) u
         where username is not null and coalesce((day ->> 'xp')::numeric, 0) > 0
         order by id, (day ->> 'xp')::numeric desc
      ) best
      order by xp desc, id
      limit 5
    ) top5;
$$;

-- A week's Cup (p_week = its Monday), counting from p_from (the launch, in launch week)
create or replace function public.cup_rows(p_week date, p_from date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'username', username, 'total', total, 'days', days, 'best', best)
                            order by total desc, days asc, first_at asc), '[]'::jsonb)
    from (
      select r.user_id, max(r.username) as username, sum(r.ovr)::int as total, count(*)::int as days,
             max(r.ovr)::int as best, min(r.created_at) as first_at
        from public.daily_challenge_results r
       where r.day between greatest(p_week, p_from) and p_week + 6
       group by r.user_id
       order by sum(r.ovr) desc, count(*) asc, min(r.created_at) asc
       limit 50
    ) top50;
$$;

create or replace function public.refresh_board_cache()
returns void
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'America/New_York')::date;
  monday date := today - (extract(isodow from today)::int - 1);
  cup_start constant date := '2026-10-29';   -- keep in step with CUP_START in src/lib/progress.js
  d date;
begin
  foreach d in array array[today, today - 1] loop
    insert into public.board_cache (kind, day, rows, at) values ('potd', d, public.potd_rows(d), now())
    on conflict (kind, day) do update set rows = excluded.rows, at = excluded.at;
  end loop;
  foreach d in array array[monday, monday - 7] loop
    insert into public.board_cache (kind, day, rows, at) values ('cup', d, public.cup_rows(d, cup_start), now())
    on conflict (kind, day) do update set rows = excluded.rows, at = excluded.at;
  end loop;
  delete from public.board_cache where day < today - 30;
end;
$$;
revoke all on function public.refresh_board_cache() from public, anon, authenticated;
revoke all on function public.potd_rows(date) from public, anon, authenticated;
revoke all on function public.cup_rows(date, date) from public, anon, authenticated;

-- every 5 minutes, and once now
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'bap-board-cache';
select cron.schedule('bap-board-cache', '*/5 * * * *', $$select public.refresh_board_cache()$$);
select public.refresh_board_cache();
