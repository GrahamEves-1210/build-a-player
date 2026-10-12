# bap-live: the Blacktop 3v3 server

A Cloudflare Worker with two Durable Objects: `Lobby` (the six spots, lobby chat,
practice rooms) and `Room` (one per match: the build clock, build progress, the
start, who's out, every possession's calls, reactions, chat, rematch). It's a
separate project from the website, and deploying it never touches the site.

## First deploy (one time)

```
cd live
npm install
npx wrangler login        # opens the browser: log in to the Cloudflare account that hosts the site
npx wrangler deploy
```

The deploy prints the server's address, like `https://bap-live.<your-subdomain>.workers.dev`.
The app uses it as `wss://bap-live.<your-subdomain>.workers.dev` (VITE_LIVE_URL).

## Later deploys

Only when `live/src/index.js` changes:

```
cd live
npx wrangler deploy
```

## Run it locally

```
cd live
npx wrangler dev          # ws://localhost:8787
```

Then run the site against it: `VITE_LIVE_URL=ws://localhost:8787 npx vite`.

## Cost

Durable Objects are on Cloudflare's free plan (with daily limits). Workers Paid
($5/month) raises those limits a long way. A game is a few minutes of one small
object, so hundreds of games a day stay at about nothing.
