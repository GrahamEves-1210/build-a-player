// Writes dist/baseball.html: the built index.html with /baseball's own title, description,
// canonical and a short static heading + intro inside #root (the same job prerender-soccer.mjs
// does for /soccer: crawlers that don't run JavaScript see a baseball page, and React replaces
// the static #root as soon as it mounts).
//
// Only while baseball is switched on (src/lib/baseballLive.js): until then /baseball is football's
// Home, so there's no baseball page to bake.
//
// Title/description must match BASEBALL_TITLE / BASEBALL_DESC in src/components/BaseballApp.jsx.
import { readFileSync, writeFileSync } from 'fs'

const live = readFileSync('src/lib/baseballLive.js', 'utf8')
if (!/export const BASEBALL_LIVE = true\b/.test(live)) {
  console.log('prerender-baseball: baseball is off (lib/baseballLive.js), no baseball.html')
  process.exit(0)
}

const SITE  = 'https://build-a-player.com'
const TITLE = 'Build-A-Player Baseball: Build a Batter or Pitcher — MLB Player Creator &amp; Simulator'
const DESC  = 'Build a baseball player — spin the wheel to make your own hitter or pitcher from real MLB players and franchise legends, then play a 162-game season, chase the MVP and the Cy Young, and win the World Series. Free baseball player creator.'

const BODY = `<main class="seo-prerender">
        <h1>Build-A-Player Baseball: Build a Batter or a Pitcher</h1>
        <p>Spin the wheel of real MLB players, from today&rsquo;s rosters or every franchise&rsquo;s legends, and take one part of each player&rsquo;s game &mdash; contact, power, speed, velocity, a breaking ball &mdash; until you&rsquo;ve built your own hitter or pitcher. Then play a 162-game season: the All-Star break, the pennant race, the postseason series by series, and the MVP and Cy Young votes.</p>
      </main>`

let html = readFileSync('dist/index.html', 'utf8')
const replace = (pattern, value) => {
  if (!pattern.test(html)) throw new Error(`prerender-baseball: nothing matched ${pattern}`)
  html = html.replace(pattern, value)
}

// data-rh: Helmet-managed tags, so BaseballApp's <Helmet> replaces these once React mounts
replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`)
replace(/<meta name="description" content="[^"]*"\s*\/?>/,
  `<meta name="description" content="${DESC}" data-rh="true" />\n    <link rel="canonical" href="${SITE}/baseball" data-rh="true" />`)
replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${TITLE}" data-rh="true" />`)
replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${DESC}" data-rh="true" />`)
replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${SITE}/baseball" data-rh="true" />`)
replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${TITLE}" />`)
replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${DESC}" />`)
replace(/<div id="root"><\/div>/, `<div id="root">\n      ${BODY}\n    </div>`)

writeFileSync('dist/baseball.html', html)
console.log('prerender-baseball: wrote dist/baseball.html')
