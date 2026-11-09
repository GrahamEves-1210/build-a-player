// Writes dist/soccer.html: the built index.html with /soccer's own title, description,
// canonical and a short static heading + intro inside #root (the same job prerender-bucket.mjs
// does for /bucket: crawlers that don't run JavaScript see a soccer page, and React replaces
// the static #root as soon as it mounts).
//
// Only while soccer is switched on (src/lib/soccerLive.js): until then /soccer is football's
// Home, so there's no soccer page to bake.
//
// Title/description must match SOCCER_TITLE / SOCCER_DESC in src/components/SoccerApp.jsx.
import { readFileSync, writeFileSync } from 'fs'

const live = readFileSync('src/lib/soccerLive.js', 'utf8')
if (!/export const SOCCER_LIVE = true\b/.test(live)) {
  console.log('prerender-soccer: soccer is off (lib/soccerLive.js), no soccer.html')
  process.exit(0)
}

const SITE  = 'https://build-a-player.com'
const TITLE = 'Build-A-Player Soccer: Build a Striker — Soccer Player Creator &amp; Simulator'
const DESC  = 'Build a soccer player — spin the wheel to make your own striker from real players at Europe&#39;s top clubs or the World Cup, then play a full season, chase the Golden Boot and the Ballon d&#39;Or. Free soccer player creator.'

const BODY = `<main class="seo-prerender">
        <h1>Build-A-Player Soccer: Build a Striker</h1>
        <p>Spin the wheel of real players from Europe&rsquo;s top five leagues or the 2026 World Cup and take one part of each player&rsquo;s game &mdash; finishing, pace, heading, first touch &mdash; until you&rsquo;ve built your own No. 9. Then play a full season: the league, the cup and Europe, the Golden Boot race and the Ballon d&rsquo;Or.</p>
      </main>`

let html = readFileSync('dist/index.html', 'utf8')
const replace = (pattern, value) => {
  if (!pattern.test(html)) throw new Error(`prerender-soccer: nothing matched ${pattern}`)
  html = html.replace(pattern, value)
}

// data-rh: Helmet-managed tags, so SoccerApp's <Helmet> replaces these once React mounts
replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`)
replace(/<meta name="description" content="[^"]*"\s*\/?>/,
  `<meta name="description" content="${DESC}" data-rh="true" />\n    <link rel="canonical" href="${SITE}/soccer" data-rh="true" />`)
replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${TITLE}" data-rh="true" />`)
replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${DESC}" data-rh="true" />`)
replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${SITE}/soccer" data-rh="true" />`)
replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${TITLE}" />`)
replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${DESC}" />`)
replace(/<div id="root"><\/div>/, `<div id="root">\n      ${BODY}\n    </div>`)

writeFileSync('dist/soccer.html', html)
console.log('prerender-soccer: wrote dist/soccer.html')
