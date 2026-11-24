# Build-A-Player: notes for Claude

Sports builder game for players aged 12–16: spin real NFL/NBA players' traits into one build, then sim it.
Vite 5 + React 18. The website is on Cloudflare Pages (headers in `public/_headers`); the server is on Railway
(`server/`); the live worker is `live/` (Cloudflare, `wrangler`); the database is Supabase. The phone app is the same
code wrapped in Capacitor 8 and built on Codemagic (`APP.md`). Launch steps are in `GO-LIVE.md`.

## How the owner works
- **Keep answers short.** Answer first, in a few lines, with exact commands. Only explain at length if he asks.
- **Make it easy.** Use the fewest steps, in the right order, one paste per tool. Do it yourself when you can.
- **Do exactly what he asked.** Match visual references closely. "Just like his" means copy the whole approach, not a narrowed version of it.
- **Finish the work.** Don't stop after a pilot to wait for approval. He reviews the finished result and says what to disable before a push.
- **Pasted player feedback is not a work order.** List the items, he picks, then act.
- **Feedback runs:** a scheduled cloud session reads the in-game feedback twice a day (`supabase/claude_feedback.sql`).
  It fixes reported bugs on its own branch with a PR to `main`, never pushing `main`. Features, ideas, ratings and
  anything else that isn't a clear bug go to the owner first.
- He's on a Mac now (15" MacBook Air M5, zsh): `&&` works. Node lives in `~/.local/node` (no Homebrew); in a tool's shell put
  `export PATH="$HOME/.local/node/bin:$PATH";` first. (The old Windows PC used PowerShell 5.1 and F:\ paths.)

## Branches and pushing
- `main` is production: pushing it deploys build-a-player.com and Railway.
- `app` / `app-clean` are the phone app (TestFlight builds `app-clean`). Keep them on the same commit as `main`.
- **Finished work always goes to `main` (owner, 2026-11-23).** Merge the latest `origin/main` in first, run
  `npm run build`, push `main` and `app` together, then delete any side branch the work was on. Never leave
  finished work sitting on a side branch.
- Run `npm run build` before a push to `main`. Otherwise don't run builds unless he asks: the dev server is `npx vite` on 5199.
- Rosters, ratings and headshots must always be identical on `main` and the app branches.
- Cloud sessions may start on a `claude/*` branch; merge it into `main` when the work is done and delete it.
  The scheduled feedback runs are the exception: their fixes go out as a PR for him to merge.
- Never commit `.env.local` or generated `android/`/`ios/` output to `main`.

## Content rules
- **Realism test:** "Is this realistic to the NFL / NBA?" Contracts, cap, drafts, rosters and words all have to pass it.
- **Sports language:** copy must sound like real broadcasters, beat writers and coaches. No hype-man lines, no cute
  lines, no literal mechanics ("slide him, then cross him back" is the banned example).
- **Label the player** by username, or "Guest". Never "You" or "Your Build".
- **Logical outcomes:** a beaten defender never ends hands-up, and last-play moments decide the game.
- **In-game moments** are real plays inside the simulated game, never win-odds boosts.
- **Headshots:** ESPN only. No Wikipedia, Hall of Fame, sideline or action shots; initials beat a bad photo.
- **Data:** never change roster data, ratings or headshots unless asked. Never trim or re-encode files he drops in.
  When a player is removed or moved, his card goes with him, and every card must stay spinnable.
- **Position classification:** NBA PG/SG/SF go in guards, PF/C in bigs. WR uses the `bodyControl` key, not `agility`.
- A team twice in one build is fine.
- **Ratings sheet:** ratings are also kept in a Google Sheet that the ratings editor works in. Apply his changes to
  `src/data/*.js` without asking, then report. Any ratings change isn't done until the sheet matches.
  Tooling is in `scripts/ratings-sheet/`.
- Don't mention the unreleased app or app-only modes on public website pages, the wiki included.

## UI rules
- No vibe-coded look: no equal card grids, icon chips in tinted squares, sentence subtitles, gradients, glows or
  fade-up-everything. It should look like a real game menu, designed and rich rather than plain.
- Readable first: one primary action above the fold, text at 13px or more, obvious navigation.
- Keep the identity: mint-teal buttons, Anton/Bebas type, Build-A-Player wordmark. No candy, sparkles or cartoon fonts.
- Website layouts must clear the bottom ad rail (`--web-rail`). Ads are live on home.
- Reuse existing pieces (simFlow.jsx, BoxSheet, GamesSwitch, kit.jsx) before building new ones.
- Motion: `motion` is pinned at 12.43.0. Loops pause via `lib/fxPause.js`; no always-on infinite loops.
- Mini games keep the retro look; 3D rebuilds were rejected. Add celebrations and game feel without being asked.
- Faces: flat illustrated style. Players look about 21, with no grey or balding hair.
- Test like a player: real touch and wheel scrolling at 390x844 and 1280x800, with every option reachable.
- Change only what he named. Don't restyle neighbours.

## Where things are
- Feature switches: `src/lib/franchiseLive.js` (`FRANCHISE_LIVE`, `NBA_FRANCHISE_LIVE`; dev `?franchise=1`,
  `?nbafranchise=1`), plus per-mode `*_LIVE` flags (LB, OL, K live; soccer and baseball hidden; CFB live).
- Franchise (football + NBA): engine `src/lib/franchise2/` (NBA in `nba/`, with `nba/STATE.md`),
  UI `src/components/franchise2/`, checks `bash scripts/franchise2/run.sh <script>`.
- Career (football + basketball, one engine): `src/lib/career.js`, with sport rules in its `SPORT` table.
  Checks are in `scripts/moments/`.
- Mini games: `src/lib/mg/` canvas engines. The Third & Long art layer is the approved style.
- Wiki: `src/components/wiki/`. Patch notes: `src/lib/whatsNew.js`.
- Builder Pass seasons are defined in four places: `src/lib/pass.js`, `server/server.js`,
  `functions/api/create-pass-checkout.js` and `functions/api/stripe-webhook.js`, plus the RevenueCat map.
  Season 2 must be added before Dec 29.
- `supabase/*.sql` files are run by the owner and may differ from the live DB. Confirm a column exists live before relying on it.
