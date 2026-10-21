# Go-live checklist

## Done already
- Security fixes on **main** (live now once pushed): billing portal locked to the signed-in player, checkouts use the session, `?ad_free=1` can't unlock anything, webhook handles refunds / disputes / failed renewals.
- Stripe webhook (the Railway one, `fascinating-brilliance`) listens to: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`, `charge.refunded`, `charge.dispute.created`.

## Any time now (safe for the current live site)
1. Push main: `git push origin main` (from F:\bap-main). Railway and the site's /api redeploy from it.
2. Supabase → SQL Editor, run in this order:
   1. `supabase/account_guards.sql`
   2. `supabase/result_guards.sql`

## Launch day (when the new version goes live)
1. `npm run build` passes on the branch you ship.
2. Push it so the website and Railway run the new code (Railway: check which branch it deploys from in its settings).
3. **After** the new site is live, deploy the live server:
   - `cd live`
   - `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (paste the service_role key from Supabase → Project Settings → API; once, it stays)
   - `npx wrangler deploy`
   Not before: older versions of the game don't send spin info, and the new server scores their Compete / Blacktop builds as free agents.
   Check it: open `https://bap-live.gre56734.workers.dev/health` (says ok).
4. Supabase SQL: run `supabase/result_guards.sql` again (it changed: it now applies each player's checks to results the live server saves for them), then `supabase/launch_lockdown.sql` (devices can no longer write seasons, Daily scores or Salary Cap plays themselves; only the live server, which checks them). If the live server ever goes down, the undo is at the top of that file.
5. App: `git fetch . web-app-look:app`, `git push origin app`, run the "iOS TestFlight" workflow, then submit build in App Store Connect.
6. Add the App Store ID `6819866400` to `src/lib/storeLinks.js` (APP_STORE_ID) once the app is live.
7. Test the App Review login (Review / Dinosaurjr1210) on the release build.

## Testing in several tabs later
One-seat-per-device is ON: `ONE_PER_DEVICE` in `live/src/queue.js` and `liveElsewhere()` in `src/lib/live.js`. Turn both off to test with several tabs, and back on before shipping.
