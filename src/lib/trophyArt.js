// The clean build's championship trophy (lib/appArt.js swaps it in for /trophy.webp and /trophybasketball.webp, the
// website's renders of the leagues' own trophies). Our own cup, like neither league's: a two-handled silver cup on a
// stem, a graphite plinth with a gold band, and the sport's ball pressed into the bowl's face. Drawn on the renders'
// own canvas (800 x 1200, see-through round it), so every slot that sized the photo sizes this the same.
const SILVER = `<linearGradient id="ag" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#6f757d"/><stop offset=".18" stop-color="#c9ced5"/><stop offset=".34" stop-color="#f7f9fb"/>
  <stop offset=".5" stop-color="#d4d9df"/><stop offset=".72" stop-color="#8c929a"/><stop offset=".9" stop-color="#c3c8cf"/><stop offset="1" stop-color="#7a8088"/></linearGradient>
<linearGradient id="ad" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#565c64"/><stop offset=".35" stop-color="#b9bfc6"/><stop offset=".6" stop-color="#8a9098"/><stop offset="1" stop-color="#5a6068"/></linearGradient>
<linearGradient id="ab" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#14171b"/><stop offset=".3" stop-color="#3a4048"/><stop offset=".55" stop-color="#262b31"/><stop offset="1" stop-color="#101317"/></linearGradient>
<linearGradient id="au" x1="0" x2="1" y1="0" y2="0">
  <stop offset="0" stop-color="#9a7624"/><stop offset=".35" stop-color="#f6dc84"/><stop offset=".6" stop-color="#d1a843"/><stop offset="1" stop-color="#8a6a20"/></linearGradient>
<linearGradient id="ar" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`

// the ball pressed into the bowl, centred on (400, 560)
const BALL = {
  football: `<g transform="translate(400 560) rotate(-28)">
    <ellipse rx="86" ry="52" fill="url(#ad)" stroke="#5d636b" stroke-width="5"/>
    <path d="M-40 0h80" stroke="#eef1f4" stroke-width="7" stroke-linecap="round"/>
    ${[-28, -14, 0, 14, 28].map(x => `<path d="M${x} -11v22" stroke="#eef1f4" stroke-width="6" stroke-linecap="round"/>`).join('')}
    <path d="M-62 -26c10 8 10 44 0 52M62 -26c-10 8 -10 44 0 52" fill="none" stroke="#5d636b" stroke-width="5"/></g>`,
  basketball: `<g transform="translate(400 560)">
    <circle r="72" fill="url(#ad)" stroke="#5d636b" stroke-width="5"/>
    <path d="M-72 0h144M0 -72v144M-50 -52c26 26 26 78 0 104M50 -52c-26 26 -26 78 0 104" fill="none" stroke="#5d636b" stroke-width="5"/></g>`,
}

export function trophySvg(sport = 'football') {
  const ball = BALL[sport] ?? BALL.football
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 240 640 960" width="800" height="1200"><defs>${SILVER}</defs>
  <path d="M232 330c-112 -8 -150 70 -128 150c18 66 82 106 150 116" fill="none" stroke="url(#ad)" stroke-width="30" stroke-linecap="round"/>
  <path d="M568 330c112 -8 150 70 128 150c-18 66 -82 106 -150 116" fill="none" stroke="url(#ad)" stroke-width="30" stroke-linecap="round"/>
  <path d="M168 300h464c0 250 -86 420 -232 446c-146 -26 -232 -196 -232 -446z" fill="url(#ag)"/>
  <path d="M188 318h424c-6 120 -30 214 -76 290" fill="none" stroke="url(#ar)" stroke-width="10" opacity=".7"/>
  <ellipse cx="400" cy="300" rx="232" ry="30" fill="#5c626a"/>
  <ellipse cx="400" cy="296" rx="222" ry="22" fill="#2b3036"/>
  <path d="M168 300a232 30 0 0 0 464 0" fill="none" stroke="#eef1f4" stroke-width="6"/>
  <rect x="200" y="396" width="400" height="16" rx="3" fill="url(#au)"/>
  <path d="M262 330c4 150 30 270 92 360" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="16" stroke-linecap="round"/>
  ${ball}
  <path d="M352 740h96l-14 70h-68z" fill="url(#ag)"/>
  <ellipse cx="400" cy="830" rx="64" ry="34" fill="url(#ag)"/>
  <path d="M370 856h60l18 110h-96z" fill="url(#ag)"/>
  <path d="M250 990c0 -22 40 -34 150 -34s150 12 150 34z" fill="url(#ag)"/>
  <rect x="226" y="988" width="348" height="18" rx="4" fill="url(#au)"/>
  <path d="M236 1006h328l22 96h-372z" fill="url(#ab)"/>
  <rect x="196" y="1100" width="408" height="40" rx="8" fill="url(#ab)"/>
  <rect x="300" y="1036" width="200" height="40" rx="5" fill="url(#au)" opacity=".9"/>
  <path d="M196 1104h408" stroke="#4a5058" stroke-width="3"/>
</svg>`
}
