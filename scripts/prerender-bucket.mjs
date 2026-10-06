// Writes dist/bucket.html — the built index.html with /bucket's own title,
// description, canonical and a short static heading + intro inside #root.
//
// The site is a client-side SPA, so every route used to get the same
// index.html ("Build-A-Player | Build-A-Bucket", no canonical, empty body).
// Cloudflare Pages serves a real bucket.html at /bucket ahead of its SPA
// fallback, so crawlers that don't run JavaScript (Bing, link previews) and
// Google's first pass now see a basketball page. React replaces the static
// #root contents as soon as it mounts.
//
// Title/description must match `bucketHead` in src/components/BucketApp.jsx.
import { readFileSync, writeFileSync } from 'fs'

const SITE  = 'https://build-a-player.com'
const TITLE = 'Build-A-Bucket: Build a Basketball Player (NBA) — Player Creator & Simulator'
const DESC  = 'Build a basketball player — spin the wheel to create your ultimate NBA player, simulate a full season, and compete on the all-time GOAT leaderboard. Free basketball player creator.'

const BODY = `<main class="seo-prerender">
        <h1>Build-A-Bucket: Build a Basketball Player</h1>
        <p>Spin the wheel of real NBA players and take one part of each player&rsquo;s game &mdash; jump shot, handles, finishing, defense, size &mdash; until you&rsquo;ve built your own basketball player. Then simulate a full NBA season, go head-to-head, and climb the all-time GOAT leaderboard.</p>
      </main>`

let html = readFileSync('dist/index.html', 'utf8')
const replace = (pattern, value) => {
  if (!pattern.test(html)) throw new Error(`prerender-bucket: nothing matched ${pattern}`)
  html = html.replace(pattern, value)
}

// data-rh marks a tag as Helmet-managed, so once React mounts, BucketApp's
// <Helmet> replaces these instead of adding a second copy of each. Only on
// tags Helmet itself renders — it would drop any other data-rh tag.
replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`)
replace(/<meta name="description" content="[^"]*"\s*\/?>/,
  `<meta name="description" content="${DESC}" data-rh="true" />\n    <link rel="canonical" href="${SITE}/bucket" data-rh="true" />`)
replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${TITLE}" data-rh="true" />`)
replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${DESC}" data-rh="true" />`)
replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${SITE}/bucket" data-rh="true" />`)
replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${TITLE}" />`)
replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${DESC}" />`)
replace(/<div id="root"><\/div>/, `<div id="root">\n      ${BODY}\n    </div>`)

writeFileSync('dist/bucket.html', html)
console.log('prerender-bucket: wrote dist/bucket.html')
