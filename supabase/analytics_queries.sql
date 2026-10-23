-- ════════════════════════════════════════════════════════════════════════════
-- Analytics reports (read-only). Paste one query at a time into the SQL editor.
-- Events come from src/lib/track.js (analytics_events). A player is the account
-- when signed in, else the device (meta.dev).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Daily players, last 14 days (and how many were signed in)
select created_at::date as day,
       count(distinct coalesce(user_id::text, meta->>'dev')) as players,
       count(distinct user_id) as signed_in
  from analytics_events
 where event = 'app_open' and created_at > now() - interval '14 days'
 group by 1 order by 1 desc;

-- 2. Coming back: of the players whose first day was each day, how many returned
--    the next day (day 1) and a week later (day 7)
with opens as (
  select coalesce(user_id::text, meta->>'dev') as who, created_at::date as day
    from analytics_events where event = 'app_open' and coalesce(user_id::text, meta->>'dev') is not null
   group by 1, 2
), firsts as (select who, min(day) as first from opens group by who)
select f.first as first_day,
       count(*) as new_players,
       round(100.0 * count(*) filter (where exists (select 1 from opens o where o.who = f.who and o.day = f.first + 1)) / count(*), 1) as day1_pct,
       round(100.0 * count(*) filter (where exists (select 1 from opens o where o.who = f.who and o.day = f.first + 7)) / count(*), 1) as day7_pct
  from firsts f
 where f.first > current_date - 30
 group by 1 order by 1 desc;

-- 3. The first-session funnel, last 7 days: opened → finished the tutorial → played a
--    season → signed up
select count(distinct coalesce(user_id::text, meta->>'dev')) filter (where event = 'app_open') as opened,
       count(distinct coalesce(user_id::text, meta->>'dev')) filter (where event = 'tutorial_done') as tutorial_done,
       count(distinct coalesce(user_id::text, meta->>'dev')) filter (where event = 'season_done') as played_a_season,
       count(distinct coalesce(user_id::text, meta->>'dev')) filter (where event = 'signup') as signed_up
  from analytics_events where created_at > now() - interval '7 days';

-- 4. What people play, last 7 days (players and games per mode; a Squad Builder season
--    is a season_done with mode 'squad')
select case event when 'season_done' then coalesce(meta->>'mode', 'season') || case when (meta->>'daily')::boolean then ' (daily)' else '' end
                  else event end as mode,
       count(distinct coalesce(user_id::text, meta->>'dev')) as players,
       count(*) as games
  from analytics_events
 where event in ('season_done', 'compete_done', 'auction_done', 'blacktop_done', 'h2h_done')
   and created_at > now() - interval '7 days'
 group by 1 order by players desc;

-- 5. Money, last 30 days: looked → opened checkout → bought (Pro, the pass, coins)
select coalesce(meta->>'kind', case event when 'pro_view' then 'pro' when 'pass_view' then 'pass' end) as product,
       count(distinct coalesce(user_id::text, meta->>'dev')) filter (where event in ('pro_view', 'pass_view')) as looked,
       count(distinct coalesce(user_id::text, meta->>'dev')) filter (where event = 'checkout_open') as checkout,
       count(distinct coalesce(user_id::text, meta->>'dev')) filter (where event = 'purchase') as bought
  from analytics_events
 where event in ('pro_view', 'pass_view', 'checkout_open', 'purchase') and created_at > now() - interval '30 days'
 group by 1 order by 1;

-- 6. The coin economy, last 7 days: what's bought in the shop and with boosts
select event, coalesce(meta->>'slot', meta->>'kind') as what, count(*) as buys, sum((meta->>'price')::int) as coins_spent
  from analytics_events
 where event in ('shop_buy', 'boost_buy') and created_at > now() - interval '7 days'
 group by 1, 2 order by coins_spent desc nulls last;

-- 7. The Builder Pass: rewards claimed by tier (how far players get)
select (meta->>'tier')::int as tier,
       count(*) filter (where meta->>'track' = 'f') as free_claims,
       count(*) filter (where meta->>'track' = 'p') as premium_claims
  from analytics_events where event = 'pass_claim'
 group by 1 order by 1;
