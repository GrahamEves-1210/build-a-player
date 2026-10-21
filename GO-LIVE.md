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
   - `npx wrangler secret put RESEND_API_KEY` (your Resend key: forgot-password emails; once, it stays)
   - `npx wrangler deploy`
   Not before: older versions of the game don't send spin info, and the new server scores their Compete / Blacktop builds as free agents.
   Check it: open `https://bap-live.gre56734.workers.dev/health` (says ok).
4. Supabase SQL: run `supabase/result_guards.sql` again (it changed: it now applies each player's checks to results the live server saves for them), then `supabase/launch_lockdown.sql` (devices can no longer write seasons or Daily scores themselves; only the live server, which checks them). If the live server ever goes down, the undo is at the top of that file.
5. App: `git fetch . web-app-look:app`, `git push origin app`, run the "iOS TestFlight" workflow, then submit build in App Store Connect.
6. Add the App Store ID `6819866400` to `src/lib/storeLinks.js` (APP_STORE_ID) once the app is live.
7. Test the App Review login (Review / Dinosaurjr1210) on the release build.

## Testing in several tabs later
One-seat-per-device is ON: `ONE_PER_DEVICE` in `live/src/queue.js` and `liveElsewhere()` in `src/lib/live.js`. Turn both off to test with several tabs, and back on before shipping.

## BAP Pro yearly + Builder Pass + Discord Pro role (one-time setup)
1. Supabase → SQL Editor: run `supabase/builder_pass.sql` (the `pass_owners` table).
2. Stripe → Product catalog → your BAP Pro product → Add another price: $34.99, Recurring, Yearly. Copy its price id (`price_…`).
3. Set `STRIPE_PRICE_ID_YEARLY` = that id on Railway (Variables) and on Cloudflare Pages (Settings → Variables and Secrets, Production).
4. Discord: Server Settings → Roles → create "BAP Pro". Drag the bot's role above it, and make sure the bot's role has Manage Roles. Right-click the BAP Pro role → Copy Role ID (Developer Mode on).
5. Set `DISCORD_PRO_ROLE_ID` = that id on Railway and Cloudflare Pages. Railway also needs `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` (the same values Cloudflare already has).
6. Nothing to add to the webhook: the pass uses `checkout.session.completed` and `charge.refunded` / `charge.dispute.created`, which are already on.
The pass's price ($8.99) and seasons live in code (`src/lib/pass.js`, `server/server.js`, `functions/api/create-pass-checkout.js`, `functions/api/stripe-webhook.js`): add Season 2 to all of them before Dec 21.

## Forgot password (one-time setup)
- Resend → Domains: add and verify `build-a-player.com` (the reset email comes from `noreply@build-a-player.com`). Until it's verified, Resend refuses to send from it.
- Supabase → Authentication → URL Configuration → Redirect URLs: make sure `https://build-a-player.com/**` is listed (the reset link lands on `https://build-a-player.com/?reset=1`).
- Accounts made before sign-up asked for an email have no address on file: they get the same "if it has an email…" answer and no email. Those players can reach you through Feedback.

